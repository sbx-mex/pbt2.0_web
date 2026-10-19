(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 let handle=null,lastPack=null,lastRepository=null,kind='repo',label='data/motores/',busy=false,cancelRead=null,lastReadAt=null,mergeFolderInput=false;
 window.PBT_WEEKLY={active:false,engine:null,ready:false,loading:true,error:false};
 const esc=value=>String(value||'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));

 window.pbtWeekLabel=value=>value==='Weekend'?'Vie–Dom':'Lun–Jue';
 window.pbtDayLabel=value=>({Morning:'Mañana',Lunch:'Intermedio',Afternoon:'Tarde'}[value]||value||'');
 window.pbtContextHTML=function(tab){
  return '<div class="op-clock-card" id="'+tab+'_op_clock"><div class="context-top"><span class="op-label">Cálculo</span><button class="context-toggle" id="'+tab+'_mode" type="button" aria-pressed="false" data-click="mode" data-tab="'+tab+'">Automático</button></div><div class="manual-context" id="'+tab+'_manual_context"><label for="'+tab+'_manual_weekpart">Días de la semana<select id="'+tab+'_manual_weekpart" data-change="context" data-tab="'+tab+'"><option value="Weekday">Lun–Jue</option><option value="Weekend">Vie–Dom</option></select></label><label for="'+tab+'_manual_daypart">Turno<select id="'+tab+'_manual_daypart" data-change="context" data-tab="'+tab+'"><option value="Morning">Mañana</option><option value="Lunch">Intermedio</option><option value="Afternoon">Tarde</option></select></label></div></div>';
 };
 window.syncCalculationContext=function(tab,ctx){
  const current=state[tab],manual=current.mode==='manual',box=$(tab+'_op_clock');if(!box)return;
  $(tab+'_mode').textContent=manual?'Manual':'Automático';$(tab+'_mode').setAttribute('aria-pressed',String(manual));
  $(tab+'_manual_weekpart').value=current.filters.weekpart[0]||ctx.weekpart;
  $(tab+'_manual_daypart').value=current.filters.daypart[0]||ctx.daypart;
 };
 window.updateAboutContext=function(){
  const tab=activeTab,selected=state[tab]?.filters.tienda.length===1;
  for(const name of ['cafe','dt'])$(name+'_audit_section').hidden=!selected||name!==tab;
  $('aboutContext').textContent=selected?pbtStoreLabel(state[tab].filters.tienda[0])+' · '+(state[tab].filters.mes.join(', ')||'Meses disponibles')+(state[tab].filters.semana?.length?' · '+PBT_WEEKS.label(state[tab].filters.semana):'')+' · '+pbtWeekLabel(state[tab].filters.weekpart[0])+' · '+pbtDayLabel(state[tab].filters.daypart[0]):'Elige una tienda en Café o DT para consultar sus unidades.';
 };
 window.openAbout=function(){
  updateAboutContext();const dialog=$('aboutDialog');$('aboutButton').setAttribute('aria-expanded','true');
  if(!dialog.open){if(dialog.showModal)dialog.showModal();else dialog.setAttribute('open','');}
  dialog.setAttribute('aria-modal','true');
 };
 window.closeAbout=function(){const dialog=$('aboutDialog');if(dialog.close)dialog.close();else dialog.removeAttribute('open');dialog.removeAttribute('aria-modal');$('aboutButton').setAttribute('aria-expanded','false');$('aboutButton').focus();};
 window.pbtAuditHTML=()=>'';
 window.renderPBTAudit=function(tab,data){
  const box=$(tab+'_audit');if(!box)return;
  if(data.basis!=='units'||!data.units){box.textContent='Sin datos para este filtro.';return;}
  const n=value=>value==null?'No disponible':Number(value).toLocaleString('es-MX',{maximumFractionDigits:2}),total=data.unidades;
  const row=(name,value,aa)=>'<tr><td>'+esc(name)+'</td><td>'+n(value)+'</td><td>'+n(aa)+'</td></tr>';
  const table=(title,units,aa)=>'<h3>'+title+'</h3><table><thead><tr><th>Concepto</th><th>Unidades</th><th>Unidades AA</th></tr></thead><tbody>'+Object.entries(units).filter(([key])=>key!=='DT'||tab==='dt').map(([key,value])=>row(key==='Café filtrado'?'COD':key,value,aa?.[key])).join('')+row('Total',total,data.unidadesAA)+'</tbody></table>';
  box.innerHTML='<p>Mismos meses, semanas, tienda, días y turno que la vista. Cada porcentaje = unidades de la categoría ÷ unidades totales seleccionadas. El cierre a 100% reparte el residuo de redondeo entre las categorías; no modifica las unidades.</p>'+table('Distribución de canal',data.units.channels,data.aa?.channels)+table('Mix de producto',data.units.mix,data.aa?.mix)+'<h3>Comparativo por semana</h3><table><thead><tr><th>Semana actual / AA</th><th>Unidades</th><th>Unidades AA</th></tr></thead><tbody>'+data.weekly.map(item=>row(item.week.slice(0,4)+' · S'+item.week.slice(4)+' / '+(Number(item.week.slice(0,4))-1)+' · S'+item.week.slice(4),item.units,item.unitsAA)).join('')+'</tbody></table><p>AA es el valor informado por el CSV para el año anterior; nunca se suma al denominador actual. '+(data.hasAA?'':'AA requiere datos publicados con la columna Unidades AA.')+'</p>';
 };
 function saveContext(){
  try{localStorage.setItem('pbt-v19-context',JSON.stringify(Object.fromEntries(['cafe','dt'].map(tab=>[tab,{mode:state[tab].mode,weekpart:state[tab].filters.weekpart[0],daypart:state[tab].filters.daypart[0]}]))));}catch{}
 }
 window.savePBTContext=saveContext;
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
  state[tab].mode='manual';
  const weekpart=$(tab+'_manual_weekpart').value,daypart=$(tab+'_manual_daypart').value;
  if(!['Weekday','Weekend'].includes(weekpart)||!['Morning','Lunch','Afternoon'].includes(daypart))return;
  state[tab].filters.weekpart=[weekpart];state[tab].filters.daypart=[daypart];syncCalculationContext(tab,getOperationalContext());renderDataTab(tab);saveContext();
 };
 function notifySource(){
  const unavailable=$('motorUnavailable');if(unavailable)unavailable.hidden=PBT_WEEKLY.ready||PBT_WEEKLY.loading||!PBT_WEEKLY.error;
  if(typeof CustomEvent==='function')document.dispatchEvent(new CustomEvent('pbt:source'));
 }
 function refreshViews(){
  for(const tab of ['cafe','dt']){
   const available=getSourceList('Mes'),stores=getStoreList(tab),previous=state[tab].filters.tienda[0],months=state[tab].filters.mes;
   const remaining=months.filter(value=>available.includes(value));
   state[tab].filters.mes=months.length&&!remaining.length?months:remaining;state[tab].filters.q=[];
   const code=previous&&PBT_DIRECTORY.codeOf(previous),matching=previous&&(stores.includes(previous)?previous:(code?stores.find(value=>PBT_DIRECTORY.codeOf(value)===code):null));
   state[tab].filters.tienda=matching?[matching]:[];$(tab+'_tienda_search').value=matching?pbtStoreLabel(matching):'';closeStoreResults(tab);closeMS(tab,'mes',false);
  }
  populateFilters();applyOperationalContext(true);if(!$('equipo').hidden&&window.buildEquipo)buildEquipo();notifySource();
 }
 function status(message,isError=false){$('motorStatus').textContent=message;$('motorStatus').classList.toggle('motor-error',isError);$('motorPanel').classList.toggle('motor-has-error',isError);if(isError)$('motorOrigin').textContent=PBT_WEEKLY.active?'CSV activos · nueva lectura sin aplicar':'Motor CSV no disponible';}
 function showFiles(pack,cached=false){
  $('motorFiles').innerHTML=pack.files.map(file=>'<li><span>'+esc(file.path)+'</span><small>'+esc(file.week.slice(0,4))+' · S'+esc(file.week.slice(4))+' · '+Number(file.rows).toLocaleString('es-MX')+' registros</small></li>').join('');
  $('motorFolderLabel').textContent=label;$('motorSummary').textContent=pack.weeks.length+' semanas · '+pack.stores.length+' tiendas · Unidades';$('motorOrigin').textContent=cached?'CSV activos · respaldo guardado':'CSV semanales activos';
  $('motorReadAt').textContent=lastReadAt?'Última lectura: '+new Date(lastReadAt).toLocaleString('es-MX')+(cached?' · recuperada':''):'Respaldo sin fecha de lectura';
 }
 async function storage(action,value){
  return new Promise((resolve,reject)=>{
   if(!window.indexedDB){reject(Error('Almacenamiento no disponible'));return;}
   let db,finished=false;const timeout=setTimeout(()=>finish(Error('Almacenamiento sin respuesta')),8000);
   function finish(error,result){if(finished)return;finished=true;clearTimeout(timeout);if(db)db.close();error?reject(error):resolve(result);}
   const request=indexedDB.open('pbt-weekly-v19',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('motor');request.onerror=()=>finish(request.error);
   request.onsuccess=()=>{db=request.result;if(finished){db.close();return;}try{const tx=db.transaction('motor',action==='get'?'readonly':'readwrite'),store=tx.objectStore('motor');let result;
    if(action==='get'){const read=store.get('active');read.onsuccess=()=>{result=read.result;};}else if(action==='put')store.put(value,'active');else store.delete('active');
    tx.oncomplete=()=>finish(null,result);tx.onerror=tx.onabort=()=>finish(tx.error||Error('No se pudo guardar'));
   }catch(error){finish(error);}};
  });
 }
 async function persistSource(){
  const value={label,kind,handle,readAt:lastReadAt,...(kind==='repo'&&lastRepository?{repository:{text:lastRepository.text,manifest:lastRepository.manifest}}:{pack:lastPack})};
  try{await storage('put',value);return true;}catch{delete value.handle;try{await storage('put',value);return true;}catch{return false;}}
 }
 async function activate(pack,source,sourceKind,nextHandle=null,options={},operation){
  pack=PBT_WEEKLY_CORE.migratePack(pack);const engine=PBT_WEEKLY_CORE.engine(pack);
  const missing=pack.stores.find(([code])=>!PBT_DIRECTORY.lookup('CeCo '+code).name);if(missing)throw Error('CeCo '+missing[0]+' sin nombre en Directorio_PBT. Actualiza el directorio.');
  if(operation?.signal.aborted)throw new DOMException('Lectura cancelada','AbortError');
  if(operation){operation.committed=true;$('cancelMotorRead').hidden=true;}
  PBT_WEEKLY.engine=engine;PBT_WEEKLY.active=true;PBT_WEEKLY.ready=true;PBT_WEEKLY.error=false;lastPack=pack;kind=sourceKind;label=source;handle=nextHandle;
  lastRepository=sourceKind==='repo'?(options.repository||null):null;
  lastReadAt=options.readAt&&Number.isFinite(Date.parse(options.readAt))?options.readAt:(options.cached?null:new Date().toISOString());
  refreshViews();showFiles(pack,!!options.cached);$('motorChanges').textContent=options.changes?options.changes.added+' nuevas · '+options.changes.updated+' actualizadas · '+options.changes.retained+' conservadas':'';
  status(options.cached?'Respaldo validado. Se comprobarán los datos publicados al iniciar.':(pack.legacyAA?'El respaldo no incluye AA por segmento.':(pack.files.every(file=>file.hasAA)?'Lectura completa. Unidades actuales y AA conciliadas.':'Lectura completa. AA no disponible en todas las semanas.')));
  if(options.persist!==false&&!await persistSource())status('Lectura completa. El navegador no pudo guardar el respaldo.');
 }
 function setBusy(value){busy=value;PBT_WEEKLY.loading=value;for(const id of ['openMotorFolder','reloadMotorFolder','pickMotorCsv','retryMotor']){const button=$(id);if(button)button.disabled=value;}$('cancelMotorRead').hidden=!value||!cancelRead;for(const tab of ['cafe','dt'])renderDataTab(tab);notifySource();}
 async function loadRepository(operation){
  const result=await PBT_MOTOR_IO.loadRepository(fetch.bind(window),operation.signal,lastRepository);
  if(result.unchanged&&kind==='repo'&&PBT_WEEKLY.ready&&result.pack===lastPack){
   if(operation.signal.aborted)throw new DOMException('Lectura cancelada','AbortError');
   lastRepository=result;showFiles(lastPack,result.offline);status(result.offline?'Sin conexión. Se usa el último motor validado.':'Motores al día.');
   if(result.offline)$('motorOrigin').textContent='CSV activos · respaldo sin conexión';return;
  }
  const identity=pack=>pack?.files?.map(file=>file.week+':'+file.sha256).sort().join('|'),readAt=identity(lastPack)===identity(result.pack)?lastReadAt:null;
  await activate(result.pack,'data/motores/','repo',null,{repository:result,...(result.offline?{cached:true,readAt}:{})},operation);
  if(result.offline){status('Sin conexión. Se usa el último motor validado. Recarga la página al reconectar.');$('motorOrigin').textContent='CSV activos · respaldo sin conexión';}
 }
 async function readFiles(files,source,nextHandle,merge,operation){
  const selected=files.filter(item=>/\.csv$/i.test(item.path)).sort((a,b)=>a.path.localeCompare(b.path,'es'));
  if(!selected.length)throw Error('La carpeta no contiene CSV semanales.');
  if(selected.length>128||selected.some(item=>!item.file.size||item.file.size>25*1024*1024)||selected.reduce((sum,item)=>sum+item.file.size,0)>512*1024*1024)throw Error('Máximo 128 CSV, 25 MB por archivo y 512 MB por lectura.');
  if(typeof Worker==='undefined')throw Error('Este navegador no permite leer archivos locales. Usa Releer carpeta para cargar los motores publicados.');
  if(operation.signal.aborted)throw new DOMException('Lectura cancelada','AbortError');
  let pack=await new Promise((resolve,reject)=>{
   const worker=new Worker('js/weekly-worker.js?v=27');let finished=false;
   function finish(error,value){if(finished)return;finished=true;operation.signal.removeEventListener('abort',aborted);worker.terminate();error?reject(error):resolve(value);}
   function aborted(){finish(new DOMException('Lectura cancelada','AbortError'));}operation.signal.addEventListener('abort',aborted,{once:true});
   worker.onmessage=event=>{if(event.data.progress)status('Leyendo '+event.data.progress);else if(event.data.error)finish(Error(event.data.error));else if(event.data.pack)finish(null,event.data.pack);};
   worker.onerror=()=>finish(Error('No se pudo iniciar la lectura. Se conserva el motor anterior.'));worker.postMessage({files:selected});
  });
  let changes;if(merge&&lastPack){const result=PBT_MOTOR_IO.mergeHistory(lastPack,pack);pack=result.pack;changes=result.changes;}
  await activate(pack,source,'local',nextHandle,{changes},operation);
 }
 async function enumerate(directory,signal,path='',depth=0,result=[]){
  if(signal.aborted)throw new DOMException('Lectura cancelada','AbortError');if(depth>6)throw Error('Elige la carpeta de motores directamente: máximo seis niveles.');
  for await(const entry of directory.values()){
   if(signal.aborted)throw new DOMException('Lectura cancelada','AbortError');
   if(entry.kind==='directory')await enumerate(entry,signal,path+entry.name+'/',depth+1,result);
   else if(/\.csv$/i.test(entry.name)){const file=await entry.getFile();result.push({path:path+entry.name,file});if(result.length>128||!file.size||file.size>25*1024*1024||result.reduce((sum,item)=>sum+item.file.size,0)>512*1024*1024)throw Error('Máximo 128 CSV, 25 MB por archivo y 512 MB por lectura.');}
  }
  return result;
 }
 async function run(action){
  if(busy)return;const controller=new AbortController(),operation={signal:controller.signal,committed:false};let timedOut=false;
  cancelRead=()=>{if(!operation.committed)controller.abort();};setBusy(true);
  const timeout=setTimeout(()=>{timedOut=true;cancelRead?.();},180000);
  try{await PBT_MOTOR_IO.abortable(Promise.resolve().then(()=>action(operation)),operation.signal);}catch(error){PBT_WEEKLY.error=!PBT_WEEKLY.ready;status(error.name==='AbortError'?(timedOut?'La lectura tardó demasiado. Reintenta; se conserva el motor anterior.':'Lectura cancelada. Se conserva el motor anterior.'):(error.message||'No terminó la lectura. Se conserva el motor anterior.'),error.name!=='AbortError'||!PBT_WEEKLY.ready);}
  finally{clearTimeout(timeout);cancelRead=null;setBusy(false);}
 }
 async function openFolder(){
  mergeFolderInput=false;if(!('showDirectoryPicker' in window)){$('motorFolderInput').click();return;}
  await run(async operation=>{const next=await showDirectoryPicker({id:'pbt-weekly-motors',mode:'read'}),same=kind==='local'&&handle&&typeof next.isSameEntry==='function'&&await next.isSameEntry(handle);await readFiles(await enumerate(next,operation.signal),next.name,next,!!same,operation);});
 }
 async function reload(){
  if(kind==='local'&&!handle){mergeFolderInput=true;$('motorFolderInput').click();return;}
  await run(async operation=>{
   if(kind==='local'){if(await handle.queryPermission({mode:'read'})!=='granted'&&await handle.requestPermission({mode:'read'})!=='granted')throw Error('Vuelve a autorizar tu carpeta. Se conserva el motor anterior.');await readFiles(await enumerate(handle,operation.signal),handle.name,handle,true,operation);}
   else await loadRepository(operation);
  });
 }
 document.addEventListener('DOMContentLoaded',async()=>{
  $('directorySummary').textContent='Busca por CeCo o tienda. El directorio aporta los nombres; los CSV determinan las tiendas disponibles.';
  $('aboutDialog').addEventListener('close',()=>{$('aboutButton').setAttribute('aria-expanded','false');$('aboutButton').focus();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&$('aboutDialog').hasAttribute('open'))closeAbout();});
  $('openMotorFolder')?.addEventListener('click',openFolder);$('reloadMotorFolder')?.addEventListener('click',reload);$('retryMotor').addEventListener('click',()=>run(loadRepository));
  $('pickMotorCsv')?.addEventListener('click',()=>$('motorFilesInput').click());$('cancelMotorRead').addEventListener('click',()=>cancelRead?.());
  for(const id of ['motorFolderInput','motorFilesInput'])$(id)?.addEventListener('change',event=>{
   const input=event.target,files=[...input.files].map(file=>({file,path:file.webkitRelativePath||file.name})),merge=kind==='local'&&(id==='motorFilesInput'||mergeFolderInput);mergeFolderInput=false;
   if(files.length)run(operation=>readFiles(files,files[0].file.webkitRelativePath?.split('/')[0]||'CSV seleccionados',null,merge,operation));input.value='';
  });
  const savedReading=storage('get').catch(()=>null);
  if(window.PBT_DEVICE){await PBT_DEVICE.ready;if(window.restorePBTSession)restorePBTSession();}
  setBusy(true);const saved=await savedReading;setBusy(false);
  if(saved?.kind==='local'){
   try{await activate(saved.pack,saved.label,'local',saved.handle||null,{persist:false,cached:true,readAt:saved.readAt});}catch(error){status('No se pudo recuperar tu lectura: '+error.message,true);}
   if(PBT_WEEKLY.ready&&handle){await run(async operation=>{if(await handle.queryPermission({mode:'read'})==='granted')await readFiles(await enumerate(handle,operation.signal),handle.name,handle,true,operation);});}
   else if(!PBT_WEEKLY.ready)await run(loadRepository);
  }else{
   if(saved?.repository||saved?.pack){
    try{
     const repository=saved.repository?await PBT_MOTOR_IO.restoreRepository(saved.repository):null;
     await activate(repository?repository.pack:saved.pack,saved.label||'data/motores/','repo',null,{repository,persist:false,cached:true,readAt:saved.readAt});
    }catch(error){status('No se pudo recuperar el respaldo. Se leerán los motores publicados.',true);}
   }
   await run(loadRepository);
  }
  PBT_WEEKLY.loading=false;for(const tab of ['cafe','dt'])renderDataTab(tab);notifySource();
 });
})();
