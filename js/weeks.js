/* Weeks come only from validated CSV metadata and the original PBT 4-4-5 calendar. */
(function(root){
'use strict';
function ids(values){
 if(!Array.isArray(values)||values.length>128||values.some(v=>typeof v!=='string'||!/^20\d{2}(?:0[1-9]|[1-4]\d|5[0-3])$/.test(v)))throw Error('Selección de semanas no válida.');
 return [...new Set(values)].sort();
}
function available(pack,months=[]){return (pack?.weeks||[]).filter(w=>!months.length||months.includes(w.label)).slice().sort((a,b)=>a.id.localeCompare(b.id));}
function validate(pack,months=[],selected=[]){
 const all=available(pack,months),chosen=ids(selected),labels=new Set((pack?.weeks||[]).map(w=>w.label));
 if(!all.length||months.some(m=>!labels.has(m)))throw Error('El mes elegido no tiene datos disponibles. Revisa Mes.');
 if(chosen.some(id=>!all.some(w=>w.id===id)))throw Error('Hay semanas fuera del mes o de la fuente actual. Pulsa Ver semanas y vuelve a validar.');
 return chosen.length?chosen:all.map(w=>w.id);
}
function ranges(values){
 const list=ids(values),result=[];let start=list[0],last=start;
 const add=()=>{if(start)result.push(start===last?start:start+'a'+last);};
 for(const v of list.slice(1)){if(v.slice(0,4)===last.slice(0,4)&&Number(v.slice(4))===Number(last.slice(4))+1)last=v;else{add();start=last=v;}}add();return result;
}
function token(values){const list=ids(values),text=ranges(list).join('+');if(text.length<=80)return text;let hash=2166136261;for(const c of list.join(',')){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return list[0]+'a'+list.at(-1)+'_'+(hash>>>0).toString(16).padStart(8,'0');}
function label(values){const list=ids(values),text=ranges(list).map(v=>v.replace(/(20\d{2})(\d{2})/g,'$1 · S$2').replace('a','–')).join(', ');return text.length<=110?'Semanas '+text:list.length+' semanas seleccionadas · primera '+list[0]+' · última '+list.at(-1);}
const api={ids,available,validate,token,label};
if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
root.PBT_WEEKS=api;
const $=id=>document.getElementById(id);
let dialog=null,context=null,signature='',opener=null;
function pack(){return root.PBT_WEEKLY?.engine?.pack;}
function stamp(){return JSON.stringify([pack()?.files?.map(f=>[f.week,f.sha256]),context?.months]);}
function count(){
 const n=dialog.querySelectorAll('[name="pbt-week"]:checked').length,total=dialog.querySelectorAll('[name="pbt-week"]').length,stale=stamp()!==signature||!root.PBT_WEEKLY?.ready||root.PBT_WEEKLY.loading;
 $('weeksCount').textContent=stale?'La fuente cambió. Cierra y abre Ver semanas para revisar los datos actuales.':n+' de '+total+' semanas disponibles seleccionadas';
 $('weeksApply').disabled=!n||stale;$('weeksCount').classList.toggle('weeks-error',!n||stale);
}
function build(){
 dialog=document.createElement('dialog');dialog.id='weeksDialog';dialog.className='weeks-dialog';dialog.setAttribute('aria-labelledby','weeksTitle');dialog.setAttribute('aria-describedby','weeksHelp');
 dialog.innerHTML='<div class="weeks-toolbar"><div><p class="weeks-eyebrow">PERÍODO DEL PLAN</p><h2 id="weeksTitle">Validar semanas</h2></div><button id="weeksClose" type="button" aria-label="Cerrar semanas">×</button></div><div class="weeks-body"><p id="weeksPeriod"></p><p id="weeksHelp">Marca las semanas que quieres incluir. Se muestran sólo las que tienen CSV disponible, según el calendario 4-4-5 del PBT.</p><button id="weeksAll" type="button" class="weeks-button">Seleccionar todas</button><div id="weeksOptions"></div><p id="weeksCount" role="status" aria-live="polite"></p><div class="weeks-actions"><button id="weeksCancel" type="button">Cancelar</button><button id="weeksApply" type="button">Validar semanas</button></div></div>';
 document.body.appendChild(dialog);
 $('weeksClose').addEventListener('click',()=>dialog.close());$('weeksCancel').addEventListener('click',()=>dialog.close());
 $('weeksAll').addEventListener('click',()=>{dialog.querySelectorAll('[name="pbt-week"]').forEach(n=>n.checked=true);count();});
 dialog.addEventListener('change',count);
 $('weeksApply').addEventListener('click',()=>{
  count();if($('weeksApply').disabled)return;
  const selected=[...dialog.querySelectorAll('[name="pbt-week"]:checked')].map(n=>n.value),all=available(pack(),context.months);
  try{validate(pack(),context.months,selected);context.apply(selected.length===all.length?[]:selected);dialog.close();}
  catch(error){$('weeksCount').textContent=error.message;}
 });
 dialog.addEventListener('close',()=>{opener?.setAttribute('aria-expanded','false');opener?.focus({preventScroll:true});context=null;});
 document.addEventListener('pbt:source',()=>{if(dialog.open)count();});
}
api.open=function(options){
 if(!root.PBT_WEEKLY?.ready||root.PBT_WEEKLY.loading)return;
 if(!dialog)build();context={...options,months:options.months.slice()};opener=options.opener;signature=stamp();
 const all=available(pack(),context.months),selected=ids(options.selected||[]),esc=root.escHtml;
 $('weeksPeriod').textContent=context.months.length?context.months.join(' · '):'Todos los meses disponibles';
 const groups=new Map();for(const w of all){if(!groups.has(w.label))groups.set(w.label,[]);groups.get(w.label).push(w);}
 $('weeksOptions').innerHTML=[...groups].map(([month,weeks])=>'<fieldset class="weeks-month"><legend>'+esc(month)+' <small>'+weeks.length+' disponibles</small></legend>'+weeks.map(w=>'<label><input type="checkbox" name="pbt-week" value="'+w.id+'" '+(!selected.length||selected.includes(w.id)?'checked':'')+'><span>Semana '+Number(w.id.slice(4))+'</span><small>'+w.id.slice(0,4)+'</small></label>').join('')+'</fieldset>').join('');
 count();dialog.showModal();opener?.setAttribute('aria-expanded','true');$('weeksTitle').setAttribute('tabindex','-1');$('weeksTitle').focus();
};
root.refreshPBTWeeks=function(tab){
 const button=$(tab+'_weeks'),summary=$(tab+'_weeks_summary');if(!button||!summary)return;
 const f=state[tab].filters,all=available(pack(),f.mes);button.disabled=!all.length||!!root.PBT_WEEKLY?.loading;
 let text='Preparando semanas…',error=false;
 if(all.length){try{const chosen=validate(pack(),f.mes,f.semana||[]);text=chosen.length+' de '+all.length+' semanas · '+(f.semana?.length?'selección validada':'todas disponibles');}catch(e){text='Revisa las semanas del mes';error=true;}}
 summary.textContent=text;summary.classList.toggle('weeks-error',error);
};
root.openPBTWeeks=function(tab){
 if(!['cafe','dt'].includes(tab))return;root.closeMS(tab,'mes',false);
 const f=state[tab].filters;api.open({months:f.mes,selected:f.semana||[],opener:$(tab+'_weeks'),apply:selected=>{f.semana=selected;root.renderDataTab(tab);}});
};
})(typeof globalThis!=='undefined'?globalThis:this);
