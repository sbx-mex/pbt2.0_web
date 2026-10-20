/* Bounded gzip/JSON loading. Payloads are validated before becoming active. */
(function(root){
 'use strict';
 async function bytes(response,limit,signal){
  if(!response.ok)throw Error('No se pudo descargar el recurso (HTTP '+response.status+').');
  if(Number(response.headers.get('content-length'))>limit)throw Error('Recurso demasiado grande.');
  if(!response.body?.getReader){const value=new Uint8Array(await response.arrayBuffer());if(value.length>limit)throw Error('Recurso demasiado grande.');return value;}
  const reader=response.body.getReader(),parts=[];let size=0;
  try{while(true){if(signal?.aborted)throw new DOMException('Lectura cancelada','AbortError');const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('Recurso demasiado grande.');parts.push(value);}}
  catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
  const data=new Uint8Array(size);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length;}return data;
 }
 async function digest(data){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');}
 function metadata(meta,limit){if(!meta||!Number.isInteger(meta.bytes)||meta.bytes<1||meta.bytes>limit||!/^[a-f0-9]{64}$/.test(meta.sha256))throw Error('Integridad del recurso no válida.');return meta;}
 async function checked(data,meta){if(data.length!==meta.bytes||await digest(data)!==meta.sha256)throw Error('La descarga no coincide con la versión publicada. Vuelve a intentar.');return data;}
 async function text(fetcher,url,meta,options={}){
  const max=options.max||64*1024*1024;metadata(meta,max);
  let response,data;
  if(meta.gzip&&typeof DecompressionStream==='function'){
   metadata(meta.gzip,max);
   if(!/^[a-zA-Z0-9_-]+\.json\.gz$/.test(meta.gzip.path))throw Error('Ruta comprimida no válida.');
   const target=url.replace(/[^/]*$/,meta.gzip.path)+'?sha256='+meta.gzip.sha256;
   try{
    response=await fetcher(target,{cache:'default',signal:options.signal});
    data=await checked(await bytes(response,meta.gzip.bytes,options.signal),meta.gzip);
    const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
    data=await checked(await bytes(new Response(stream),meta.bytes,options.signal),meta);
   }catch(error){
    if(options.signal?.aborted||error.name==='AbortError')throw error;
    // The independent JSON copy must pass the same length and SHA-256 checks.
    response=await fetcher(url+'?sha256='+meta.sha256,{cache:'no-cache',signal:options.signal});
    data=await bytes(response,meta.bytes,options.signal);
   }
  }else{
   response=await fetcher(url+'?sha256='+meta.sha256,{cache:'default',signal:options.signal});
   data=await bytes(response,meta.bytes,options.signal);
  }
  await checked(data,meta);
  return {text:new TextDecoder('utf-8',{fatal:true}).decode(data),offline:response.headers.get('X-PBT-Offline')==='1'};
 }
 const api={bytes,digest,metadata,checked,text};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PBT_ASSETS=api;
})(typeof globalThis!=='undefined'?globalThis:this);
