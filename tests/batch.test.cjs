const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFileSync}=require('node:child_process');
const core=require('../js/batch-core.js');
const base={ceco:'38937',tab:'cafe',months:['Feb 2026','Ene 2026'],partnerTablet:'No'};
const example={Morning:[2,3,4,5],Lunch:[2,3,4],Afternoon:[3,4,5]};
const choices={Weekday:example,Weekend:example};
test('the requested example has 10 plans per day group, 20 altogether',()=>{
 const jobs=core.expand(base,choices);assert.equal(jobs.length,20);
 for(const day of ['Weekday','Weekend'])assert.equal(jobs.filter(j=>j.weekpart===day).length,10);
 assert.equal(jobs.filter(j=>j.weekpart==='Weekday'&&j.daypart==='Morning').length,4);
});
test('periods are canonical and duplicate batches cannot accumulate twice',()=>{
 const jobs=core.expand(base,choices),again=core.expand({...base,months:['Ene 2026','Feb 2026','Ene 2026']},choices),merged=core.merge(jobs,again);
 assert.equal(merged.jobs.length,20);assert.equal(merged.added,0);assert.equal(merged.duplicates,20);
});
test('different periods, stores and DT Tablet settings remain distinct',()=>{
 const [one]=core.expand(base,choices);
 assert.notEqual(core.key(one),core.key({...one,months:['Ene 2026']}));
 assert.notEqual(core.key(one),core.key({...one,ceco:'38938'}));
 assert.notEqual(core.key({...one,tab:'dt'}),core.key({...one,tab:'dt',partnerTablet:'Sí'}));
});
test('bad identifiers, months, empty periods and unsupported staffing fail early',()=>{
 const [one]=core.expand(base,choices);
 for(const change of [{ceco:'../../x'},{months:[]},{months:['Enero 2026']},{partners:1},{partners:12},{weekpart:'Both'},{daypart:'Night'}])assert.throws(()=>core.normalize({...one,...change}));
 assert.equal(core.normalize({...one,tab:'dt',partners:13}).partners,13);
});
test('all added plans are preserved when exceeding the batch cap is rejected',()=>{
 const [one]=core.expand(base,choices);
 const existing=Array.from({length:core.MAX},(_,i)=>({...one,ceco:String(10000+i)}));
 assert.throws(()=>core.merge(existing,[{...one,ceco:'99999'}]),/120/);assert.equal(existing.length,120);
});
test('month folder names prevent overwriting PDFs whose original names match',()=>{
 const [one]=core.expand(base,choices),file='PBT_38937_lun-jue_Manana_2Partners.pdf';
 assert.notEqual(core.path(one,file),core.path({...one,months:['Ene 2026']},file));
 assert.match(core.path(one,file),/2026-01_2026-02/);
});
test('ZIP rejects unsafe or duplicate paths and enforces the memory bound',()=>{
 for(const name of ['../x','/x','x/../y','x'+String.fromCharCode(92)+'y'])assert.throws(()=>core.zip([{name,bytes:'x'}]));
 assert.throws(()=>core.zip([{name:'a',bytes:'x'},{name:'a',bytes:'y'}]));
 assert.throws(()=>core.zip([{name:'big',bytes:new Uint8Array(64*1024*1024+1)}]),/64 MB/);
});
test('Python zipfile independently validates names, CRC32, Unicode and every byte',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pbt-zip-'));
 try{
  const files=[{name:'CeCo_38937/Ene/plan.pdf',bytes:new Uint8Array([0,255,10,34])},{name:'RESUMEN.csv',bytes:core.csv([['Tienda','Mes'],['Café México','Ene 2026']])},{name:'detalle/mañana.txt',bytes:'Mañana · café'}];
  fs.writeFileSync(path.join(tmp,'plans.zip'),new Uint8Array(await core.zip(files).arrayBuffer()));
  const script="import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert len(z.namelist())==3;assert z.read('CeCo_38937/Ene/plan.pdf')==bytes([0,255,10,34]);assert z.read('detalle/mañana.txt').decode()=='Mañana · café';assert z.read('RESUMEN.csv').decode('utf-8-sig').startswith(chr(34)+'Tienda'+chr(34))";
  execFileSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),['-c',script,path.join(tmp,'plans.zip')]);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
test('CSV escapes commas, quotes and spreadsheet formula input',()=>{
 const value=core.csv([['A,B','"C"','=1+1','@SUM(A1)']]);assert.match(value,/"A,B"/);assert.match(value,/"""C"""/);assert.ok(value.includes("'=1+1"));assert.ok(value.includes("'@SUM(A1)"));
});

