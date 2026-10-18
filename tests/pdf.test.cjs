const test=require('node:test'),assert=require('node:assert/strict');
const lib=require('../js/vendor/pdf-lib.min.js'),renderer=require('../js/pdf-renderer.js');
const snapshot={title:'DRIVE THRU',store:'38134 · Pilares',ceco:'38134',weekpart:'Weekday',daypartKey:'Lunch',months:'Ene - Feb',days:'Lun–Jue',daypart:'Intermedio',mode:'Manual',source:'CSV semanales · Unidades',weekText:'Semanas: 202601 a 202605',partners:13,
 channels:[['Lobby','55%'],['Pick up & Delivery','1%'],['DT','44%']],mix:[['Espresso','39%'],['COD','8%'],['CBS','36%'],['Food','14%'],['Otro','3%']],areas:[],routines:[]};
test('PDF has native Letter size, fixed margins and the selected filter metadata',async()=>{
 const bytes=await renderer.create(snapshot,lib),doc=await lib.PDFDocument.load(bytes);assert.equal(doc.getPageCount(),1);assert.deepEqual(doc.getPage(0).getSize(),{width:612,height:792});assert.equal(renderer.MARGIN,36);assert.equal(doc.getAuthor(),'Enrique César Flores & Jorge Antonio Alcantar Aguiar');assert.match(doc.getSubject(),/38134 · Pilares · Ene - Feb · Lun–Jue · Intermedio/);
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

test('the PDF retains the original arrangement of period, comments, shift, channels and mix',async()=>{
 const drawn=[];
 const tracking={...lib,PDFDocument:{async create(){const doc=await lib.PDFDocument.create(),add=doc.addPage.bind(doc);doc.addPage=(...args)=>{const page=add(...args),draw=page.drawText.bind(page);page.drawText=(value,options)=>{drawn.push({value,...options});draw(value,options);};return page;};return doc;}}};
 await renderer.create({...snapshot,tab:'dt',comments:'Plan para 38134 · Pilares. Referencia estimada del Q4 actual.'},tracking);
 const find=value=>{const item=drawn.find(item=>item.value===value);assert.ok(item,value);return item;};
 const period=find('Periodo de tiempo'),comments=find('Comentarios'),shift=find('Información de turno'),channels=find('Distribución de canales'),mix=find('Mix de productos');
 assert.equal(period.y,comments.y);assert.ok(period.x<comments.x);assert.ok(shift.y<period.y);assert.ok(Math.abs(shift.y-channels.y)<1);assert.ok(Math.abs(channels.y-mix.y)<1);assert.ok(shift.x<channels.x&&channels.x<mix.x);
 assert.ok(find('Plan de distribución recomendado').y<channels.y);assert.ok(find('Rutinas').y<find('Plan de distribución recomendado').y);
 assert.ok(drawn.some(item=>item.value===renderer.CREDIT));assert.ok(drawn.every(item=>!/#DistritoKike|Seleccionar|2026/.test(item.value)));
});

test('out-of-bounds partner positions are rejected rather than exported outside the original layout',async()=>{
 await assert.rejects(renderer.create({...snapshot,tab:'cafe',areas:[{marker:true,left:0,top:80,width:7,height:10,classes:['partner'],letter:'A'}]},lib),/fuera del plano original/);
});
