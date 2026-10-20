const test=require('node:test'),assert=require('node:assert/strict'),{gzipSync}=require('node:zlib'),{createHash}=require('node:crypto');
const assets=require('../js/asset-loader.js'),io=require('../js/motor-loader.js');
const meta=data=>({bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});
test('gzip transport reproduces every byte and rejects corruption before activation',async()=>{
 const plain=Buffer.from('{"unidades":123456.789,"nombre":"Café"}'),zip=gzipSync(plain),m={...meta(plain),gzip:{path:'catalog.json.gz',...meta(zip)}};
 let route;const fetcher=async url=>{route=url;return new Response(zip);};
 const result=await assets.text(fetcher,'data/plan/catalog.json',m);assert.equal(result.text,plain.toString());assert.match(route,/catalog\.json\.gz\?sha256=/);
 await assert.rejects(assets.text(async()=>new Response(Buffer.from('corrupt')),'data/plan/catalog.json',m),/coincide/);
 await assert.rejects(assets.text(fetcher,'data/plan/catalog.json',{...m,bytes:5}),/grande/);
 await assert.rejects(assets.text(fetcher,'data/plan/catalog.json',{...m,gzip:{...m.gzip,path:'../../secret'}}),/Ruta/);
});
test('browsers without gzip streaming use the verified plain JSON',async()=>{
 const old=globalThis.DecompressionStream;globalThis.DecompressionStream=undefined;
 try{const data=Buffer.from('{"original":true}');let route;const result=await assets.text(async url=>{route=url;return new Response(data);},'data/plan/catalog.json',{...meta(data),gzip:{path:'catalog.json.gz'}});assert.equal(result.text,data.toString());assert.match(route,/catalog\.json\?sha256=/);}
 finally{globalThis.DecompressionStream=old;}
});
test('runtime JSON lookup preserves every original candidate, play and routine',()=>{
 const compact=require('../js/plan-catalog.js'),runtime=require('../js/plan-loader.js').create(JSON.parse(JSON.stringify(compact)));
 let count=0;for(const tab of ['cafe','dt'])for(const partners of Object.keys(compact.playRuns[tab]))for(let i=0;i<compact[tab+'Candidates'].length;i++){assert.equal(runtime.lookupPlay(tab,partners,runtime[tab+'Candidates'][i]),compact.lookupPlay(tab,partners,compact[tab+'Candidates'][i]));count++;}
 assert.equal(count,459256);for(const key of ['routines','coords','channelProd'])assert.deepEqual(runtime[key],compact[key]);
});

test('missing, damaged or unreadable gzip recovers only through verified plain JSON',async()=>{
 const plain=Buffer.from('{"estado":"correcto"}'),zip=gzipSync(plain),m={...meta(plain),gzip:{path:'catalog.json.gz',...meta(zip)}};
 for(const compressed of [()=>new Response('missing',{status:404}),()=>new Response(Buffer.from('damaged')),()=>{throw Error('connection lost');}]){
  const routes=[];const result=await assets.text(async url=>{routes.push(url);return url.includes('.gz?')?compressed():new Response(plain);},'data/plan/catalog.json',m);
  assert.equal(result.text,plain.toString());assert.equal(routes.length,2);
 }
 await assert.rejects(assets.text(async()=>new Response(Buffer.from('corrupt')),'data/plan/catalog.json',m),/coincide/);
});
test('cancelled gzip never starts a second download',async()=>{
 const controller=new AbortController(),plain=Buffer.from('{}'),zip=gzipSync(plain);let calls=0;
 await assert.rejects(assets.text(async()=>{calls++;controller.abort();throw new DOMException('cancelled','AbortError');},'data/plan/catalog.json',{...meta(plain),gzip:{path:'catalog.json.gz',...meta(zip)}},{signal:controller.signal}),{name:'AbortError'});
 assert.equal(calls,1);
});
