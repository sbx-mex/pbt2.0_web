const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
if(!globalThis.crypto)globalThis.crypto=require('node:crypto').webcrypto;
const core=require('../js/weekly-core.js');
const groupBy=(items,key)=>{const groups=new Map();for(const item of items){const k=key(item);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(item);}return groups;};
const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/motores/indice.json'),'utf8'));
const engine=core.engine(pack);
test('all CSV units and rows reconcile against Python',()=>{
 const results=['CAFE','DT'].map(type=>engine.calculate({},type));
 assert.equal(results.reduce((sum,r)=>sum+r.registros,0),pack.files.reduce((sum,f)=>sum+f.rows,0));
 assert.equal(results.reduce((sum,r)=>sum+r.unidades,0),pack.files.reduce((sum,f)=>sum+f.units,0));
});
test('month, store and context select only matching rows',()=>{
 const row=pack.rows[0],type=new Map(pack.stores).get(row[0]),month=pack.weeks.find(w=>w.id===row[1]).label;
 const result=engine.calculate({Mes:[month],Tienda:['CeCo '+row[0]],DayPart:[row[2]],Weekpart:[row[3]]},type);
 const expected=pack.rows.filter(r=>r[0]===row[0]&&r[2]===row[2]&&r[3]===row[3]&&pack.weeks.find(w=>w.id===r[1]).label===month);
 assert.equal(result.unidades,expected.reduce((sum,r)=>sum+r[4],0));assert.equal(result.tiendasVisibles,1);
 assert.equal(Object.values(result.mix).reduce((a,b)=>a+b,0),100);assert.equal(Object.values(result.canales).reduce((a,b)=>a+b,0),100);
});
test('unknown month or store produces no fabricated data',()=>{
 assert.equal(engine.calculate({Mes:['Unknown']},'CAFE').registros,0);
 assert.equal(engine.calculate({Tienda:['CeCo 000000']},'CAFE').registros,0);
});
test('altered or duplicated cube cannot activate',()=>{
 const broken=structuredClone(pack);broken.rows[0][4]++;assert.throws(()=>core.engine(broken),/conciliación/);
 const duplicate=structuredClone(pack);duplicate.rows.push([...duplicate.rows[0]]);assert.throws(()=>core.engine(duplicate),/duplicados/);
});
test('calendar preserves original PBT 4-4-5 months',()=>{
 assert.equal(core.weekInfo('202605').label,'Feb 2026');assert.equal(core.weekInfo('202648').label,'Dic 2026');assert.equal(core.weekInfo('202606').label,'Feb 2026');assert.throws(()=>core.weekInfo('202154'),/inválida/);
});
test('negative units and quoted cells are read',()=>{
 assert.equal(core.number('(1,234)'),-1234);assert.equal(core.number('-2.5'),-2.5);
 assert.deepEqual(core.splitCSV('"A,B",C\r\n"Q""Z",0',','),[['A,B','C'],['Q"Z','0']]);assert.throws(()=>core.splitCSV('"open',','),/sin cerrar/);
});
test('browser reader reproduces Python groups for every CSV',async()=>{
 const motors=[];
 for(const file of pack.files){
  const bytes=fs.readFileSync(path.join(__dirname,'../data/motores',file.path));const buffer=bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength);
  const motor=await core.parseMotor(buffer,file.path);motors.push(motor);assert.equal(motor.file.units,file.units);assert.equal(motor.file.rows,file.rows);assert.equal(motor.file.sha256,file.sha256);
 }
 const combined=core.combine(motors);core.validatePack(combined);const grouped=new Map(pack.rows.map(row=>[row.slice(0,4).join('|'),row]));
 assert.equal(combined.rows.length,grouped.size);for(const row of combined.rows)assert.deepEqual(row,grouped.get(row.slice(0,4).join('|')));
});

async function fromRows(rows){
 const header='Tiendas,Semana,Clas_Semana,DayPart,Distribucion Canal,Mix de Producto,Unidades,Unidades AA\n';
 const grouped=groupBy(rows,row=>row[1]),motors=[];
 for(const [week,items] of grouped){const bytes=Buffer.from(header+items.map(row=>row.join(',')).join('\n'));motors.push(await core.parseMotor(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),week+'.csv'));}
 return core.combine(motors);
}
const fixtureRow=(week,mix,units,aa=units,channel='Lobby',days='Lun-Jue',part='1_Mañana')=>['38101',week,days,part,channel,mix,units,aa];
const tenths=object=>Object.values(object).reduce((n,value)=>n+Math.round(value*10),0);
test('largest remainder closes 100.0 without assigning the gap to an empty first category',()=>{
 assert.deepEqual(core.apportion([0,1,1,1]),[0,33.4,33.3,33.3]);assert.equal(core.apportion([0,0]),null);assert.equal(core.apportion([-1,2]),null);
 assert.deepEqual(core.apportion([1166,90,1426,372,124]),[36.7,2.8,44.9,11.7,3.9]);
});
test('multi-month percentages use summed units, single contexts, and matching AA',async()=>{
 const p=await fromRows([fixtureRow('202604','Espresso',100,80),fixtureRow('202605','CBS',300,200,'Pick up & Delivery'),fixtureRow('202605','Food',900,500,'Lobby','Vie-Dom')]),e=core.engine(p);
 const r=e.calculate({Mes:['Ene 2026','Feb 2026'],Weekpart:['Weekday'],DayPart:['Morning']});
 assert.equal(r.unidades,400);assert.equal(r.unidadesAA,280);assert.equal(r.mix.Espresso,25);assert.equal(r.mix.CBS,75);assert.equal(r.canales.Lobby,25);
 assert.deepEqual(r.weekly.map(w=>w.unitsAA),[80,200]);assert.equal(r.aa.mix.CBS,200);assert.equal(tenths(r.mix),1000);assert.equal(Object.values(r.playMix).reduce((a,b)=>a+b),100);
 assert.throws(()=>e.calculate({DayPart:['Morning','Lunch']}),/sola opción/);assert.throws(()=>e.calculate({Weekpart:['Weekday','Weekend']}),/sola opción/);
});
test('zero DT rows do not classify a store as DT; current or AA evidence does',async()=>{
 const zero=await fromRows([fixtureRow('202601','Espresso',100,90),fixtureRow('202601','Food',0,0,'DT')]);assert.equal(core.engine(zero).typeOf('CeCo 38101'),'CAFE');
 for(const [units,aa] of [[1,0],[0,1],[-1,0]]){const dt=await fromRows([fixtureRow('202601','Espresso',100,90),fixtureRow('202601','Food',units,aa,'DT')]);assert.equal(core.engine(dt).typeOf('CeCo 38101'),'DT');assert.ok(core.engine(dt).calculate({},'DT').registros);assert.equal(core.engine(dt).calculate({},'CAFE').registros,0);}
});
test('zero totals or negative category balances cannot fabricate percentages or a plan',async()=>{
 for(const rows of [[fixtureRow('202601','Espresso',0,0)],[fixtureRow('202601','Espresso',-2,1),fixtureRow('202601','CBS',100,1)]]){
  const r=core.engine(await fromRows(rows)).calculate({});assert.equal(r.valid,false);assert.equal(r.mix.Espresso,null);assert.equal(r.playMix.CBS,null);
 }
});
test('missing AA is unavailable rather than an invented zero; V19 backups can migrate',async()=>{
 const p=await fromRows([fixtureRow('202601','Espresso',100,'')]);const r=core.engine(p).calculate({});assert.equal(r.hasAA,false);assert.equal(r.unidadesAA,null);assert.equal(r.weekly[0].unitsAA,null);
 const old=structuredClone(pack);old.schema=1;old.rows=old.rows.map(row=>row.slice(0,14));const migrated=core.engine(old);assert.equal(migrated.calculate({}).unidadesAA,null);assert.equal(migrated.pack.legacyAA,true);
});
test('per-week AA tampering is rejected even if the global AA total still matches',()=>{
 const p=structuredClone(pack);p.files[0].unitsAA++;p.files[1].unitsAA--;assert.throws(()=>core.engine(p),/conciliados/);
});
test('uploaded consolidated workbook logic reproduces all store/week/context selections and the supplied example',async()=>{
 const f=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/consolidado.json'))),motors=[];
 const header='Tiendas,Semana,Clas_Semana,DayPart,Distribucion Canal,Mix de Producto,Unidades\n';
 for(const [key,items] of groupBy(f.rows,r=>String(r[0])+String(r[1]).padStart(2,'0'))){
  const bytes=Buffer.from(header+items.map(r=>[r[2],key,r[3],r[4],r[5],r[6],r[7]].join(',')).join('\n'));
  motors.push(await core.parseMotor(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),key+'.csv'));
 }
 const e=core.engine(core.combine(motors));let checked=0;
 for(const year of [2025,2026])for(const store of [38368,38604])for(const days of ['Lun-Jue','Vie-Dom'])for(const part of ['1_Mañana','2_Intermedio','3_Tarde'])for(const week of [null,28,29,30,31,32]){
  const selected=f.rows.filter(r=>r[0]===year&&r[2]===store&&r[3]===days&&r[4]===part&&(!week||r[1]===week));
  const total=selected.reduce((n,r)=>n+r[7],0),weeks=week?[String(year)+String(week).padStart(2,'0')]:[28,29,30,31,32].map(w=>String(year)+w);
  const r=e.calculate({Tienda:['CeCo '+store],Semana:weeks,Weekpart:[days==='Lun-Jue'?'Weekday':'Weekend'],DayPart:[{'1_Mañana':'Morning','2_Intermedio':'Lunch','3_Tarde':'Afternoon'}[part]]});
  assert.equal(r.unidades,total);if(total){assert.equal(tenths(r.mix),1000);assert.equal(tenths(r.canales),1000);assert.ok(Object.values(r.mix).every(Number.isInteger));assert.ok(Object.values(r.canales).every(Number.isInteger));}
  for(const [field,labels,output] of [[5,['Lobby','Pick up & Delivery'],r.canales],[6,['Espresso','COD','CBS','Food','Otro'],r.mix]])for(const label of labels){const units=selected.filter(row=>row[field]===label).reduce((n,row)=>n+row[7],0),key=label==='COD'?'Café filtrado':label;assert.equal(r.units[field===5?'channels':'mix'][key],units);if(total)assert.ok(Math.abs(output[key]-units/total*100)<1.000001);}
  checked++;
 }
 const example=e.calculate({Tienda:['CeCo 38368'],Semana:[28,29,30,31,32].map(w=>'2025'+w),DayPart:['Afternoon'],Weekpart:['Weekday']});
 assert.equal(example.unidades,f.example.total);assert.deepEqual(Object.values(example.mix),[36,3,45,12,4]);assert.deepEqual(core.apportion([1166,90,1426,372,124],1),f.example.mix);assert.deepEqual([example.canales.Lobby,example.canales['Pick up & Delivery']],f.example.channels);assert.equal(checked,144);
});
