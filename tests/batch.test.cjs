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
test('flat PDF names include store, period, days, shift, padded partners and type',()=>{
 const [one]=core.expand(base,choices),file=core.pdfName(one);
 assert.ok(!file.includes('/'));assert.match(file,/^PBT_38937_2026-01a2026-02_1-Lun-Jue_1-Manana_02Partners_CAFE\.pdf$/);
 assert.notEqual(file,core.pdfName({...one,months:['Ene 2026']}));
 assert.notEqual(core.pdfName({...one,tab:'dt'}),core.pdfName({...one,tab:'dt',partnerTablet:'Sí'}));
 assert.notEqual(core.pdfName({...one,months:['Ene 2026','Mar 2026']}),core.pdfName({...one,months:['Ene 2026','Feb 2026','Mar 2026']}));
});
test('ZIP name follows count, CeCo and local ddmmaa',()=>{
 const jobs=core.expand(base,choices),date=new Date(2026,9,18,19,30);
 assert.equal(core.archiveName(jobs,date),'PBT_Planes_20_38937_181026.zip');
 assert.equal(core.archiveName([jobs[0],{...jobs[1],ceco:'38134'}],date),'PBT_Planes_2_VariosCeCo_181026.zip');
 assert.throws(()=>core.archiveName([],date));
});
test('export order is independent from the order in which plans were added',()=>{
 const jobs=core.expand(base,choices),normal=core.order(jobs).map(core.pdfName),reversed=core.order(jobs.slice().reverse()).map(core.pdfName);
 assert.deepEqual(normal,reversed);assert.equal(normal[0],core.pdfName(jobs[0]));
 const one=jobs[0];assert.ok(core.pdfName({...one,partners:2})<core.pdfName({...one,partners:10}));
});
test('shift labels explain all three time ranges and the overnight turn',()=>{
 assert.equal(core.shiftLabel('Morning'),'Mañana · 6 am a 12 pm');
 assert.equal(core.shiftLabel('Lunch'),'Intermedio · 12 pm a 5 pm');
 assert.equal(core.shiftLabel('Afternoon'),'Tarde · 5 pm a 6 am (día siguiente)');
 assert.throws(()=>core.shiftLabel('Night'));
});
test('PDF export rejects directories, extra files, duplicate names and incomplete output',()=>{
 const bytes=new TextEncoder().encode('%PDF-1.7\n%%EOF'),pdf={name:'PBT_38937_Plan.pdf',bytes};
 for(const name of ['folder/PBT_38937_Plan.pdf','../PBT_38937_Plan.pdf','RESUMEN.csv','MANIFIESTO.json'])assert.throws(()=>core.pdfZip([{name,bytes}]));
 assert.throws(()=>core.pdfZip([pdf,{...pdf,name:'PBT_38937_plan.pdf'}]));
 assert.throws(()=>core.pdfZip([{...pdf,bytes:new Uint8Array([1,2,3])}]));
 assert.throws(()=>core.pdfZip([{...pdf,bytes:new TextEncoder().encode('%PDF-1.7 incomplete')}]));
 assert.throws(()=>core.pdfZip([]));
});
test('ZIP rejects unsafe paths and enforces its memory bound',()=>{
 for(const name of ['../x','/x','x/../y','x'+String.fromCharCode(92)+'y'])assert.throws(()=>core.zip([{name,bytes:'x'}]));
 assert.throws(()=>core.zip([{name:'a',bytes:'x'},{name:'a',bytes:'y'}]));
 assert.throws(()=>core.zip([{name:'big',bytes:new Uint8Array(64*1024*1024+1)}]),/64 MB/);
});
test('Python independently verifies flat names, CRC32 and all PDF bytes',async()=>{
 const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'pbt-zip-'));
 try{
  const jobs=core.expand(base,choices).slice(0,2),files=jobs.map(job=>({name:core.pdfName(job),bytes:new TextEncoder().encode('%PDF-1.7\n%%EOF')})),name=core.archiveName(jobs,new Date(2026,9,18));
  fs.writeFileSync(path.join(tmp,name),new Uint8Array(await core.pdfZip(files).arrayBuffer()));
  const script="import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);assert z.testzip() is None;assert len(z.namelist())==2;assert all('/' not in n and n.endswith('.pdf') for n in z.namelist());assert all(z.read(n)==b'%PDF-1.7\\n%%EOF' for n in z.namelist())";
  execFileSync(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),['-c',script,path.join(tmp,name)]);
 }finally{fs.rmSync(tmp,{recursive:true,force:true});}
});
