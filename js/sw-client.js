(function(){
 'use strict';
 if(!('serviceWorker' in navigator))return;
 let wasControlled=!!navigator.serviceWorker.controller;
 const show=()=>{if(wasControlled){const notice=document.getElementById('updateNotice');if(notice)notice.hidden=false;}wasControlled=true;};
 navigator.serviceWorker.addEventListener('controllerchange',show);
 window.addEventListener('load',function(){navigator.serviceWorker.register('./sw.js?v=27',{updateViaCache:'none'}).then(reg=>reg.update()).catch(()=>{});});
 document.addEventListener('DOMContentLoaded',function(){document.getElementById('applyUpdate').addEventListener('click',async function(){this.disabled=true;if(window.PBT_DEVICE)await PBT_DEVICE.flush();location.reload();});});
})();
