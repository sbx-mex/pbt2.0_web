/* Runs before deferred modules: a failed dependency must never leave a blank screen. */
(function(){
 'use strict';
 let message='';
 function display(){const box=document.getElementById('bootError'),text=document.getElementById('bootMessage');if(box&&message){box.hidden=false;text.textContent=message;}const loading=document.getElementById('appLoading');if(loading&&message)loading.hidden=true;}
 window.pbtBootError=function(value){message=value;display();};
 window.addEventListener('error',function(event){
  if(event.target?.tagName==='SCRIPT'||event.target?.tagName==='LINK')pbtBootError('No se pudo descargar un archivo de la aplicación. Vuelve a cargar para recuperar la versión actual.');
  else if(event.error)pbtBootError('No se pudo completar la vista. Vuelve a cargar; tu equipo y filtros guardados se conservan.');
 },true);
 window.addEventListener('unhandledrejection',function(){pbtBootError('La operación no terminó. Vuelve a cargar para recuperar el último estado guardado.');});
 document.addEventListener('DOMContentLoaded',function(){
  display();document.getElementById('retryApp').addEventListener('click',()=>location.reload());
  if(location.protocol==='file:')pbtBootError('Abre el proyecto con INICIAR_PBT.bat o python iniciar.py. Esta aplicación necesita una dirección HTTP local.');
 });
 setTimeout(function(){if(!window.PBT_UI_READY)pbtBootError('El inicio tardó demasiado. Revisa tu conexión y vuelve a cargar.');},20000);
})();
