const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(){
 const scope='https://example.test/pbt2.0_web/',handlers={},databases=new Map();let network=async()=>new Response('fresh');
 const key=request=>new URL(typeof request==='string'?request:request.url,scope).href;
 const caches={keys:async()=>[...databases.keys()],delete:async name=>databases.delete(name),open:async name=>{
  if(!databases.has(name))databases.set(name,new Map());const items=databases.get(name);
  return {match:async request=>items.get(key(request))?.clone(),put:async(request,response)=>items.set(key(request),response.clone()),keys:async()=>[...items.keys()].map(url=>({url})),delete:async request=>items.delete(key(request)),addAll:async()=>{}};
 }};
 const self={registration:{scope},location:{origin:new URL(scope).origin},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(name,fn)=>handlers[name]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),{self,caches,URL,Headers,Response,fetch:request=>network(request)});
 return {scope,databases,caches,setNetwork:fn=>network=fn,activate:async()=>{let promise;handlers.activate({waitUntil:value=>promise=value});await promise;},request:async(route,mode='cors')=>{let promise;handlers.fetch({request:{url:new URL(route,scope).href,method:'GET',mode},respondWith:value=>promise=value});return promise;}};
}
test('weekly index is refreshed even when an old copy is cached',async()=>{
 const f=fixture();f.setNetwork(async()=>new Response('{"value":"first"}'));assert.equal(await(await f.request('data/motores/indice.json')).text(),'{"value":"first"}');
 f.setNetwork(async()=>new Response('{"value":"second"}'));assert.equal(await(await f.request('data/motores/indice.json')).text(),'{"value":"second"}');
});
test('offline index is explicitly marked as a saved copy',async()=>{
 const f=fixture();f.setNetwork(async()=>new Response('{"value":"saved"}'));await f.request('data/motores/indice.json');f.setNetwork(async()=>{throw Error('offline');});
 const response=await f.request('data/motores/indice.json');assert.equal(response.headers.get('X-PBT-Offline'),'1');assert.equal(await response.text(),'{"value":"saved"}');
});
test('cache cleanup preserves other projects and their saved files',async()=>{
 const f=fixture(),cache=await f.caches.open('pbt2-web-v18-data');await cache.put(f.scope+'js/data.js',new Response('old'));
 await cache.put('https://example.test/other/js/data.js',new Response('other'));await f.caches.open('controlops-cache');await f.activate();
 assert.ok(f.databases.has('controlops-cache'));assert.ok(await cache.match('https://example.test/other/js/data.js'));assert.equal(await cache.match(f.scope+'js/data.js'),undefined);
});
test('V22 keeps the cached original engine available across the interface upgrade',async()=>{
 const f=fixture(),name='pbt2-web-'+encodeURIComponent(new URL(f.scope).pathname)+'-v20-data',cache=await f.caches.open(name);await cache.put(f.scope+'js/excel_data.js?v=20',new Response('original engine'));
 await f.activate();f.setNetwork(async()=>{throw Error('offline');});assert.equal(await(await f.request('js/excel_data.js?v=20')).text(),'original engine');
});

test('a malformed HTML response preserves the previous JSON backup',async()=>{
 const f=fixture();f.setNetwork(async()=>new Response('{"schema":1}'));await f.request('data/motores/manifest.json');f.setNetwork(async()=>new Response('<html>error</html>'));const response=await f.request('data/motores/manifest.json');assert.equal(response.headers.get('X-PBT-Offline'),'1');assert.deepEqual(await response.json(),{schema:1});
});
