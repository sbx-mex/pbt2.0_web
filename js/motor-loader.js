/* Validated, bounded source loading. No UI or changes to the PBT calculation. */
(function(root){
 'use strict';
 const core=typeof module!=='undefined'&&module.exports?require('./weekly-core.js'):root.PBT_WEEKLY_CORE;
 const MAX_INDEX=64*1024*1024,MAX_TOTAL=512*1024*1024;
 const verified=new WeakSet();
 function checkSignal(signal){if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');}
 function abortable(promise,signal){
  if(!signal)return Promise.resolve(promise);
  return new Promise((resolve,reject)=>{let done=false;function finish(error,value){if(done)return;done=true;signal.removeEventListener('abort',abort);error?reject(error):resolve(value);}function abort(){finish(new DOMException('Lectura cancelada','AbortError'));}Promise.resolve(promise).then(value=>finish(null,value),error=>finish(error));if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true});});
 }
 async function boundedText(response,limit,signal){
  checkSignal(signal);
  if(!response.ok)throw Error('No se pudo leer el motor publicado (HTTP '+response.status+').');
  if(Number(response.headers.get('content-length'))>limit)throw Error('El motor supera el tamaño permitido.');
  if(response.body?.getReader){
   const reader=response.body.getReader(),decoder=new TextDecoder();let bytes=0,text='';
   try{while(true){checkSignal(signal);const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>limit)throw Error('El motor supera el tamaño permitido.');text+=decoder.decode(part.value,{stream:true});}return text+decoder.decode();}
   catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  }
  const text=await response.text();checkSignal(signal);if(new TextEncoder().encode(text).length>limit)throw Error('El motor supera el tamaño permitido.');return text;
 }
 async function sha256(text){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
 function validateManifest(manifest){
  if(manifest?.schema!==1||manifest.index?.path!=='indice.json'||!/^[a-f0-9]{64}$/.test(manifest.index.sha256)||!Number.isInteger(manifest.index.bytes)||manifest.index.bytes<1||manifest.index.bytes>MAX_INDEX||!Array.isArray(manifest.files)||!manifest.files.length||manifest.files.length>128)throw Error('Manifiesto de motores incompatible.');
  const weeks=new Set();let total=0;
  for(const file of manifest.files){core.weekInfo(file.week);if(weeks.has(file.week)||typeof file.path!=='string'||!/^.+\.csv$/i.test(file.path)||!/^[a-f0-9]{64}$/.test(file.sha256)||!Number.isInteger(file.bytes)||file.bytes<1||file.bytes>25*1024*1024)throw Error('Manifiesto de motores inválido.');weeks.add(file.week);total+=file.bytes;}
  if(total>MAX_TOTAL)throw Error('El histórico supera 512 MB.');return manifest;
 }
 function sameManifest(left,right){
  if(left.index.sha256!==right.index.sha256||left.index.bytes!==right.index.bytes||left.files.length!==right.files.length)return false;
  const files=new Map(left.files.map(file=>[file.week,file]));
  return right.files.every(file=>{const actual=files.get(file.week);return actual&&['path','sha256','bytes'].every(key=>actual[key]===file[key]);});
 }
 async function restoreRepository(snapshot,signal){
  checkSignal(signal);const manifest=validateManifest(snapshot?.manifest),text=snapshot.text;
  if(typeof text!=='string')throw Error('Respaldo de motores incompatible.');
  if(new TextEncoder().encode(text).length!==manifest.index.bytes||await sha256(text)!==manifest.index.sha256)throw Error('Índice y manifiesto no coinciden. Reintenta cuando termine la publicación.');
  checkSignal(signal);const pack=core.validatePack(JSON.parse(text));
  const files=new Map(pack.files.map(file=>[file.week,file]));
  if(files.size!==manifest.files.length||manifest.files.some(file=>{const actual=files.get(file.week);return !actual||['path','sha256','bytes'].some(key=>actual[key]!==file[key]);}))throw Error('El índice no corresponde a los CSV validados.');
  const result={pack,text,manifest};verified.add(result);return result;
 }
 async function loadRepository(fetcher,signal,previous){
  const options={cache:'no-store',signal};
  const response=await fetcher('data/motores/manifest.json',options),manifest=validateManifest(JSON.parse(await boundedText(response,256*1024,signal)));
  if(previous&&verified.has(previous)&&sameManifest(previous.manifest,manifest)){
   checkSignal(signal);const result={...previous,unchanged:true,offline:response.headers.get('X-PBT-Offline')==='1'};verified.add(result);return result;
  }
  const index=await fetcher('data/motores/indice.json',options),text=await boundedText(index,MAX_INDEX,signal);
  const result=await restoreRepository({manifest,text},signal);
  result.offline=response.headers.get('X-PBT-Offline')==='1'||index.headers.get('X-PBT-Offline')==='1';return result;
 }
 function mergeHistory(previous,incoming){
  core.validatePack(previous);core.validatePack(incoming);
  if(previous.legacyAA||incoming.legacyAA)throw Error('Reabre la carpeta completa para actualizar este respaldo anterior.');
  const incomingWeeks=new Set(incoming.files.map(file=>file.week)),oldFiles=new Map(previous.files.map(file=>[file.week,file]));
  const files=previous.files.filter(file=>!incomingWeeks.has(file.week)).concat(incoming.files).sort((a,b)=>a.week.localeCompare(b.week));
  if(files.length>128||files.reduce((n,file)=>n+file.bytes,0)>MAX_TOTAL)throw Error('El histórico supera 128 semanas o 512 MB.');
  const rows=previous.rows.filter(row=>!incomingWeeks.has(row[1])).concat(incoming.rows).sort((a,b)=>a.slice(0,4).join('|').localeCompare(b.slice(0,4).join('|'),'en'));
  const dt=new Set(files.flatMap(file=>file.dtStores)),codes=[...new Set(rows.map(row=>row[0]))].sort();
  const pack={schema:2,basis:'units',calendar:'PBT-445',files,duplicates:incoming.duplicates||[],weeks:files.map(file=>core.weekInfo(file.week)),stores:codes.map(code=>[code,dt.has(code)?'DT':'CAFE']),rows};
  core.validatePack(pack);if(new TextEncoder().encode(JSON.stringify(pack)).length>MAX_INDEX)throw Error('El índice supera 64 MB.');
  return {pack,changes:{added:incoming.files.filter(file=>!oldFiles.has(file.week)).length,updated:incoming.files.filter(file=>oldFiles.has(file.week)&&oldFiles.get(file.week).sha256!==file.sha256).length,retained:previous.files.filter(file=>!incomingWeeks.has(file.week)).length}};
 }
 const api={abortable,boundedText,validateManifest,restoreRepository,loadRepository,mergeHistory};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PBT_MOTOR_IO=api;
})(typeof globalThis!=='undefined'?globalThis:this);
