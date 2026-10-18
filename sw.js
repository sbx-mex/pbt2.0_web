const CACHE_PREFIX='pbt2-web-'+encodeURIComponent(new URL(self.registration.scope).pathname)+'-';
const CACHE_NAME=CACHE_PREFIX+'v26-shell',DATA_CACHE=CACHE_PREFIX+'v20-data';
const SHELL_FILES=['./','./index.html','./js/plan-catalog.js?v=26','./manifest.json','./css/styles.css?v=25','./js/app.js?v=24','./js/store-directory.js?v=24','./js/weekly-core.js?v=26','./js/motor-loader.js?v=26','./js/device-store.js?v=24','./js/device-ui.js?v=25','./js/weekly-ui.js?v=26','./js/weekly-worker.js?v=26','./js/print.js?v=24','./js/sheet-template.js?v=24','./js/pdf-renderer.js?v=24','./js/vendor/pdf-lib.min.js?v=1.17.1','./data/project.json?v=24','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(SHELL_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('pbt2-web-')&&key!==CACHE_NAME&&key!==DATA_CACHE).map(async key=>{
  if(key.startsWith(CACHE_PREFIX))return caches.delete(key);
  if(!/^pbt2-web-v\d/.test(key))return;
  const cache=await caches.open(key);
  for(const request of await cache.keys())if(request.url.startsWith(self.registration.scope))await cache.delete(request);
  if(!(await cache.keys()).length)await caches.delete(key);
 }))).then(async()=>{const cache=await caches.open(DATA_CACHE);for(const request of await cache.keys())if(/\/js\/data\.js$/.test(new URL(request.url).pathname))await cache.delete(request);}).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 if(event.request.method!=='GET')return;
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 const isIndex=/\/data\/motores\/(?:indice|manifest)\.json$/.test(url.pathname);
 const isEngine=/\/js\/excel_data\.js$/.test(url.pathname);
 const isNavigation=event.request.mode==='navigate';
 if(isIndex||isNavigation){
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
   try{const response=await fetch(event.request);if(!response.ok)throw Error('HTTP '+response.status);if(isIndex){const copy=response.clone();await copy.json();}await cache.put(event.request,response.clone()).catch(()=>{});return response;}
   catch(error){const cached=await cache.match(event.request);if(cached){if(isIndex){const headers=new Headers(cached.headers);headers.set('X-PBT-Offline','1');return new Response(cached.body,{status:cached.status,headers});}return cached;}if(isNavigation){const index=await cache.match('./index.html');if(index)return index;}return new Response('Recurso no disponible sin conexión',{status:503,headers:{'Content-Type':'text/plain;charset=utf-8'}});}
  }));return;
 }
 event.respondWith(caches.open(isEngine?DATA_CACHE:CACHE_NAME).then(async cache=>{
  const saved=await cache.match(event.request);if(saved)return saved;
  const response=await fetch(event.request);if(response.ok)cache.put(event.request,response.clone()).catch(()=>{});return response;
 }));
});
