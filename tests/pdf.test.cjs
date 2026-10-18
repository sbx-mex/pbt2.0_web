const test=require('node:test'),assert=require('node:assert/strict');
const lib=require('../js/vendor/pdf-lib.min.js'),renderer=require('../js/pdf-renderer.js');
const snapshot={title:'DRIVE THRU',store:'38134 · Pilares',ceco:'38134',weekpart:'Weekday',daypartKey:'Lunch',months:'Ene 2026, Feb 2026',days:'Lun–Jue',daypart:'Intermedio',mode:'Manual',source:'CSV semanales · Unidades',weekText:'Semanas: 202601 a 202605',partners:13,
 channels:[['Lobby','55%'],['Pick up & Delivery','1%'],['DT','44%']],mix:[['Espresso','39%'],['COD','8%'],['CBS','36%'],['Food','14%'],['Otro','3%']],areas:[],routines:[]};
test('PDF has native Letter size, fixed margins and the selected filter metadata',async()=>{
 const bytes=await renderer.create(snapshot,lib),doc=await lib.PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);assert.deepEqual(doc.getPage(0).getSize(),{width:612,height:792});assert.equal(renderer.MARGIN,36);assert.equal(doc.getAuthor(),undefined);assert.match(doc.getSubject(),/38134 · Pilares · Ene 2026, Feb 2026 · Lun–Jue · Intermedio/);
});
test('long routine lists paginate on Letter pages without dropping selected context',async()=>{
 const many={...snapshot,routines:Array.from({length:45},(_,i)=>({partner:String(i+1)+' · EQUIPO',station:'Soporte',fixed:'No',routine:'Rutina operativa de bebidas y alimentos. '.repeat(8)}))};
 const doc=await lib.PDFDocument.load(await renderer.create(many,lib));assert.ok(doc.getPageCount()>2);assert.ok(doc.getPages().every(p=>p.getWidth()===612&&p.getHeight()===792));
});

test('filename contains the chosen store, day group, shift and partner count',()=>{
 assert.equal(renderer.filename(snapshot),'PBT_38134_lun-jue_Intermedio_13Partners.pdf');
 assert.equal(renderer.filename({...snapshot,weekpart:'Weekend',daypartKey:'Afternoon',partners:4}),'PBT_38134_vie-dom_Tarde_4Partners.pdf');
 assert.throws(()=>renderer.filename({...snapshot,ceco:''}),/Selecciona una tienda/);
});
