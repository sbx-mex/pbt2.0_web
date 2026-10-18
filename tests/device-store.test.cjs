const test=require('node:test'),assert=require('node:assert/strict');
const {createDeviceStore}=require('../js/device-store.js');
function memory(){const map=new Map();return {get length(){return map.size},key:i=>[...map.keys()][i],getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k)};}
function indexed(records=new Map(),fail=false){return {open(){const request={};queueMicrotask(()=>{
 request.result={close(){},transaction(){const tx={};tx.objectStore=()=>({getAll(){const read={};queueMicrotask(()=>{read.result=[...records.values()].map(v=>JSON.parse(JSON.stringify(v)));read.onsuccess?.();tx.oncomplete?.();});return read;},put(value){queueMicrotask(()=>{if(fail)tx.onerror?.();else{records.set(value.key,JSON.parse(JSON.stringify(value)));tx.oncomplete?.();}});}});return tx;}};request.onsuccess?.();});return request;}};}
test('selection, photos and roster survive a new instance without mixing application paths',async()=>{
 const host={localStorage:memory()},a=createDeviceStore(host,'/pbt2.0_web/');await a.ready;
 await a.set('session',{activeTab:'cafe',ceco:'38937'});await a.set('team:38937',{names:['JESSICA'],photos:{1:'data:image/jpeg;base64,YWJj'}});
 const b=createDeviceStore(host,'/pbt2.0_web/'),other=createDeviceStore(host,'/another-project/');await Promise.all([b.ready,other.ready]);
 assert.equal(b.get('session').ceco,'38937');assert.equal(b.get('team:38937').photos[1],'data:image/jpeg;base64,YWJj');assert.equal(other.get('team:38937'),undefined);
 const copy=b.get('team:38937');copy.names[0]='Changed';assert.equal(b.get('team:38937').names[0],'JESSICA');
});
test('IndexedDB retains a photo when localStorage is full, and restores it on reload',async()=>{
 const records=new Map(),local=memory();local.setItem=()=>{throw Error('QuotaExceededError')};
 const host={localStorage:local,indexedDB:indexed(records)},a=createDeviceStore(host,'/pbt/');await a.ready;
 assert.equal(await a.set('team:38134',{names:['ANA'],photos:{1:'data:image/jpeg;base64,YWJj'}}),true);
 const b=createDeviceStore(host,'/pbt/');await b.ready;assert.equal(b.get('team:38134').names[0],'ANA');assert.equal(b.get('team:38134').photos[1],'data:image/jpeg;base64,YWJj');
});
test('blocked storage keeps the session usable and reports that it is not saved',async()=>{
 const local=memory();local.setItem=()=>{throw Error('Blocked')};const a=createDeviceStore({localStorage:local,indexedDB:indexed(new Map(),true)},'/pbt/');await a.ready;
 assert.equal(await a.set('team:38937',{names:['ANA']}),false);assert.equal(a.get('team:38937').names[0],'ANA');
});
test('an older database backup never overwrites newer local edits',async()=>{
 const local=memory(),first=createDeviceStore({localStorage:local},'/pbt/');await first.ready;await first.set('team:38937',{names:['NEW']});
 const records=new Map([['team:38937',{key:'team:38937',updated:1,value:{names:['OLD']}}]]),next=createDeviceStore({localStorage:local,indexedDB:indexed(records)},'/pbt/');await next.ready;assert.equal(next.get('team:38937').names[0],'NEW');
});
test('legacy photos remain recoverable until explicitly linked to one CeCo',async()=>{
 const local=memory();local.setItem('pbt_team_cafe_1','JESSICA');local.setItem('pbt_photo_cafe_JESSICA','data:image/jpeg;base64,YWJj');
 const a=createDeviceStore({localStorage:local},'/pbt/');await a.ready;assert.equal(a.get('team:38937'),undefined);assert.equal(a.legacy('cafe').photos[1],'data:image/jpeg;base64,YWJj');
 await a.set('team:38937',a.legacy('cafe'));await a.set('legacy:cafe',{ceco:'38937'});assert.equal(a.legacy('cafe'),null);assert.equal(local.getItem('pbt_team_cafe_1'),'JESSICA');
});
test('corrupt local entries are ignored without preventing other records from loading',async()=>{
 const local=memory();local.setItem('pbt-device:%2Fpbt%2F:session','{broken');const a=createDeviceStore({localStorage:local},'/pbt/');await a.ready;assert.equal(a.get('session'),undefined);assert.equal(await a.set('session',{activeTab:'dt'}),true);
});
