const test=require('node:test'),assert=require('node:assert/strict');
const lib=require('../js/vendor/pdf-lib.min.js'),renderer=require('../js/pdf-renderer.js');
const snapshot={title:'DRIVE THRU',store:'CeCo 38134',months:'Ene 2026, Feb 2026',days:'Lun–Jue',daypart:'Intermedio',mode:'Manual',source:'CSV semanales · Unidades',weekText:'Semanas: 202601 a 202605',partners:13,
 channels:[['Lobby','54.9%'],['Pick up & Delivery','1.5%'],['DT','43.6%']],mix:[['Espresso','39.4%'],['COD','8.1%'],['CBS','35.5%'],['Food','13.9%'],['Otro','3.1%']],areas:[],routines:[]};
test('PDF has native Letter size, fixed margins and the selected filter metadata',async()=>{
 const bytes=await renderer.create(snapshot,lib),doc=await lib.PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);assert.deepEqual(doc.getPage(0).getSize(),{width:612,height:792});assert.equal(renderer.MARGIN,36);assert.match(doc.getSubject(),/CeCo 38134 · Ene 2026, Feb 2026 · Lun–Jue · Intermedio/);
});
test('long routine lists paginate on Letter pages without dropping selected context',async()=>{
 const many={...snapshot,routines:Array.from({length:45},(_,i)=>({partner:String(i+1)+' · EQUIPO',station:'Soporte',fixed:'No',routine:'Rutina operativa de bebidas y alimentos. '.repeat(8)}))};
 const doc=await lib.PDFDocument.load(await renderer.create(many,lib));assert.ok(doc.getPageCount()>2);assert.ok(doc.getPages().every(p=>p.getWidth()===612&&p.getHeight()===792));
});
