/* Crear Planes: local draft, explicit combinations, preview and one ZIP. */
(function(){
'use strict';
const $=id=>document.getElementById(id),core=PBT_BATCH_CORE,esc=escHtml;
const DAYS={Weekday:'Lun–Jue',Weekend:'Vie–Dom'},SHIFTS=Object.fromEntries(['Morning','Lunch','Afternoon'].map(key=>[key,core.shiftLabel(key)])),STORAGE='pbt-crear-planes-v1';
let editorWeeks=[],editorMonths='',jobs=[],busy=false,cancelled=false,downloadURL='',downloadFile=null,activeCode='',monthSignature='',persistFailed=false,previewIndex=-1;
const defaults={Morning:[2,3,4,5],Lunch:[2,3,4],Afternoon:[3,4,5]};
try{const saved=JSON.parse(localStorage.getItem(STORAGE)||'[]');if(Array.isArray(saved)&&saved.length<=core.MAX)jobs=core.merge([],saved).jobs;}catch{}
function ready(){return PBT_WEEKLY?.ready&&!PBT_WEEKLY.loading&&PBT_PLAN?.ready;}
function notice(message,error=false){$('batchNotice').textContent=message;$('batchNotice').classList.toggle('batch-error',error);}
function invalidate(){if(downloadURL)URL.revokeObjectURL(downloadURL);downloadURL='';downloadFile=null;$('batchDownload').hidden=true;}
function save(){invalidate();try{localStorage.setItem(STORAGE,JSON.stringify(jobs));persistFailed=false;}catch{persistFailed=true;}$('batchSaved').textContent=persistFailed?'El navegador no pudo guardar el borrador. Conserva esta ventana abierta.':'Tu lote se guarda en este navegador. Los PDF se crean al descargar.';}
function build(){
 $('batchSection').innerHTML=`
 <div class="batch-heading"><div><p class="batch-eyebrow">PLANEACIÓN POR COMBINACIONES</p><h1 id="batchTitle" tabindex="-1">Crear planes</h1><p>Configura una tienda, reúne sus planes y llévalos juntos en un ZIP.</p></div><button id="batchBack" type="button" class="batch-secondary">Volver al plan</button></div>
 <p id="batchSource" class="batch-source" role="status"></p>
 <div class="batch-columns"><div class="batch-form-column"><fieldset id="batchEditor" class="batch-editor">
 <section class="batch-card"><div class="batch-step"><span>1</span><h2>Ingresa el CeCo</h2></div><label class="batch-label" for="batchCeco">CeCo de la tienda</label><input id="batchCeco" class="batch-input" type="text" inputmode="numeric" maxlength="8" list="batchStores" placeholder="Ej. 38937" autocomplete="off" aria-describedby="batchStoreLabel"><datalist id="batchStores"></datalist><p id="batchStoreLabel" class="batch-hint" role="status">El tipo Café o DT se identifica automáticamente.</p><div id="batchTabletWrap" hidden><label class="batch-label" for="batchTablet">Partner Tablet</label><select id="batchTablet" class="batch-input"><option>No</option><option>Sí</option></select></div></section>
 <section class="batch-card"><div class="batch-step"><span>2</span><h2>Selecciona el mes</h2></div><div class="batch-mini-actions"><button type="button" id="batchAllMonths">Todos</button><button type="button" id="batchNoMonths">Limpiar selección</button></div><div id="batchMonths" class="batch-months"></div><button type="button" class="weeks-button" id="batchWeeks" aria-haspopup="dialog">Ver semanas</button><p id="batchWeeksSummary" class="batch-hint" role="status"></p><p class="batch-hint">Los meses seleccionados se calculan juntos como un período. Agrega otro período al lote cuando lo necesites.</p></section>
 <section class="batch-card"><div class="batch-step"><span>3</span><h2>Elige tus combinaciones</h2></div><p class="batch-hint">Marca los números de partners para cada turno. Cada número marcado crea un plan.</p><button type="button" class="batch-example" id="batchExample">Usar ejemplo: 10 planes por grupo de días</button><div id="batchCombinations"></div><p id="batchSelection" class="batch-selection" role="status"></p><button type="button" id="batchAdd" class="batch-primary">Agregar al lote</button><p id="batchNotice" role="status" aria-live="polite"></p></section>
 </fieldset></div>
 <aside class="batch-card batch-basket" aria-labelledby="batchBasketTitle"><div class="batch-basket-heading"><div><p class="batch-eyebrow">LISTOS PARA REVISAR</p><h2 id="batchBasketTitle">Mi lote <span id="batchCount">0</span></h2></div><button id="batchClear" class="batch-text-button" type="button">Vaciar lote</button></div><p id="batchSaved" class="batch-hint">Tu lote se guarda en este navegador. Los PDF se crean al descargar.</p><div id="batchQueue"></div><div class="batch-export"><p id="batchSummary"></p><button id="batchGenerate" class="batch-primary" type="button" disabled>Crear ZIP</button><progress id="batchProgress" max="1" value="0" hidden aria-label="Generación de planes"></progress><p id="batchProgressText" role="status" aria-live="polite"></p><button id="batchCancel" class="batch-secondary" type="button" hidden>Cancelar generación</button><a id="batchDownload" class="batch-primary batch-download" download hidden>Descargar ZIP</a><p class="batch-hint">El ZIP contiene únicamente tus PDF, todos al mismo nivel y ordenados por tienda, período, días, turno y partners.</p></div></aside></div>
 <dialog id="batchPreview" class="batch-preview-dialog" aria-labelledby="batchPreviewTitle"><div class="batch-preview-toolbar"><h2 id="batchPreviewTitle">Vista previa</h2><button id="batchPreviewClose" class="batch-secondary" type="button">Cerrar</button></div><div id="batchPreviewBody"></div></dialog>`;
 $('batchCeco').addEventListener('input',storeChanged);
 $('batchEditor').addEventListener('change',selectionChanged);
 $('batchAllMonths').onclick=()=>{document.querySelectorAll('#batchMonths input').forEach(n=>n.checked=true);selectionChanged();};
 $('batchNoMonths').onclick=()=>{document.querySelectorAll('#batchMonths input').forEach(n=>n.checked=false);selectionChanged();};
 $('batchWeeks').onclick=()=>PBT_WEEKS.open({months:chosenMonths(),selected:editorWeeks,opener:$('batchWeeks'),apply:weeks=>{editorWeeks=weeks;selectionChanged();}});
 $('batchExample').onclick=()=>{document.querySelectorAll('[data-batch-day]').forEach(n=>n.checked=true);document.querySelectorAll('[data-batch-partners]').forEach(n=>n.checked=defaults[n.dataset.shift].includes(Number(n.value)));selectionChanged();};
 $('batchAdd').onclick=add;
 $('batchBack').onclick=()=>setOpen(false);
 $('batchClear').onclick=()=>{if(!jobs.length||busy)return;if(!confirm('¿Vaciar los '+jobs.length+' planes del lote?'))return;jobs=[];save();renderQueue();notice('Lote vacío. Puedes empezar otra selección.');};
 $('batchGenerate').onclick=generate;
 $('batchDownload').addEventListener('click',event=>{
  if(!PBT_EXPORT.isIOS())return;event.preventDefault();
  if(downloadFile)PBT_EXPORT.offerFile(downloadFile,URL.createObjectURL(downloadFile),$('batchDownload'));
 });
 $('batchCancel').onclick=()=>{cancelled=true;$('batchProgressText').textContent='Cancelando…';};
 $('batchPreviewClose').onclick=()=>$('batchPreview').close();
 $('batchPreview').addEventListener('close',()=>{$('batchQueue').querySelector('[data-preview="'+previewIndex+'"]')?.focus();});
 $('batchQueue').addEventListener('click',e=>{const remove=e.target.closest('[data-remove]'),preview=e.target.closest('[data-preview]');if(busy)return;if(remove){jobs.splice(Number(remove.dataset.remove),1);save();renderQueue();}else if(preview)showPreview(Number(preview.dataset.preview));});
 refreshSource();
}
function setOpen(value){
 if(busy)return;
 document.documentElement.classList.toggle('batch-open',value);$('singlePlanner').hidden=value;$('batchSection').hidden=!value;$('createPlansButton').setAttribute('aria-pressed',String(value));
 if(value){const current=state[activeTab].filters.tienda[0];if(!activeCode&&current){$('batchCeco').value=PBT_DIRECTORY.codeOf(current);storeChanged();}refreshSource();$('batchTitle').focus();window.scrollTo({top:0,behavior:'auto'});}
 else $('createPlansButton').focus();
}
window.openCreatePlans=function(forceOpen=false){if(!$('batchTitle'))build();setOpen(forceOpen||$('batchSection').hidden);};
function storeInfo(){
 const code=$('batchCeco').value.trim(),engine=PBT_WEEKLY?.engine;if(!/^\d{3,8}$/.test(code)||!engine)return null;
 const type=engine.typeOf(code),tab=type==='DT'?'dt':type==='CAFE'?'cafe':null;
 if(!tab||!engine.availableStores(type).includes('CeCo '+code))return null;
 return {ceco:code,tab};
}
function storeChanged(){
 const info=storeInfo();activeCode=info?.ceco||'';
 $('batchStoreLabel').textContent=info?pbtStoreLabel('CeCo '+info.ceco)+' · '+(info.tab==='dt'?'Drive Thru':'Café'):$('batchCeco').value?'No encontramos un CeCo con datos activos. Revisa el código.':'El tipo Café o DT se identifica automáticamente.';
 $('batchStoreLabel').classList.toggle('batch-error',!!$('batchCeco').value&&!info);
 $('batchTabletWrap').hidden=info?.tab!=='dt';
 const max=info?.tab==='dt'?13:11;
 if($('batchCombinations').dataset.max!==String(max))renderCombinations(max);
 selectionChanged();
}
function renderCombinations(max){
 const previous={};document.querySelectorAll('[data-batch-partners]:checked').forEach(n=>{previous[n.dataset.day+'|'+n.dataset.shift+'|'+n.value]=true;});
 const had=!!$('batchCombinations').dataset.max;
 $('batchCombinations').dataset.max=String(max);
 $('batchCombinations').innerHTML=Object.entries(DAYS).map(([day,label])=>'<fieldset class="batch-day"><legend><label><input type="checkbox" data-batch-day="'+day+'" checked> '+label+'</label><span id="batchTotal_'+day+'"></span></legend>'+Object.entries(SHIFTS).map(([shift,title])=>'<div class="batch-shift"><div class="batch-shift-heading"><strong>'+title+'</strong><small>Partners</small></div><div class="batch-partner-options">'+Array.from({length:max-1},(_,i)=>i+2).map(n=>'<label class="batch-chip"><input type="checkbox" data-batch-partners data-day="'+day+'" data-shift="'+shift+'" value="'+n+'" '+((had?previous[day+'|'+shift+'|'+n]:defaults[shift].includes(n))?'checked':'')+' aria-label="'+label+', '+title+', '+n+' partners"><span>'+n+'</span></label>').join('')+'</div></div>').join('')+'</fieldset>').join('');
}
function choices(){
 const result={};
 for(const day of Object.keys(DAYS)){
  result[day]={};
  const on=document.querySelector('[data-batch-day="'+day+'"]').checked;
  for(const shift of Object.keys(SHIFTS))result[day][shift]=on?[...document.querySelectorAll('[data-batch-partners][data-day="'+day+'"][data-shift="'+shift+'"]:checked')].map(n=>Number(n.value)):[];
 }
 return result;
}
function chosenMonths(){return [...document.querySelectorAll('#batchMonths input:checked')].map(n=>n.value);}
function selected(){
 const info=storeInfo();if(!info)throw Error('Ingresa un CeCo con datos activos.');
 const months=chosenMonths();PBT_WEEKS.validate(PBT_WEEKLY.engine.pack,months,editorWeeks);
 return core.expand({...info,months,weeks:editorWeeks,partnerTablet:$('batchTablet').value},choices());
}
function selectionChanged(){
 if(!ready()){$('batchAdd').disabled=true;return;}
 let count=0;for(const [day,label]of Object.entries(DAYS)){const on=document.querySelector('[data-batch-day="'+day+'"]')?.checked;const inputs=[...document.querySelectorAll('[data-batch-partners][data-day="'+day+'"]')];inputs.forEach(n=>n.disabled=!on);const n=on?inputs.filter(n=>n.checked).length:0;count+=n;const node=$('batchTotal_'+day);if(node)node.textContent=n+' planes';}
 const months=chosenMonths(),monthCount=months.length,signature=months.join('|');
 if(signature!==editorMonths){editorWeeks=[];editorMonths=signature;}
 const available=PBT_WEEKS.available(PBT_WEEKLY.engine.pack,months);let weekError=false;
 try{if(monthCount)PBT_WEEKS.validate(PBT_WEEKLY.engine.pack,months,editorWeeks);}catch{weekError=true;}
 $('batchWeeks').disabled=!monthCount||!available.length||busy;
 $('batchWeeksSummary').textContent=weekError?'Las semanas requieren revisión. Pulsa Ver semanas.':!monthCount?'Elige un mes para revisar sus semanas.':(editorWeeks.length||available.length)+' de '+available.length+' semanas · '+(editorWeeks.length?'selección validada':'todas disponibles');
 $('batchWeeksSummary').classList.toggle('batch-error',weekError);
 $('batchSelection').textContent=count+' combinaciones · '+monthCount+' meses en un período';
 $('batchAdd').textContent='Agregar '+count+' planes al lote';$('batchAdd').disabled=!storeInfo()||!monthCount||!count||busy||weekError;
}
function refreshSource(){
 if(!$('batchTitle'))return;
 const ok=ready();$('batchSource').textContent=ok?'Motores listos · '+PBT_WEEKLY.engine.pack.weeks.length+' semanas disponibles · cálculo por unidades':'Preparando los motores y el catálogo de planes…';
 $('batchEditor').disabled=!ok||busy;
 if(ok){
  const months=getSourceList('Mes'),signature=months.join('|');
  if(signature!==monthSignature){const prev=[...document.querySelectorAll('#batchMonths input:checked')].map(n=>n.value);$('batchMonths').innerHTML=months.map(m=>'<label class="batch-chip batch-month"><input type="checkbox" value="'+esc(m)+'" '+(!monthSignature||prev.includes(m)?'checked':'')+'><span>'+esc(m)+'</span></label>').join('');monthSignature=signature;}
  if(!$('batchStores').children.length)$('batchStores').innerHTML=PBT_WEEKLY.engine.availableStores().map(label=>{const code=PBT_DIRECTORY.codeOf(label);return '<option value="'+code+'">'+esc(pbtStoreLabel(label))+'</option>';}).join('');
  storeChanged();
 }
 renderQueue();
}
function validate(job){try{return {snapshot:buildPBTBatchSnapshot(job)};}catch(error){return {error:error.message||'No se pudo validar.'};}}
function add(){
 if(busy)return;
 try{
  const incoming=selected();if(!incoming.length)throw Error('Marca al menos una combinación.');
  const failures=incoming.map(job=>({job,...validate(job)})).filter(v=>v.error);
  if(failures.length)throw Error('No se agregó la selección. '+failures.length+' combinaciones necesitan revisión. '+DAYS[failures[0].job.weekpart]+' · '+SHIFTS[failures[0].job.daypart]+': '+failures[0].error);
  const merged=core.merge(jobs,incoming);jobs=merged.jobs;save();renderQueue();notice(merged.added+' planes agregados'+(merged.duplicates?' · '+merged.duplicates+' ya estaban en el lote y no se repitieron.':'.'));
 }catch(error){notice(error.message,true);}
}
function renderQueue(){
 if(busy)return;
 let invalid=0;
 $('batchQueue').innerHTML=jobs.length?jobs.map((job,i)=>{const {error,snapshot}=validate(job);if(error)invalid++;return '<article class="batch-job'+(error?' batch-job-error':'')+'"><div class="batch-job-top"><strong>CeCo '+job.ceco+' · '+(job.tab==='dt'?'DT':'Café')+'</strong><span class="batch-job-status">'+(error?'Revisar':'Listo')+'</span></div><p>'+esc(job.months.join(', '))+(job.weeks?.length?' · '+esc(PBT_WEEKS.label(job.weeks)):' · Todas las semanas disponibles')+'</p><h3>'+DAYS[job.weekpart]+' · '+SHIFTS[job.daypart]+' · '+job.partners+' partners</h3>'+(job.tab==='dt'?'<small>Tablet: '+job.partnerTablet+'</small>':'')+(error?'<p class="batch-error">'+esc(error)+'</p>':'<small>'+Number(snapshot.units).toLocaleString('es-MX')+' unidades seleccionadas</small>')+'<div class="batch-job-actions"><button type="button" data-preview="'+i+'" '+(error?'disabled':'')+'>Vista previa</button><button type="button" data-remove="'+i+'" aria-label="Quitar plan '+(i+1)+'">Quitar</button></div></article>';}).join(''):'<div class="batch-empty"><span aria-hidden="true">＋</span><strong>Tu primer lote empieza aquí</strong><p>Selecciona tus combinaciones y pulsa Agregar al lote. Puedes reunir varias tiendas y períodos.</p></div>';
 $('batchCount').textContent=jobs.length;$('batchSummary').textContent=jobs.length?(jobs.length+' PDF · '+new Set(jobs.map(j=>j.ceco)).size+' tiendas'+(invalid?' · '+invalid+' por revisar':'')):'Aún no hay planes en el lote.';
 $('batchGenerate').textContent='Crear ZIP con '+jobs.length+' planes';$('batchGenerate').disabled=!jobs.length||!!invalid||!ready();
 $('batchClear').disabled=!jobs.length;
}
function showPreview(index){
 const result=validate(jobs[index]);if(result.error){notice(result.error,true);renderQueue();return;}
 const s=result.snapshot;previewIndex=index;
 $('batchPreviewTitle').textContent='Plan '+(index+1)+' de '+jobs.length;
 const metrics=items=>items.map(([label,value])=>'<div><span>'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('');
 $('batchPreviewBody').innerHTML='<p class="batch-preview-store">'+esc(s.store)+'</p><p>'+esc(s.selectedMonths.join(', '))+(s.selectedWeeks?.length?' · '+esc(PBT_WEEKS.label(s.selectedWeeks)):' · Todas las semanas disponibles')+'</p><h3>'+esc(s.days)+' · '+esc(s.daypart)+' · '+s.partners+' partners</h3><div class="batch-preview-metrics">'+metrics(s.channels)+metrics(s.mix)+'</div><div class="layout-wrap" tabindex="0" role="region" aria-label="Plano del lote"><div class="layout"><div class="sheet-grid" style="height:'+(1000/PBT_SHEET[s.tab].rows)+'%">'+staticLayout(s.tab)+s.areas.map(a=>'<div class="'+a.classes.join(' ')+'" style="left:'+a.left+'%;top:'+a.top+'%;width:'+a.width+'%;height:'+a.height+'%"><span class="marker-letter">'+esc(a.letter)+'</span><span class="marker-name">'+esc(a.name)+'</span></div>').join('')+'</div></div></div><div class="table-wrap"><table><thead><tr><th>Partner</th><th>Estación</th><th>Fijo</th><th>Rutinas</th></tr></thead><tbody>'+s.routines.map(r=>'<tr><td>'+esc(r.partner)+'</td><td>'+esc(r.station)+'</td><td>'+esc(r.fixed)+'</td><td>'+esc(r.routine)+'</td></tr>').join('')+'</tbody></table></div><p class="batch-hint">El PDF usa la misma plantilla Carta y el mismo plano original.</p>';
 $('batchPreview').showModal();
}
function setBusy(value){
 busy=value;$('batchEditor').disabled=value||!ready();$('batchBack').disabled=value;$('batchClear').disabled=value||!jobs.length;$('batchGenerate').disabled=value;
 $('batchQueue').querySelectorAll('button').forEach(n=>n.disabled=value||n.hasAttribute('data-preview')&&!!validate(jobs[Number(n.dataset.preview)]).error);
 $('batchCancel').hidden=!value;$('batchProgress').hidden=!value;$('createPlansButton').disabled=value;
}
async function generate(){
 if(busy||!jobs.length)return;
 invalidate();cancelled=false;const engine=PBT_WEEKLY.engine,at=new Date(),batch=core.order(jobs),snapshots=[];
 try{
  setBusy(true);
  if(window.PBT_DEVICE?.ready)await PBT_DEVICE.ready;
  if(PBT_WEEKLY.engine!==engine)throw Error('La fuente cambió. Revisa el lote.');
  for(const job of batch)snapshots.push(buildPBTBatchSnapshot(job,at));
  $('batchProgress').max=batch.length;$('batchProgress').value=0;$('batchProgressText').textContent='Preparando la exportación…';
  await PBT_EXPORT.libraries();
  const files=[];
  for(let i=0;i<batch.length;i++){
   if(cancelled)throw Error('Generación cancelada. Tu lote se conserva.');
   if(PBT_WEEKLY.engine!==engine||!ready())throw Error('La fuente cambió durante la exportación. Revisa el lote y vuelve a generar.');
   const snapshot=snapshots[i],job=batch[i];$('batchProgressText').textContent='Creando plan '+(i+1)+' de '+batch.length+' · CeCo '+job.ceco;
   await new Promise(resolve=>setTimeout(resolve,0));
   const bytes=await PBT_PDF.create(snapshot,PDFLib),name=core.pdfName(job);files.push({name,bytes});
   $('batchProgress').value=i+1;
  }
  if(cancelled||PBT_WEEKLY.engine!==engine)throw Error('La generación se interrumpió. Tu lote se conserva.');
  const zip=core.pdfZip(files,at);downloadURL=URL.createObjectURL(zip);const link=$('batchDownload');link.href=downloadURL;link.download=core.archiveName(batch,at);downloadFile=new File([zip],link.download,{type:'application/zip'});link.hidden=false;
  $('batchProgressText').textContent='ZIP listo: '+batch.length+' PDF listos para abrir.';notice('Todos los planes se generaron. Pulsa Descargar ZIP para guardarlos.');link.focus();
 }catch(error){$('batchProgressText').textContent=error.message||'No terminó la generación. Tu lote se conserva.';notice(error.message||'Revisa el lote y vuelve a intentar.',true);}
 finally{setBusy(false);renderQueue();selectionChanged();}
}
document.addEventListener('pbt:source',()=>{if(busy)cancelled=true;else{if(downloadURL){invalidate();$('batchProgressText').textContent='La fuente cambió. Genera un ZIP con los datos actuales.';}refreshSource();}});
document.addEventListener('pbt:plan',refreshSource);
// Build the form only when Crear planes is opened; keep the initial page light.
})();

