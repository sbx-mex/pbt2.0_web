const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../js/weekly-core.js');
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
