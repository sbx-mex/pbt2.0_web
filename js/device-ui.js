/* Store selection, team and photos remain on this device, keyed by CeCo. */
(function(){
 'use strict';
 const $=id=>document.getElementById(id),empty=()=>({names:[],photos:{},assignments:{}});
 let restored=false;
 const code=tab=>PBT_DIRECTORY.codeOf(state[tab].filters.tienda[0]||'');
 function profile(ceco){const p=PBT_DEVICE.get('team:'+ceco)||empty();return { ...p,names:Array.isArray(p.names)?p.names:[],photos:p.photos||{},assignments:p.assignments||{} };}
 function message(text,error=false){const el=$('teamSaveStatus');if(el){el.textContent=text;el.classList.toggle('save-error',error);}}
 function save(ceco,value){
  const result=PBT_DEVICE.set('team:'+ceco,value);message('Guardando…');
  result.then(ok=>{if(code(activeTab)===ceco)message(ok?'Guardado en este dispositivo':'No se pudo guardar. Conserva esta ventana abierta y libera espacio.',!ok);});return result;
 }
 function settings(tab){const s=state[tab];return {mode:s.mode,partners:s.partners,partnerTablet:s.partnerTablet||'No',mes:s.filters.mes.slice(),weekpart:s.filters.weekpart[0],daypart:s.filters.daypart[0]};}
 function applySettings(tab,p){
  if(!p||typeof p!=='object')return;const s=state[tab];
  if(['auto','manual'].includes(p.mode))s.mode=p.mode;
  if(Number.isInteger(p.partners)&&p.partners>=2&&p.partners<=config[tab].maxPartners)s.partners=p.partners;
  if(tab==='dt')s.partnerTablet=p.partnerTablet==='Sí'?'Sí':'No';
  if(Array.isArray(p.mes))s.filters.mes=p.mes.filter(v=>typeof v==='string'&&/^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic) \d{4}$/.test(v));
  if(['Weekday','Weekend'].includes(p.weekpart))s.filters.weekpart=[p.weekpart];
  if(['Morning','Lunch','Afternoon'].includes(p.daypart))s.filters.daypart=[p.daypart];
 }
 window.restorePBTSession=function(){
  if(restored)return;const saved=PBT_DEVICE.get('session');
  if(saved){for(const tab of ['cafe','dt']){const p=saved[tab];applySettings(tab,p);if(/^CeCo \d{3,8}$/.test(p?.store||''))state[tab].filters.tienda=[p.store];}
   if(['cafe','dt'].includes(saved.activeTab))activeTab=saved.activeTab;}
  for(const tab of ['cafe','dt']){if($(tab+'_partners'))$(tab+'_partners').value=String(state[tab].partners);}
  syncPartnerTabletSelects();showTab(activeTab,true);restored=true;
 };
 window.savePBTSession=function(){
  if(!restored)return;
  PBT_DEVICE.set('session',{activeTab,...Object.fromEntries(['cafe','dt'].map(tab=>[tab,{...settings(tab),store:state[tab].filters.tienda[0]||''}]))});
 };
 window.saveStorePlan=function(tab){const ceco=code(tab);if(!restored||!ceco)return;const p=profile(ceco);p.settings=settings(tab);PBT_DEVICE.set('team:'+ceco,p);};
 window.restoreStorePlan=function(tab){const ceco=code(tab);if(!ceco)return;applySettings(tab,profile(ceco).settings);$(tab+'_partners').value=String(state[tab].partners);syncPartnerTabletSelects();};
 window.getTeamList=tab=>code(tab)?profile(code(tab)).names.slice(0,tab==='cafe'?21:30):[];
 window.getAssignedPartner=function(tab,letter){
  const ceco=code(tab);if(!ceco)return '';const p=profile(ceco),clean=String(letter).replace('.','').trim().toUpperCase();
  return Object.prototype.hasOwnProperty.call(p.assignments,clean)?cleanPartnerName(p.assignments[clean]):cleanPartnerName(p.names[clean.charCodeAt(0)-65]||'');
 };
 window.getPartnerName=getAssignedPartner;
 window.getPartnerPhoto=function(tab,name){
  const ceco=code(tab);if(!ceco||!name)return '';const p=profile(ceco),idx=p.names.indexOf(cleanPartnerName(name)),photo=p.photos[idx+1]||'';
  return /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(photo)?photo:'';
 };
 window.photoBubbleHTML=function(tab,name){const photo=getPartnerPhoto(tab,name);return '<div class="partner-photo-bubble '+(photo?'':'empty')+'" '+(photo?'style="background-image:url('+photo+')"':'')+'></div>';};
 window.setPartnerName=function(tab,letter,input){const ceco=code(tab);if(!ceco)return;const p=profile(ceco);p.assignments[String(letter).replace('.','').trim().toUpperCase()]=cleanPartnerName(input.value);save(ceco,p);renderDataTab(tab);};
 window.setTeamPartner=function(tab,idx,input){
  const ceco=code(tab);if(!ceco)return;const p=profile(ceco),old=p.names[idx-1]||'',name=cleanPartnerName(input.value);input.value=name;p.names[idx-1]=name;
  for(const letter of Object.keys(p.assignments))if(old&&p.assignments[letter]===old)p.assignments[letter]=name;
  if(!name)delete p.photos[idx];save(ceco,p);updatePhotoRow(tab,idx);renderDataTab(tab);
 };
 function updatePhotoRow(tab,idx){const row=$('team_'+tab+'_'+idx),preview=row?.querySelector('.team-photo-preview'),name=getTeamList(tab)[idx-1];if(preview){const photo=getPartnerPhoto(tab,name);preview.classList.toggle('empty',!photo);preview.style.backgroundImage=photo?'url("'+photo+'")':'';}}
 window.savePartnerPhoto=function(tab,idx,input){
  const file=input?.files?.[0];if(!file)return;
  function fail(text){input.value='';alert(text);}
  if(!file.type||!file.type.startsWith('image/'))return fail('Selecciona una imagen para la foto.');
  if(!file.size||file.size>10*1024*1024)return fail('Usa una imagen de hasta 10 MB.');
  const ceco=code(tab),name=ceco&&profile(ceco).names[idx-1];if(!name)return fail('Primero captura el nombre corto y después agrega la foto.');
  PBT_DEVICE.requestPersistence();const reader=new FileReader();
  reader.onerror=()=>fail('No se pudo leer la foto. Intenta con otra imagen.');
  reader.onload=event=>{const img=new Image();img.onerror=()=>fail('No se pudo abrir la imagen. Usa JPG, PNG o WebP.');img.onload=async()=>{
   try{
    if(!img.width||!img.height)throw Error('Imagen vacía');const p=profile(ceco);if(p.names[idx-1]!==name)throw Error('El nombre cambió mientras se abría la foto. Vuelve a adjuntarla.');
    const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d'),side=Math.min(img.width,img.height);canvas.width=160;canvas.height=160;ctx.fillStyle='#ffffff';ctx.fillRect(0,0,160,160);ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,160,160);p.photos[idx]=canvas.toDataURL('image/jpeg',0.76);
    await save(ceco,p);if(code(tab)===ceco){updatePhotoRow(tab,idx);renderDataTab(tab);}input.value='';
   }catch(error){fail(error.message||'No se pudo guardar la foto.');}
  };img.src=event.target.result;};reader.readAsDataURL(file);
 };
 window.filterTeam=function(tab,value){const q=String(value).toLowerCase().trim();document.querySelectorAll('[data-team-row="'+tab+'"]').forEach(row=>{row.hidden=!(row.querySelector('.team-input').value+' '+row.textContent).toLowerCase().includes(q);});};
 window.recoverPreviousTeam=async function(){
  const tab=activeTab,ceco=code(tab),old=PBT_DEVICE.legacy(tab);if(!ceco||!old)return;const p=profile(ceco);if(p.names.some(Boolean))return;
  const ok=await save(ceco,{...p,...old});if(ok)await PBT_DEVICE.set('legacy:'+tab,{ceco});buildEquipo();renderDataTab(tab);
 };
 window.buildEquipo=function(){
  const el=$('equipo'),tab=activeTab,ceco=code(tab);if(!ceco){el.hidden=true;$('teamButton').setAttribute('aria-expanded','false');return;}
  const p=profile(ceco),count=tab==='cafe'?21:30;let rows='';
  for(let i=1;i<=count;i++){
   const name=cleanPartnerName(p.names[i-1]||''),photo=getPartnerPhoto(tab,name),fileId='photo_'+tab+'_'+i,cameraId='camera_'+tab+'_'+i;
   rows+='<div class="team-row" id="team_'+tab+'_'+i+'" data-team-row="'+tab+'"><span class="team-num">'+i+'</span><button class="team-photo-preview '+(photo?'':'empty')+'" type="button" aria-label="Foto de partner '+i+'" data-click="photo" data-target="'+fileId+'" '+(photo?'style="background-image:url('+photo+')"':'')+'></button><input class="team-input" maxlength="8" value="'+escHtml(name)+'" placeholder="Nombre corto" aria-label="Nombre del partner '+i+'" data-input="team-name" data-tab="'+tab+'" data-index="'+i+'"><span class="team-photo-actions"><button class="team-photo-btn" type="button" data-click="photo" data-target="'+fileId+'">Adjuntar</button><button class="team-photo-btn" type="button" data-click="photo" data-target="'+cameraId+'">Cámara</button></span><input id="'+fileId+'" class="team-file" type="file" accept="image/*" data-change="photo" data-tab="'+tab+'" data-index="'+i+'"><input id="'+cameraId+'" class="team-file" type="file" accept="image/*" capture="environment" data-change="photo" data-tab="'+tab+'" data-index="'+i+'"></div>';
  }
  const legacy=!p.names.some(Boolean)&&PBT_DEVICE.legacy(tab);
  el.innerHTML='<div class="team-heading"><div><h2 tabindex="-1">Equipo</h2><p class="team-store">'+escHtml(pbtStoreLabel(state[tab].filters.tienda[0]))+'</p></div><button class="team-close" type="button" data-click="team-close" aria-label="Cerrar Equipo">×</button></div>'+(legacy?'<button class="recover-team" type="button" data-click="recover-team">Recuperar equipo anterior</button>':'')+'<input class="team-search" type="search" placeholder="Buscar partner" aria-label="Buscar partner" data-input="team-search" data-tab="'+tab+'"><div class="team-list">'+rows+'</div><div class="team-bottom"><span id="teamSaveStatus" role="status"></span><button type="button" class="team-button" data-click="team-close">Ver plan</button></div>';
 };
 window.toggleEquipo=function(open){
  const el=$('equipo'),visible=typeof open==='boolean'?open:el.hidden;
  if(visible&&!code(activeTab)){$(activeTab+'_tienda_search').focus();return;}
  el.hidden=!visible;$('teamButton').setAttribute('aria-expanded',String(visible));
  if(visible){buildEquipo();PBT_DEVICE.requestPersistence();el.querySelector('h2').focus({preventScroll:true});}
  else{$('teamButton').focus({preventScroll:true});$(activeTab+'_results').scrollIntoView({block:'start'});}
 };
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePBTSession();});
 window.addEventListener('pagehide',()=>savePBTSession());
})();
