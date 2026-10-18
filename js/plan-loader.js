/* Same original candidates, runs, routines and coordinates; JSON instead of executable data. */
(function(root){
 'use strict';
 function create(data){
  if(!data||!Array.isArray(data.cafeCandidates)||!Array.isArray(data.dtCandidates)||!Array.isArray(data.playIds)||!data.playRuns||!data.routines||!data.coords)throw Error('Catálogo de planes incompatible.');
  const candidateMaps={},tables={cafe:{},dt:{}};
  data.lookupPlay=function(tab,partners,nearest){
   const candidates=data[tab+'Candidates'],runs=data.playRuns[tab]?.[partners];if(!candidates||!runs)return undefined;
   if(!candidateMaps[tab])candidateMaps[tab]=new Map(candidates.map((value,index)=>[value,index]));
   const index=candidateMaps[tab].get(nearest);if(index===undefined)return undefined;
   if(!tables[tab][partners]){const values=new Uint16Array(candidates.length);let offset=0;for(const [length,play] of runs){values.fill(play,offset,offset+length);offset+=length;}tables[tab][partners]=values;}
   return data.playIds[tables[tab][partners][index]];
  };
  return data;
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={create};return;}
 root.PBT_PLAN={ready:false,loading:true,error:false};
 async function start(){
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
  try{
   const response=await fetch('data/plan/manifest.json?v=27',{cache:'no-cache',signal:controller.signal});
   const raw=await PBT_ASSETS.bytes(response,16384,controller.signal),manifest=JSON.parse(new TextDecoder().decode(raw));
   if(manifest.schema!==1||manifest.index?.path!=='catalog.json')throw Error('Catálogo de planes incompatible.');
   const result=await PBT_ASSETS.text(fetch.bind(root),'data/plan/catalog.json',manifest.index,{signal:controller.signal,max:16*1024*1024});
   root.EXCEL_DATA=create(JSON.parse(result.text));root.PBT_PLAN.ready=true;
  }catch(error){root.PBT_PLAN.error=true;if(root.pbtBootError)root.pbtBootError('No terminó de cargar el catálogo de planes. Revisa tu conexión y vuelve a cargar.');}
  finally{clearTimeout(timeout);root.PBT_PLAN.loading=false;document.dispatchEvent(new CustomEvent('pbt:plan'));}
 }
 start();
})(typeof globalThis!=='undefined'?globalThis:this);
