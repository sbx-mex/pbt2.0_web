'use strict';
importScripts('./weekly-core.js?v=19');
self.onmessage=async function(event){
 try{
  const files=event.data.files;
  if(!Array.isArray(files)||!files.length||files.length>128||files.reduce((n,item)=>n+item.file.size,0)>512*1024*1024)throw Error('Selecciona entre 1 y 128 CSV; máximo 512 MB');
  const motors=[];
  for(let i=0;i<files.length;i++){
   const item=files[i];self.postMessage({progress:(i+1)+'/'+files.length+' · '+item.path});
   motors.push(await PBT_WEEKLY_CORE.parseMotor(await item.file.arrayBuffer(),item.path));
  }
  const pack=PBT_WEEKLY_CORE.combine(motors);PBT_WEEKLY_CORE.validatePack(pack);self.postMessage({pack});
 }catch(error){self.postMessage({error:error.message||'No se pudo leer la carpeta'});}
};
