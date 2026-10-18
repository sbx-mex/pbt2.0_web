(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let handle=null,lastPack=null,kind='repo',label='data/motores/',busy=false,cancelRead=null;
 window.PBT_WEEKLY={active:false,engine:null};
 const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

 window.pbtContextHTML=function(tab){
  return '<div class="op-clock-card" id="'+tab+'_op_clock"><div class="context-top"><span class="op-label">Cálculo</span><button class="context-toggle" id="'+tab+'_mode" type="button" aria-pressed="false" onclick="setCalculationMode(\''+tab+'\')">Automático</button></div><div class="op-time">--/-- · --:--</div><div class="op-context">Weekday · DayPart</div><div class="op-rule">Según el reloj de este dispositivo</div><div class="manual-context" id="'+tab+'_manual_context" hidden><label>Weekday / Weekend<select id="'+tab+'_manual_weekpart" onchange="setManualContext(\''+tab+'\')"><option value="Weekday">Weekday · Lun–Jue</option><option value="Weekend">Weekend · Vie–Dom</option></select></label><label>DayPart<select id="'+tab+'_manual_daypart" onchange="setManualContext(\''+tab+'\')"><option value="Morning">Morning · 06:00–12:00</option><option value="Lunch">Lunch · 12:00–17:00</option><option value="Afternoon">Afternoon · 17:00–06:00</option></select></label></div></div>';
 };
 window.syncCalculationContext=function(tab,ctx){
  const current=state[tab],manual=current.mode==='manual',box=$(tab+'_op_clock');if(!box)return;
  $(tab+'_mode').textContent=manual?'Manual':'Automático';$(tab+'_mode').setAttribute('aria-pressed',String(manual));
  $(tab+'_manual_context').hidden=!manual;
  $(tab+'_manual_weekpart').value=current.filters.weekpart[0]||ctx.weekpart;
  $(tab+'_manual_daypart').value=current.filters.daypart[0]||ctx.daypart;
  box.querySelector('.op-time').textContent=ctx.stamp;
  box.querySelector('.op-context').textContent=current.filters.weekpart[0]+' · '+current.filters.daypart[0];
  box.querySelector('.op-rule').textContent=manual?'Contexto elegido por ti; se conserva hasta cambiarlo.':'Según el reloj de este dispositivo';
 };
 function saveContext(){
  try{localStorage.setItem('pbt-v19-context',JSON.stringify(Object.fromEntries(['cafe','dt'].map(tab=>[tab,{mode:state[tab].mode,weekpart:state[tab].filters.weekpart[0],daypart:state[tab].filters.daypart[0]}]))));}catch{}
 }
 try{
  const saved=JSON.parse(localStorage.getItem('pbt-v19-context')||'{}');
  for(const tab of ['cafe','dt'])if(saved[tab]?.mode==='manual'&&['Weekday','Weekend'].includes(saved[tab].weekpart)&&['Morning','Lunch','Afternoon'].includes(saved[tab].daypart)){
   state[tab].mode='manual';state[tab].filters.weekpart=[saved[tab].weekpart];state[tab].filters.daypart=[saved[tab].daypart];
  }
 }catch{}
 window.setCalculationMode=function(tab){
  state[tab].mode=state[tab].mode==='manual'?'auto':'manual';applyOperationalContext(true);saveContext();
 };
 window.setManualContext=function(tab){
  if(state[tab].mode!=='manual')return;
  const weekpart=$(tab+'_manual_weekpart').value,daypart=$(tab+'_manual_daypart').value;
  if(!['Weekday','Weekend'].includes(weekpart)||!['Morning','Lunch','Afternoon'].includes(daypart))return;
  state[tab].filters.weekpart=[weekpart];state[tab].filters.daypart=[daypart];syncCalculationContext(tab,getOperationalContext());renderDataTab(tab);saveContext();
 };
 function refreshViews(){
  for(const tab of ['cafe','dt']){
   const available=getSourceList('Mes'),stores=getStoreList(tab);
   state[tab].filters.mes=state[tab].filters.mes.filter(value=>available.includes(value));
   state[tab].filters.q=[];state[tab].filters.semana=[];
   state[tab].filters.tienda=state[tab].filters.tienda.filter(value=>stores.includes(value));
   if(!state[tab].filters.tienda.length){$(tab+'_tienda_search').value='';$(tab+'_tienda_selected').textContent='Todas las tiendas';}
  }
  populateFilters();
  for(const tab of ['cafe','dt']){
   for(const input of document.querySelectorAll('#'+tab+'_mes_options input'))input.checked=state[tab].filters.mes.includes(input.value);
   renderDataTab(tab);
  }
 }
 function status(message,isError=false){$('motorStatus').textContent=message;$('motorStatus').classList.toggle('motor-error',isError);$('motorPanel').classList.toggle('motor-has-error',isError);if(isError)$('motorOrigin').textContent=PBT_WEEKLY.active?'CSV activos · nueva lectura sin aplicar':'Base original activa · revisa la lectura CSV';}
 function showFiles(pack){
  $('motorFiles').innerHTML=pack.files.map(file=>'<li><span>'+esc(file.path)+'</span><small>Semana '+esc(file.week.slice(4))+' · '+Number(file.rows).toLocaleString('es-MX')+' registros</small></li>').join('');
  $('motorFolderLabel').textContent=label;
  $('motorSummary').textContent=pack.weeks.length+' semanas · '+pack.stores.length+' tiendas · Unidades';
  $('motorOrigin').textContent='CSV semanales activos';
  $('motorReadAt').textContent='Última lectura: '+new Date().toLocaleString('es-MX');
 }
 async function storage(action,value){
  return new Promise((resolve,reject)=>{
   if(!window.indexedDB){reject(Error('Almacenamiento no disponible'));return;}
   const request=indexedDB.open('pbt-weekly-v19',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('motor');
   request.onerror=()=>reject(request.error);
   request.onsuccess=()=>{const db=request.result;try{const tx=db.transaction('motor',action==='get'?'readonly':'readwrite'),store=tx.objectStore('motor');let result;
    if(action==='get'){const read=store.get('active');read.onsuccess=()=>{result=read.result;};}
    else if(action==='put')store.put(value,'active');else store.delete('active');
    tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=tx.onabort=()=>{db.close();reject(tx.error||Error('No se pudo guardar'));};
   }catch(error){db.close();reject(error);}};
  });
 }
 async function activate(pack,source,sourceKind,nextHandle=null,persist=true){
  const engine=PBT_WEEKLY_CORE.engine(pack); // Validate completely before switching the active source.
  PBT_WEEKLY.engine=engine;PBT_WEEKLY.active=true;lastPack=pack;kind=sourceKind;label=source;handle=nextHandle;
  refreshViews();showFiles(pack);status('Lectura completa. Los porcentajes usan Unidades del CSV.');
  if(persist){try{await storage('put',{pack,label,kind,handle});}catch{
   try{await storage('put',{pack,label,kind});}catch{status('Lectura completa. Respaldo local no disponible; vuelve a abrir la carpeta al recargar.');}
  }}
 }
 function setBusy(value){busy=value;for(const id of ['openMotorFolder','reloadMotorFolder','useOriginalMotor','pickMotorCsv'])$(id).disabled=value;$('cancelMotorRead').hidden=!value;}
 async function loadRepository(){
  const response=await fetch('data/motores/indice.json',{cache:'no-store'});
  if(!response.ok)throw Error('No se encontró el índice publicado. Revisa el workflow o abre tu carpeta CSV.');
  if(Number(response.headers.get('content-length'))>32*1024*1024)throw Error('Índice demasiado grande');
  const text=await response.text();if(text.length>32*1024*1024)throw Error('Índice demasiado grande');
  await activate(JSON.parse(text),'data/motores/','repo');
  if(response.headers.get('X-PBT-Offline')==='1'){status('Sin conexión. Se usa el índice guardado; reconecta y pulsa Releer carpeta para actualizar.');$('motorReadAt').textContent='Lectura de respaldo sin conexión';$('motorOrigin').textContent='CSV activos · respaldo sin conexión';}
 }
 async function readFiles(files,source,nextHandle){
  const selected=files.filter(item=>/\.csv$/i.test(item.path));
  if(!selected.length)throw Error('La carpeta no contiene CSV semanales.');
  if(typeof Worker==='undefined')throw Error('Este navegador no permite leer CSV en segundo plano. Usa Chrome o Edge, o el motor publicado.');
  const pack=await new Promise((resolve,reject)=>{
   const worker=new Worker('js/weekly-worker.js?v=19'),timeout=setTimeout(()=>finish(Error('La lectura tardó demasiado. Conserva la selección anterior e intenta con menos CSV.')),180000);
   function finish(error,pack){clearTimeout(timeout);worker.terminate();cancelRead=null;error?reject(error):resolve(pack);}
   cancelRead=()=>finish(Error('Lectura cancelada. Se conserva el motor anterior.'));
   worker.onmessage=event=>{if(event.data.progress)status('Leyendo '+event.data.progress);else if(event.data.error)finish(Error(event.data.error));else if(event.data.pack)finish(null,event.data.pack);};
   worker.onerror=()=>finish(Error('No se pudo iniciar la lectura. Se conserva el motor anterior.'));
   worker.postMessage({files:selected});
  });
  await activate(pack,source,'local',nextHandle);
 }
 async function enumerate(directory,path='',depth=0,result=[]){
  if(depth>6)throw Error('La carpeta supera seis niveles. Elige la carpeta de motores directamente.');
  for await(const entry of directory.values()){
   if(entry.kind==='directory')await enumerate(entry,path+entry.name+'/',depth+1,result);
   else if(/\.csv$/i.test(entry.name)){
    result.push({path:path+entry.name,file:await entry.getFile()});
    if(result.length>128)throw Error('Máximo 128 CSV por lectura.');
   }
  }
  return result;
 }
 async function run(action){
  if(busy)return;setBusy(true);
  try{await action();}catch(error){if(error.name!=='AbortError')status(error.message||'No terminó la lectura. Se conserva el motor anterior.',true);}
  finally{setBusy(false);}
 }
 async function openFolder(){
  if(!('showDirectoryPicker' in window)){$('motorFolderInput').click();return;}
  await run(async()=>{const next=await showDirectoryPicker({id:'pbt-weekly-motors',mode:'read'});await readFiles(await enumerate(next),next.name,next);});
 }
 async function reload(){
  if(kind==='local'&&!handle){$('motorFolderInput').click();return;}
  await run(async()=>{
   if(kind==='local'){
    if(await handle.queryPermission({mode:'read'})!=='granted'&&await handle.requestPermission({mode:'read'})!=='granted')throw Error('Vuelve a autorizar la lectura de tu carpeta. Se conserva el motor anterior.');
    await readFiles(await enumerate(handle),handle.name,handle);
   }else await loadRepository();
  });
 }
 async function original(){
  if(busy)return;
  PBT_WEEKLY.active=false;PBT_WEEKLY.engine=null;refreshViews();
  $('motorOrigin').textContent='Base original activa';$('motorSummary').textContent='Porcentajes sobre venta · PBT original';$('motorFolderLabel').textContent='js/data.js';
  status('Base original activa. CSV y venta se calculan por separado.');
  try{await storage('put',{original:true,pack:lastPack,label,kind,handle});}catch{try{await storage('put',{original:true,pack:lastPack,label,kind});}catch{}}
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  $('openMotorFolder').addEventListener('click',openFolder);$('reloadMotorFolder').addEventListener('click',reload);$('useOriginalMotor').addEventListener('click',original);
  $('pickMotorCsv').addEventListener('click',()=>$('motorFilesInput').click());$('cancelMotorRead').addEventListener('click',()=>cancelRead?.());
  for(const id of ['motorFolderInput','motorFilesInput'])$(id).addEventListener('change',event=>{
   const input=event.target,files=[...input.files].map(file=>({file,path:file.webkitRelativePath||file.name}));
   if(files.length)run(()=>readFiles(files,files[0].file.webkitRelativePath?.split('/')[0]||'CSV seleccionados',null));input.value='';
  });
  let saved;try{saved=await storage('get');}catch{}
  if(saved?.original){if(saved.pack){lastPack=saved.pack;label=saved.label;kind=saved.kind;handle=saved.handle||null;}original();return;}
  if(saved?.kind==='local'){
   try{await activate(saved.pack,saved.label,'local',saved.handle||null,false);}catch(error){status('No se pudo recuperar tu lectura: '+error.message,true);}
  }else await run(async()=>{
   try{await loadRepository();}catch(error){if(saved?.pack){await activate(saved.pack,saved.label,'repo',null,false);status('Sin conexión. Se recuperó la última lectura guardada.');$('motorOrigin').textContent='CSV activos · respaldo guardado';$('motorReadAt').textContent='Última lectura recuperada';}else throw error;}
  });
 });
})();
