const test=require('node:test'),assert=require('node:assert/strict'),weeks=require('../js/weeks.js'),engineCore=require('../js/weekly-core.js'),batch=require('../js/batch-core.js'),pdf=require('../js/pdf-renderer.js');
const pack={weeks:['202634','202635','202636','202637','202638','202639','202640','202641'].map(engineCore.weekInfo)};
test('month weeks use the actual CSV list and PBT 4-4-5, not calendar dates or future weeks',()=>{
 assert.deepEqual(weeks.available(pack,['Sep 2026']).map(w=>w.id),['202635','202636','202637','202638','202639']);
 assert.deepEqual(weeks.validate(pack,['Oct 2026']),['202640','202641']);
 assert.equal(weeks.available(pack,['Nov 2026']).length,0);
});
test('invalid, stale, removed and out-of-month selections cannot fall back to a full month',()=>{
 for(const selection of [['202639'],['202642'],['202654'],['../x'],[202640]])assert.throws(()=>weeks.validate(pack,['Oct 2026'],selection));
 assert.throws(()=>weeks.validate(pack,['Nov 2026'],[]));assert.throws(()=>weeks.validate(pack,['Sep 2026','Nov 2026'],[]));
 assert.deepEqual(weeks.validate(pack,['Oct 2026'],['202641','202640','202640']),['202640','202641']);
});
test('week selections change actual units, without double-counting duplicate choices or changing monthly totals',async()=>{
 const motors=[];for(const [week,amount] of [['202640',100],['202641',250]]){
 const csv='Tiendas,Semana,Clas_Semana,DayPart,Distribucion Canal,Mix de Producto,Unidades,Unidades AA\n38101,'+week+',Lun-Jue,1_Mañana,Lobby,Espresso,'+amount+',80\n';
 motors.push(await engineCore.parseMotor(new TextEncoder().encode(csv).buffer,week+'.csv'));
 }
 const p=engineCore.combine(motors),engine=engineCore.engine(p),base={Mes:['Oct 2026'],Tienda:['CeCo 38101'],Weekpart:['Weekday'],DayPart:['Morning']};
 assert.equal(engine.calculate(base,'CAFE').unidades,350);
 const selected=weeks.validate(p,base.Mes,['202641','202641']);
 const result=engine.calculate({...base,Semana:selected},'CAFE');assert.equal(result.unidades,250);assert.deepEqual(result.weeks,['202641']);
 assert.equal(engine.calculate(base,'CAFE').unidades,350);
});
test('batch deduplication and flat filenames distinguish week subsets and preserve old month-only drafts',()=>{
 const job={ceco:'38937',tab:'cafe',months:['Oct 2026'],weekpart:'Weekday',daypart:'Morning',partners:4};
 assert.equal(batch.key(job),batch.key({...job,weeks:[]}));
 const one={...job,weeks:['202640']},two={...job,weeks:['202641']};
 assert.notEqual(batch.key(one),batch.key(two));assert.notEqual(batch.pdfName(one),batch.pdfName(two));assert.notEqual(batch.pdfName(one),batch.pdfName(job));
 assert.match(batch.pdfName(one),/_S202640_/);assert.ok(!batch.pdfName(one).includes('/'));
 assert.equal(batch.merge([one],[two,job,one]).jobs.length,3);
 assert.throws(()=>batch.normalize({...job,weeks:['../../x']}));
});
test('compact week labels retain gaps and years, and long selections have bounded safe filename tokens',()=>{
 assert.equal(weeks.token(['202639','202635','202636']),'202635a202636+202639');
 assert.equal(weeks.label(['202640','202641']),'Semanas 2026 · S40–2026 · S41');
 assert.equal(weeks.token(['202653','202701']),'202653+202701');
 const many=Array.from({length:100},(_,i)=>String(2026+Math.floor(i/27))+String(i%27*2+1).padStart(2,'0'));
 assert.ok(weeks.token(many).length<=80);assert.notEqual(weeks.token(many),weeks.token(many.slice(1)));
 const s={ceco:'38937',partners:4,weekpart:'Weekday',daypartKey:'Morning',selectedWeeks:many};assert.ok(pdf.filename(s).length<255);
});
