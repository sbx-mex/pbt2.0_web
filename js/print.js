(function(){
 'use strict';
 const $=id=>document.getElementById(id);
 window.PBT_EXPORT_BUSY=false;
 let loading=null;
 const MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
 window.pbtPeriodLabel=function(values){
  const months=[...new Set(values)].map(value=>{const match=/^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic) (\d{4})$/.exec(value);if(!match)throw Error('Mes no válido en el motor CSV.');return Number(match[2])*12+MONTHS.indexOf(match[1]);}).sort((a,b)=>a-b);
  if(!months.length)throw Error('Selecciona meses con información.');
  const groups=[];let start=months[0],end=start;
  function add(){groups.push(MONTHS[start%12]+(end===start?'':' - '+MONTHS[end%12]));}
  for(const month of months.slice(1)){if(month===end+1)end=month;else{add();start=end=month;}}add();return groups.join(', ');
 };
 window.buildPBTSnapshot=function(tab,today=new Date()){
  if(!['cafe','dt'].includes(tab))throw Error('Selecciona CAFÉ o DRIVE THRU para exportar.');
  if(state[tab].filters.tienda.length!==1)throw Error('Selecciona una tienda antes de exportar.');
  const v=valuesFromData(tab),data=v.raw;
  if(!data.registros||data.basis!=='units'||!data.valid)throw Error(data.reason||'No hay datos válidos para exportar.');
  const current=state[tab],ceco=PBT_DIRECTORY.codeOf(current.filters.tienda[0]);
  if(!ceco)throw Error('Esta tienda no tiene cruce CeCo en el directorio.');
  const areas=[...$(tab+'_layout').querySelectorAll('.partner-marker')].map(node=>({
   left:parseFloat(node.style.left),top:parseFloat(node.style.top),width:parseFloat(node.style.width),height:parseFloat(node.style.height),classes:[...node.classList],
   marker:node.classList.contains('partner-marker'),text:node.textContent.trim(),letter:node.querySelector('.marker-letter')?.textContent||'',name:node.querySelector('.marker-name')?.textContent||'',
   photo:node.querySelector('.partner-photo-bubble')?.style.backgroundImage?.match(/url\(["']?(data:image\/[^"')]+)["']?\)/)?.[1]||''
  }));
  const routines=[...$(tab+'_tbody').querySelectorAll('tr')].map(node=>{const cells=node.querySelectorAll('td'),select=cells[0].querySelector('select');return {partner:(cells[0].querySelector('.partner-letter')?.textContent||'')+(select?.value&&select.value.toLowerCase()!=='seleccionar'?' · '+select.value:''),station:cells[1].textContent,fixed:cells[2].textContent,routine:cells[3].textContent};});
  const selectedMonths=current.filters.mes.length?current.filters.mes.slice():getSourceList('Mes').slice(),months=pbtPeriodLabel(selectedMonths),days=pbtWeekLabel(current.filters.weekpart[0]).replace('–',' - '),daypart=pbtDayLabel(current.filters.daypart[0]),store=pbtStoreLabel(current.filters.tienda[0]),quarter='Q'+(Math.floor(today.getMonth()/3)+1);
  const comments='Plan para la tienda '+store+', con base en '+months+', '+days+' y turno '+daypart+'. Referencia para la planificación estimada del '+quarter+' actual.';
  return {title:config[tab].title,tab,partners:current.partners,partnerTablet:current.partnerTablet,store,ceco,weekpart:current.filters.weekpart[0],daypartKey:current.filters.daypart[0],
   months,selectedMonths,days,daypart,quarter,comments,
   channels:config[tab].channelLabels.map(([label,,key])=>[label,pctText(v.channels[key])]),mix:mixLabels.map(([label,,key])=>[label,pctText(v.mix[key])]),areas,routines};
 };
 function script(src){return new Promise((resolve,reject)=>{const node=document.createElement('script');node.src=src;node.onload=resolve;node.onerror=()=>{node.remove();reject(Error('No se pudo cargar la exportación. Revisa la conexión y vuelve a intentar.'));};document.head.appendChild(node);});}
 async function libraries(){
  if(window.PDFLib&&window.PBT_PDF)return;
  if(!loading)loading=(async()=>{if(!window.PDFLib)await script('js/vendor/pdf-lib.min.js?v=1.17.1');if(!window.PBT_PDF)await script('js/pdf-renderer.js?v=23');})().catch(error=>{loading=null;throw error;});
  await loading;
 }
 window.exportPBTLetter=async function(){
  if(window.PBT_EXPORT_BUSY)return;
  const tab=activeTab,button=$(tab+'_export');if(!button)return;const original=button.textContent;
  try{
   applyOperationalContext(false);
   const snapshot=buildPBTSnapshot(activeTab);window.PBT_EXPORT_BUSY=true;button.disabled=true;button.textContent='Preparando PDF…';
   await libraries();const bytes=await PBT_PDF.create(snapshot,PDFLib),url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'})),link=document.createElement('a');
   link.href=url;link.download=PBT_PDF.filename(snapshot);document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  }catch(error){alert(error.message||'No se pudo generar el PDF.');}
  finally{window.PBT_EXPORT_BUSY=false;button.textContent=original;if(['cafe','dt'].includes(activeTab))renderDataTab(activeTab);else button.disabled=true;}
 };
})();
