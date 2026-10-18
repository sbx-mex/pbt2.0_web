const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{webcrypto,createHash}=require('node:crypto');
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const core=require('../js/weekly-core.js'),io=require('../js/motor-loader.js');
const directory=require('../js/store-directory.js');
function csvFile(week='202601',units=100){const data=new TextEncoder().encode('Tiendas,Semana,Clas_Semana,DayPart,Distribucion Canal,Mix de Producto,Unidades,Unidades AA\n38101,'+week+',Lun-Jue,1_Mañana,Lobby,Espresso,'+units+',80\n');return {name:'semana-'+week+'.csv',size:data.byteLength,arrayBuffer:async()=>data.buffer};}
async function makePack(week,units){const file=csvFile(week,units);return core.combine([await core.parseMotor(await file.arrayBuffer(),file.name)]);}
function publisher(pack){const text=JSON.stringify(pack)+'\n',manifest={schema:1,index:{path:'indice.json',sha256:createHash('sha256').update(text).digest('hex'),bytes:Buffer.byteLength(text)},files:pack.files.map(({path,week,sha256,bytes})=>({path,week,sha256,bytes}))};return async url=>new Response(url.endsWith('manifest.json')?JSON.stringify(manifest):text);}
function fixture(network,saved){
 let stored=saved,fetcher=network,pausedWorker=false;
 const elements=new Map(),listeners={};
 function node(id){if(!elements.has(id)){const classes=new Set(),events={};elements.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',files:[],events,addEventListener:(type,fn)=>events[type]=fn,querySelectorAll:()=>[],setAttribute(){},focus(){},classList:{toggle:(name,on)=>on?classes.add(name):classes.delete(name)},hasAttribute:()=>false});}return elements.get(id);}
 const indexedDB={open(){const request={};setImmediate(()=>{request.result={close(){},transaction(){let tx={};tx.objectStore=()=>({get(){const read={};setImmediate(()=>{read.result=stored;read.onsuccess();tx.oncomplete();});return read;},put(value){stored=value;setImmediate(()=>tx.oncomplete());}});return tx;}};request.onsuccess();});return request;}};
 class WorkerMock{constructor(){this.terminated=false;}terminate(){this.terminated=true;}postMessage({files}){if(pausedWorker)return;Promise.all(files.map(async item=>core.parseMotor(await item.file.arrayBuffer(),item.path))).then(motors=>{if(!this.terminated)this.onmessage({data:{pack:core.combine(motors)}});}).catch(error=>{if(!this.terminated)this.onmessage({data:{error:error.message}});});}}
 const state=Object.fromEntries(['cafe','dt'].map(tab=>[tab,{mode:'manual',filters:{q:[],semana:[],mes:[],tienda:[],daypart:['Morning'],weekpart:['Weekday']}}]));
 const context={console,Date,Map,Set,Object,JSON,Promise,Number,Array,String,DOMException,AbortController,setTimeout,clearTimeout,Worker:WorkerMock,indexedDB,PBT_WEEKLY_CORE:core,PBT_MOTOR_IO:io,PBT_DIRECTORY:directory,state,activeTab:'cafe',localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:node,addEventListener:(type,fn)=>listeners[type]=fn,querySelectorAll:()=>[]},fetch:(...args)=>fetcher(...args),populateFilters(){},closeMS(){},closeStoreResults(){},pbtStoreLabel:directory.label,renderDataTab(){},getOperationalContext:()=>({weekpart:'Weekday',daypart:'Morning'}),applyOperationalContext(){},getSourceList(type){return context.PBT_WEEKLY.active?(type==='Mes'?context.PBT_WEEKLY.engine.months:[]):[];},getStoreList(tab){return context.PBT_WEEKLY.active?context.PBT_WEEKLY.engine.stores(tab==='dt'?'DT':'CAFE'):[];}};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/weekly-ui.js'),'utf8'),context);
 const idle=async()=>{for(let i=0;i<1000;i++){await new Promise(setImmediate);if(!context.PBT_WEEKLY.loading)return;}throw Error('Source did not settle');};
 return {context,state,node,start:()=>listeners.DOMContentLoaded(),setNetwork:fn=>fetcher=fn,pauseWorker:()=>pausedWorker=true,idle,get stored(){return stored;},async choose(files){node('motorFilesInput').files=files;node('motorFilesInput').events.change({target:node('motorFilesInput')});await idle();}};
}
test('failed initial motor stays blocked and Retry recovers without switching to sale data',async()=>{
 const pack=await makePack(),f=fixture(async()=>new Response('<html>not a motor</html>'));await f.start();assert.equal(f.context.PBT_WEEKLY.ready,false);assert.equal(f.context.PBT_WEEKLY.active,false);assert.equal(f.node('motorUnavailable').hidden,false);
 f.setNetwork(publisher(pack));await f.node('retryMotor').events.click();assert.equal(f.context.PBT_WEEKLY.ready,true);assert.equal(f.context.PBT_WEEKLY.active,true);assert.equal(f.node('motorUnavailable').hidden,true);
});
test('a failed or cancelled reload leaves the previous engine and stored source intact',async()=>{
 const f=fixture(publisher(await makePack()));await f.start();const engine=f.context.PBT_WEEKLY.engine,saved=f.stored;
 f.setNetwork(async()=>new Response('bad',{status:500}));await f.node('reloadMotorFolder').events.click();assert.equal(f.context.PBT_WEEKLY.engine,engine);assert.equal(f.stored,saved);
 f.setNetwork(()=>new Promise(()=>{}));const reading=f.node('reloadMotorFolder').events.click();await new Promise(setImmediate);f.node('cancelMotorRead').events.click();await reading;
 assert.equal(f.context.PBT_WEEKLY.engine,engine);assert.equal(f.context.PBT_WEEKLY.loading,false);assert.equal(f.node('reloadMotorFolder').disabled,false);
});
test('adding local CSV accumulates history, corrects a week, and rejects invalid files atomically',async()=>{
 const f=fixture(publisher(await makePack()));await f.start();await f.choose([csvFile()]);await f.choose([csvFile('202602',120)]);
 assert.equal(f.context.PBT_WEEKLY.engine.pack.files.length,2);assert.equal(f.context.PBT_WEEKLY.engine.calculate({},'CAFE').unidades,220);
 await f.choose([csvFile('202601',75)]);assert.equal(f.context.PBT_WEEKLY.engine.calculate({},'CAFE').unidades,195);
 const before=f.context.PBT_WEEKLY.engine;await f.choose([{name:'broken.csv',size:10,arrayBuffer:async()=>new TextEncoder().encode('bad').buffer}]);assert.equal(f.context.PBT_WEEKLY.engine,before);assert.equal(f.stored.pack.files.length,2);
});
test('restoring a saved local reading preserves its real timestamp when access is unavailable',async()=>{
 const readAt='2026-10-17T08:00:00.000Z',f=fixture(publisher(await makePack()),{pack:await makePack(),label:'Back',kind:'local',readAt});await f.start();
 assert.match(f.node('motorReadAt').textContent,/recuperada/);assert.equal(f.stored.readAt,readAt);assert.equal(f.context.PBT_WEEKLY.engine.pack.files.length,1);assert.equal(f.state.cafe.mode,'manual');
});
test('an authorized saved folder is reread automatically and adds new weeks',async()=>{
 let queried=0;const files=[csvFile(),csvFile('202602',120)],handle={name:'Back',queryPermission:async()=>{queried++;return 'granted';},async *values(){for(const file of files)yield {name:file.name,kind:'file',getFile:async()=>file};}};
 const f=fixture(publisher(await makePack()),{pack:await makePack(),label:'Back',kind:'local',readAt:'2026-10-17T08:00:00.000Z',handle});await f.start();
 assert.equal(queried,1);assert.equal(f.context.PBT_WEEKLY.engine.pack.files.length,2);assert.equal(f.stored.handle,handle);assert.equal(f.state.cafe.filters.tienda.length,0);
});
test('an offline published copy keeps its saved reading date instead of reporting a new read',async()=>{
 const pack=await makePack(),readAt='2026-10-17T08:00:00.000Z',network=publisher(pack),f=fixture(async url=>{const response=await network(url);response.headers.set('X-PBT-Offline','1');return response;},{pack,label:'data/motores/',kind:'repo',readAt});
 await f.start();assert.equal(f.stored.readAt,readAt);assert.match(f.node('motorReadAt').textContent,/recuperada/);assert.match(f.node('motorOrigin').textContent,/sin conexión/);
});
