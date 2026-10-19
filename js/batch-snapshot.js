/* Builds batch snapshots with the same catalog, geometry and unit engine as the single plan. */
(function(root){
'use strict';
root.buildPBTBatchSnapshot=function(input,today=new Date()){
 const job=PBT_BATCH_CORE.normalize(input),tab=job.tab,source=root.PBT_WEEKLY,label='CeCo '+job.ceco;
 if(!source?.ready||!source.engine||source.loading||!root.PBT_PLAN?.ready)throw Error('Espera a que los motores y el catálogo estén listos.');
 const engine=source.engine;
 if(!engine.availableStores(config[tab].tipoEngine).includes(label))throw Error('El CeCo no tiene datos activos para este tipo de tienda.');
 if(job.months.some(m=>!engine.months.includes(m)))throw Error('Uno de los meses ya no está disponible. Revisa el lote.');
 PBT_WEEKS.validate(engine.pack,job.months,job.weeks||[]);
 const data=engine.calculate({Tienda:[label],Mes:job.months,Semana:job.weeks||[],Weekpart:[job.weekpart],DayPart:[job.daypart]},config[tab].tipoEngine);
 if(!data.valid||!data.registros||data.basis!=='units')throw Error(data.reason||'No hay datos válidos para este período y turno.');
 const ch=data.canales,m=data.mix,pc=data.playCanales||ch,pm=data.playMix||m;
 const mapCh=o=>({lobby:o.Lobby,mop:o['Pick up & Delivery'],dt:tab==='dt'?o.DT:0}),mapMix=o=>({esp:o.Espresso,brew:o['Café filtrado'],cbs:o.CBS,food:o.Food,other:o.Otro});
 const play=getPlay(tab,job.partners,mapCh(pc),mapMix(pm)).play,rows=EXCEL_DATA.routines?.[play],raw=EXCEL_DATA.coords?.[play];
 if(!play||!rows?.length||!raw?.length)throw Error('No existe un plan original completo para esta combinación.');
 const profile=root.PBT_DEVICE?.get('team:'+job.ceco)||{},names=Array.isArray(profile.names)?profile.names:[],assigned=profile.assignments||{},photos=profile.photos||{};
 const person=letter=>{const key=pbtCleanLetter(letter);return cleanPartnerName(Object.prototype.hasOwnProperty.call(assigned,key)?assigned[key]:names[key.charCodeAt(0)-65]||'');};
 const photo=name=>{const value=photos[names.indexOf(name)+1]||'';return /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value)?value:'';};
 const fixed=new Map(rows.map(r=>[pbtCleanLetter(r[0]),pbtIsFixedValue(r[2])]));
 const tablet=tab==='dt'&&job.partnerTablet==='Sí';
 const style=document.createElement('div').style;
 const areas=raw.filter(r=>String(r[0]||'').replace(/^_/,'')===pbtLayoutName(tab)).map(r=>{
  const letter=String(r[3]||''),clean=pbtCleanLetter(letter),name=person(letter),isTablet=tablet&&clean==='B';
  const position=cellPos(isTablet?18:Number(r[1])+17,isTablet?10:Number(r[2])+1);
  // Match the browser's CSS serialization used by the individual PDF export.
  for(const property of ['left','top','width','height']){style[property]=position[property]+'%';position[property]=parseFloat(style[property]);}
  return {...position,marker:true,classes:['area',fixed.get(clean)?'partner':'support','partner-marker'],letter,name,photo:photo(name)};
 });
 if(!areas.length)throw Error('El catálogo no tiene coordenadas para este plano.');
 const routines=rows.map(r=>{const name=person(r[0]),t=tablet&&pbtCleanLetter(r[0])==='B';return {partner:r[0]+(name?' · '+name:''),station:r[1]+(t?' + Carril':''),fixed:r[2],routine:r[3]+(t?' + Tablet':'')};});
 const months=pbtPeriodLabel(job.months),days=pbtWeekLabel(job.weekpart).replace('–',' - '),daypart=PBT_BATCH_CORE.shiftLabel(job.daypart),store=pbtStoreLabel(label),quarter='Q'+(Math.floor(today.getMonth()/3)+1);
 const channels=mapCh(ch),mix=mapMix(m);
 return {title:config[tab].title,tab,partners:job.partners,partnerTablet:job.partnerTablet,store,ceco:job.ceco,weekpart:job.weekpart,daypartKey:job.daypart,months,selectedMonths:job.months.slice(),selectedWeeks:(job.weeks||[]).slice(),days,daypart,quarter,
  comments:'Plan para la tienda '+store+', con base en '+months+', '+days+' y turno '+daypart+'. Referencia para la planificación estimada del '+quarter+' actual.'+(job.weeks?.length?' '+PBT_WEEKS.label(job.weeks)+'.':''),
  channels:config[tab].channelLabels.map(([label,,key])=>[label,pctText(channels[key])]),mix:mixLabels.map(([label,,key])=>[label,pctText(mix[key])]),areas,routines,
  units:data.unidades,weeks:data.weeks.slice(),play};
};
})(globalThis);

