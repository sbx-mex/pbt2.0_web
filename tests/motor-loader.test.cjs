const test=require('node:test'),assert=require('node:assert/strict'),core=require('../js/weekly-core.js'),io=require('../js/motor-loader.js');
const {webcrypto,createHash}=require('node:crypto');if(!globalThis.crypto)globalThis.crypto=webcrypto;
async function pack(week='202601',units=100,channel='Lobby'){
 const csv='Tiendas,Semana,Clas_Semana,DayPart,Distribucion Canal,Mix de Producto,Unidades,Unidades AA\n38101,'+week+',Lun-Jue,1_Mañana,'+channel+',Espresso,'+units+',80\n';
 const file=new TextEncoder().encode(csv);return core.combine([await core.parseMotor(file.buffer,'semana-'+week+'.csv')]);
}
function published(value){const text=JSON.stringify(value)+'\n',manifest={schema:1,index:{path:'indice.json',bytes:Buffer.byteLength(text),sha256:createHash('sha256').update(text).digest('hex')},files:value.files.map(({path,week,sha256,bytes})=>({path,week,sha256,bytes}))};return {text,manifest,fetch:async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(manifest):text)};}
test('repository activation requires matching manifest, bytes, SHA and weekly files',async()=>{
 const value=await pack(),source=published(value);assert.deepEqual((await io.loadRepository(source.fetch)).pack,value);
 await assert.rejects(()=>io.loadRepository(async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(source.manifest):source.text+' ')),/no coinciden/);
 source.manifest.files[0].sha256='0'.repeat(64);await assert.rejects(()=>io.loadRepository(source.fetch),/no corresponde/);
});
test('HTML, missing manifest and oversized streamed responses cannot activate',async()=>{
 await assert.rejects(()=>io.loadRepository(async()=>new Response('<html>404</html>')),SyntaxError);
 await assert.rejects(()=>io.loadRepository(async()=>new Response('missing',{status:404})),/HTTP 404/);
 await assert.rejects(()=>io.boundedText(new Response('too long'),3),/tamaño/);
 await assert.rejects(()=>io.boundedText(new Response('x',{headers:{'Content-Length':'999'}}),3),/tamaño/);
});
test('local additions retain history and repeated reads never double count units',async()=>{
 const first=await pack(),next=await pack('202602',120),merged=io.mergeHistory(first,next);
 assert.deepEqual(merged.changes,{added:1,updated:0,retained:1});assert.equal(merged.pack.files.length,2);assert.equal(core.engine(merged.pack).calculate({},'CAFE').unidades,220);
 const again=io.mergeHistory(merged.pack,next);assert.equal(again.pack.rows.length,2);assert.equal(core.engine(again.pack).calculate({},'CAFE').unidades,220);assert.equal(again.changes.updated,0);
 assert.equal(first.files.length,1);assert.equal(next.files.length,1);
});
test('a corrected week replaces its previous units and recomputes DT classification',async()=>{
 const first=await pack(),corrected=await pack('202601',75,'DT'),result=io.mergeHistory(first,corrected);
 assert.equal(result.changes.updated,1);assert.equal(result.pack.files.length,1);assert.equal(core.engine(result.pack).calculate({},'DT').unidades,75);assert.equal(result.pack.stores[0][1],'DT');
 const reverted=io.mergeHistory(result.pack,first);assert.equal(reverted.pack.stores[0][1],'CAFE');assert.equal(core.engine(reverted.pack).calculate({},'CAFE').unidades,100);
});
test('invalid incoming history fails before touching a valid source',async()=>{
 const first=await pack(),broken=await pack('202602');broken.rows[0][4]++;assert.throws(()=>io.mergeHistory(first,broken),/conciliación/);assert.equal(core.engine(first).calculate({},'CAFE').unidades,100);
});
test('cancellation ends immediately and ignores a late file or fetch result',async()=>{
 const controller=new AbortController();let release;const task=io.abortable(new Promise(resolve=>release=resolve),controller.signal);controller.abort();await assert.rejects(task,{name:'AbortError'});release('late');
 const source=published(await pack()),aborted=new AbortController();aborted.abort();await assert.rejects(()=>io.loadRepository(source.fetch,aborted.signal),{name:'AbortError'});
});
module.exports={pack,published};
