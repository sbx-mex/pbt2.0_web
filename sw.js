const CACHE_PREFIX='pbt2-web-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE_NAME=CACHE_PREFIX+'v27-__PBT_BUILD__-shell',DATA_CACHE=CACHE_PREFIX+'v27-data';
const SHELL_FILES=['./','./index.html','./manifest.json','./icons/icon-192.png','./icons/icon-512.png','./css/base.css?v=27','./css/styles.css?v=27','./css/batch.css?v=27','./js/batch-core.js?v=27','./js/batch-snapshot.js?v=27','./js/batch-ui.js?v=27','./js/boot.js?v=27','./js/asset-loader.js?v=27','./js/plan-loader.js?v=27','./js/weeks.js?v=27','./js/ui.js?v=27','./js/events.js?v=27','./js/app.js?v=27','./js/sw-client.js?v=27','./js/store-directory.js?v=27','./js/weekly-core.js?v=27','./js/motor-loader.js?v=27','./js/device-store.js?v=27','./js/device-ui.js?v=27','./js/weekly-ui.js?v=27','./js/weekly-worker.js?v=27','./js/print.js?v=27','./js/sheet-template.js?v=27','./js/pdf-renderer.js?v=27','./js/vendor/pdf-lib.min.js?v=27','./data/project.json?v=27'];
const PLAN_FILES={};
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll([...SHELL_FILES,...(PLAN_FILES.manifest?[PLAN_FILES.manifest,typeof DecompressionStream==='function'?PLAN_FILES.gzip:PLAN_FILES.plain]:[])])).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pbt2-web-')&&key!==CACHE_NAME&&key!==DATA_CACHE).map(async key=>{
  if(key.startsWith(CACHE_PREFIX))return caches.delete(key);
  if(!/^pbt2-web-v\d/.test(key))return;
  const cache=await caches.open(key);for(const request of await cache.keys())if(request.url.startsWith(self.registration.scope))await cache.delete(request);
  if(!(await cache.keys()).length)await caches.delete(key);
 }))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin||!url.href.startsWith(self.registration.scope))return;
 // Old data scripts are deliberately no longer cached or served as a fallback.
 if(/\/js\/(?:data|excel_data)\.js$/.test(url.pathname))return;
 const payload=url.searchParams.has('sha256');
 const mutable=/\/data\/(?:motores|plan)\/(?:indice|manifest)\.json$/.test(url.pathname)&&!payload;
 const navigation=event.request.mode==='navigate';
 event.respondWith(caches.open(payload?DATA_CACHE:CACHE_NAME).then(async cache=>{
  if(!mutable&&!navigation){const saved=await cache.match(event.request)||(payload?await(await caches.open(CACHE_NAME)).match(event.request):null);if(saved)return saved;}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),mutable||navigation?7000:45000);
  try{
   const response=await fetch(event.request,{signal:controller.signal});if(!response.ok)throw Error('HTTP '+response.status);
   if(mutable){const copy=response.clone();await copy.json();}
   const write=cache.put(event.request,response.clone()).then(async()=>{if(payload){const keys=await cache.keys();for(const old of keys.slice(0,Math.max(0,keys.length-8)))await cache.delete(old);}}).catch(()=>{});if(event.waitUntil)event.waitUntil(write);else await write;
   return response;
  }catch(error){
   const saved=await cache.match(event.request);
   if(saved){if(mutable){const headers=new Headers(saved.headers);headers.set('X-PBT-Offline','1');return new Response(saved.body,{status:saved.status,headers});}return saved;}
   if(navigation){const index=await cache.match('./index.html');if(index)return index;}
   return new Response('Recurso no disponible. Reconecta y vuelve a intentar.',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});
  }finally{clearTimeout(timer);}
 }));
});
