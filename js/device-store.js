/* Device-only data, isolated by application path. Never part of a motor or export. */
(function(root){
 'use strict';
 function createDeviceStore(host,scope){
  const prefix='pbt-device:'+encodeURIComponent(scope)+':',records=new Map(),pending=new Set();
  let db=null,tick=Date.now();
  const copy=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
  const valid=r=>r&&typeof r.key==='string'&&/^(session|team:\d{3,8}|legacy:(cafe|dt))$/.test(r.key)&&Number.isFinite(r.updated)&&r.value&&typeof r.value==='object';
  const accept=r=>{if(valid(r)){tick=Math.max(tick,r.updated);if(!records.has(r.key)||records.get(r.key).updated<r.updated)records.set(r.key,r);}};
  try{for(let i=0;i<host.localStorage.length;i++){const k=host.localStorage.key(i);if(k&&k.startsWith(prefix)){try{accept(JSON.parse(host.localStorage.getItem(k)));}catch{}}}}catch{}
  const ready=new Promise(resolve=>{
   let finished=false;const finish=()=>{if(finished)return;finished=true;clearTimeout(timer);resolve();},timer=setTimeout(finish,2500);
   try{
    if(!host.indexedDB){finish();return;}
    const request=host.indexedDB.open(prefix+'profiles',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('records',{keyPath:'key'});
    request.onerror=request.onblocked=finish;
    request.onsuccess=()=>{
     if(finished){request.result.close();return;}db=request.result;db.onversionchange=()=>{db.close();db=null;};
     try{const tx=db.transaction('records','readonly'),read=tx.objectStore('records').getAll();
      read.onsuccess=()=>{if(!finished)for(const record of read.result)accept(record);};
      tx.oncomplete=tx.onerror=tx.onabort=finish;
     }catch{finish();}
    };
   }catch{finish();}
  });
  function mirror(record){return new Promise(resolve=>{
   if(!db){resolve(false);return;}let done=false;const timer=setTimeout(()=>finish(false),2500);
   function finish(ok){if(done)return;done=true;clearTimeout(timer);resolve(ok);}
   try{const tx=db.transaction('records','readwrite');tx.objectStore('records').put(record);tx.oncomplete=()=>finish(true);tx.onerror=tx.onabort=()=>finish(false);}catch{finish(false);}
  });}
  function set(key,value){
   const old=records.get(key),snapshot=copy(value);if(old&&JSON.stringify(old.value)===JSON.stringify(snapshot))return Promise.resolve(old.saved!==false);
   const record={key,value:snapshot,updated:Math.max(Date.now(),++tick)};if(!valid(record))throw Error('Dato local inválido');records.set(key,record);
   let local=false;try{host.localStorage.setItem(prefix+key,JSON.stringify(record));local=true;}catch{}
   const operation=mirror(record).then(indexed=>{record.saved=local||indexed;return record.saved;});pending.add(operation);operation.finally(()=>pending.delete(operation));return operation;
  }
  function legacy(tab){
   if(records.has('legacy:'+tab))return null;
   const names=[],photos={},assignments={};try{
    for(let i=1;i<=(tab==='cafe'?21:30);i++){const name=String(host.localStorage.getItem('pbt_team_'+tab+'_'+i)||'').slice(0,8);names.push(name);const photo=name&&host.localStorage.getItem('pbt_photo_'+tab+'_'+name);if(/^data:image\/(?:jpeg|png);base64,/.test(photo||''))photos[i]=photo;}
    for(const letter of 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'){const name=host.localStorage.getItem('pbt_assign_'+tab+'_'+letter)||host.localStorage.getItem('pbt_'+tab+'_partner_'+letter);if(name)assignments[letter]=String(name).slice(0,8);}
   }catch{}
   return names.some(Boolean)||Object.keys(assignments).length?{names,photos,assignments}:null;
  }
  function requestPersistence(){try{const storage=host.navigator&&host.navigator.storage;if(storage&&storage.persist)Promise.resolve(storage.persist()).catch(()=>{});}catch{}}
  return {ready,get:key=>copy(records.get(key)?.value),set,legacy,requestPersistence,flush:()=>Promise.all([...pending])};
 }
 if(typeof module!=='undefined'&&module.exports)module.exports={createDeviceStore};
 else root.PBT_DEVICE=createDeviceStore(root,root.location.pathname.replace(/index\.html$/,''));
})(typeof globalThis!=='undefined'?globalThis:this);
