
var MAPS={cafe:null,dt:null},NEAREST={cafe:new Map(),dt:new Map()},activeTab='cafe';
var state={cafe:{mode:'auto',filters:{q:[],daypart:[],mes:[],semana:[],weekpart:[],tienda:[]},partners:4},dt:{mode:'auto',filters:{q:[],daypart:[],mes:[],semana:[],weekpart:[],tienda:[]},partners:11,partnerTablet:'No'}};
var config={cafe:{title:'CAFE',maxPartners:11,tipoEngine:'CAFE',channelLabels:[['Lobby','G14','lobby'],['Pick up & Delivery','H14','mop']]},dt:{title:'DRIVE THRU',maxPartners:13,tipoEngine:'DT',channelLabels:[['Lobby','G14','lobby'],['Pick up & Delivery','H14','mop'],['DT','I14','dt']]}};
var mixLabels=[['Espresso','K14','esp'],['COD','L14','brew'],['CBS','K15','cbs'],['Food','L15','food'],['Otro','K16','other']];
function round0(v){v=Number(v||0);return Number.isFinite?Number.isFinite(v)?Math.round(v):0:isFinite(v)?Math.round(v):0}function pctText(n){return n==null||!Number.isFinite(Number(n))?'—':Math.round(Number(n))+'%'}function escHtml(v){return String(v||'').replace(/[&<>\"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]})}
function cleanPartnerName(v){
  return String(v||'')
    .replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ0-9 ._-]/g,'')
    .slice(0,8)
    .toUpperCase();
}
function getSourceList(name){
 if(!window.PBT_WEEKLY||!PBT_WEEKLY.active||!PBT_WEEKLY.engine)return [];
 if(name==='Mes')return PBT_WEEKLY.engine.months;
 if(name==='TiendaCafe')return (PBT_WEEKLY.engine.availableStores||PBT_WEEKLY.engine.stores)('CAFE');
 if(name==='TiendaDT')return (PBT_WEEKLY.engine.availableStores||PBT_WEEKLY.engine.stores)('DT');return [];
}
function buildPlayMap(tab){if(MAPS[tab])return MAPS[tab];var entries=(tab==='cafe'?EXCEL_DATA.cafePlayEntries:EXCEL_DATA.dtPlayEntries)||[],m={};for(var i=0;i<entries.length;i++)m[entries[i][0]]=entries[i][1];MAPS[tab]=m;return m}
function dist(a,b){var s=0;for(var i=0;i<8;i++){var d=(a[i]||0)-(b[i]||0);s+=d*d}return s}function nearestMix(tab,vals){var key=vals.join(','),cache=NEAREST[tab];if(cache.has(key))return cache.get(key);var arr=(tab==='cafe'?EXCEL_DATA.cafeCandidates:EXCEL_DATA.dtCandidates)||[],best=arr[0]||[0,0,0,0,0,0,0,0],bd=Infinity;for(var i=0;i<arr.length;i++){var d=dist(arr[i],vals);if(d<bd){bd=d;best=arr[i];if(d===0)break}}cache.set(key,best);if(cache.size>120)cache.delete(cache.keys().next().value);return best}
function getPlay(tab,partners,channels,mix){var vals=tab==='cafe'?[channels.lobby,channels.mop,0,mix.esp,mix.brew,mix.cbs,mix.food,mix.other]:[channels.lobby,channels.mop,channels.dt,mix.esp,mix.brew,mix.cbs,mix.food,mix.other];var nearest=nearestMix(tab,vals.map?vals.map(round0):vals);var key=[round0(partners)].concat(nearest).join(',');var play=EXCEL_DATA.lookupPlay?EXCEL_DATA.lookupPlay(tab,round0(partners),nearest):buildPlayMap(tab)[key];return{play:play,nearest:nearest,key:key}}
function cellPos(row,col,rowspan,colspan){row=Number(row);col=Number(col);rowspan=Number(rowspan||1);colspan=Number(colspan||1);var startRow=18,rows=10,startCol=2,widths=[9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,9.08203125,10.83203125],total=0,leftWidth=0,blockWidth=0;for(var i=0;i<widths.length;i++){total+=widths[i];if(i<col-startCol)leftWidth+=widths[i];if(i>=col-startCol&&i<col-startCol+colspan)blockWidth+=widths[i]}return{left:leftWidth/total*100,top:(row-startRow)/rows*100,width:blockWidth/total*100,height:rowspan/rows*100}}
function block(cls,row,col,rowspan,colspan,text){var p=cellPos(row,col,rowspan,colspan);return '<div class="area '+cls+'" style="left:'+p.left+'%;top:'+p.top+'%;width:'+p.width+'%;height:'+p.height+'%">'+text+'</div>'}
function staticLayout(tab){
 var sheet=PBT_SHEET[tab],html='';
 function area(row,col,rs,cs,style,text,cls){var p=cellPos(row,col,rs,cs);return '<div class="area sheet-area '+(cls||'')+'" style="left:'+p.left+'%;top:'+p.top+'%;width:'+p.width+'%;height:'+p.height+'%;'+style+'">'+escHtml(text||'')+'</div>';}
 sheet.cells.forEach(function(c){var style='background:'+c[2]+';border:0;';[['l','left'],['t','top'],['r','right'],['b','bottom']].forEach(function(side){if(c[3].includes(side[0]))style+='border-'+side[1]+':1px solid #333;';});html+=area(c[0],c[1],1,1,style);});
 sheet.labels.forEach(function(c){html+=area(c[0],c[1],c[2],c[3],'border:0;color:'+c[5]+';',c[4],'sheet-label');});return html;
}
function fallbackCoords(tab){return tab==='cafe'?[['',23,9,'A'],['',22,5,'B'],['',21,8,'C.'],['',24,8,'D.']]:[['',19,5,'A'],['',20,5,'B'],['',26,10,'C'],['',26,6,'D'],['',26,8,'E'],['',25,7,'F.'],['',23,4,'G'],['',22,4,'H'],['',23,4,'I.'],['',25,4,'J'],['',27,9,'K.']]}
function pbtIsFixedValue(v){var t=String(v||'').trim().toLowerCase();return t==='sí'||t==='si'||t==='yes'||t==='true'||t==='1';}
function pbtCleanLetter(v){return String(v||'').replace('.','').trim().toUpperCase();}
function pbtLayoutName(tab){return tab==='cafe'?'Cafe_S_2M2O2P_Left_1':'Dt_L_2M2O2P_Left_1';}
function layoutMarkers(tab,play){
  try{
    var layoutName=pbtLayoutName(tab), rows=(EXCEL_DATA.routines&&EXCEL_DATA.routines[play])||[];
    var fixedByPartner={};
    for(var i=0;i<rows.length;i++){
      var rr=rows[i], lk=pbtCleanLetter(rr[0]);
      if(lk) fixedByPartner[lk]=pbtIsFixedValue(rr[2]);
    }
    var raw=(EXCEL_DATA.coords&&EXCEL_DATA.coords[play])||[], cs=[];
    for(var j=0;j<raw.length;j++){
      var x=raw[j], xLayout=String(x[0]||'').replace(/^_/,'');
      if(xLayout===layoutName){
        cs.push({row:Number(x[1])+17,col:Number(x[2])+1,letter:String(x[3]||'')});
      }
    }
    var usingFallback=false;
    if(!cs.length){
      var fb=fallbackCoords(tab); usingFallback=true;
      for(var f=0;f<fb.length;f++)cs.push({row:Number(fb[f][1]),col:Number(fb[f][2]),letter:String(fb[f][3]||'')});
    }
    var tabletOn=tab==='dt'&&state.dt&&state.dt.partnerTablet==='Sí', html='';
    for(var a=0;a<cs.length;a++){
      var item=cs[a], clean=pbtCleanLetter(item.letter), row=item.row, col=item.col;
      if(tabletOn && clean==='B' && !usingFallback){row=18; col=10;}
      var p=cellPos(row,col), fixed=!!fixedByPartner[clean];
      var cls=fixed?'partner':'support', pname=getPartnerName(tab,clean);
      html+='<div class="area '+cls+' partner-marker" data-fixed="'+(fixed?'Si':'No')+'" style="left:'+p.left+'%;top:'+p.top+'%;width:'+p.width+'%;height:'+p.height+'%">'+photoBubbleHTML(tab,pname)+'<span class="marker-letter">'+escHtml(item.letter)+'</span><span class="marker-name">'+escHtml(pname)+'</span></div>';
    }
    return html;
  }catch(e){console.log('Fallback layoutMarkers iOS',e);return fallbackMarkers(tab,play)}
}
function fallbackMarkers(tab,play){
  var cs=fallbackCoords(tab), rows=(EXCEL_DATA.routines&&EXCEL_DATA.routines[play])||[], fixedByPartner={}, html='';
  for(var r=0;r<rows.length;r++){var key=pbtCleanLetter(rows[r][0]);if(key)fixedByPartner[key]=pbtIsFixedValue(rows[r][2])}
  for(var i=0;i<cs.length;i++){
    var p=cellPos(cs[i][1],cs[i][2]), letter=String(cs[i][3]||''), clean=pbtCleanLetter(letter);
    var known=Object.prototype.hasOwnProperty.call(fixedByPartner,clean), fixed=known&&fixedByPartner[clean];
    var cls=known?(fixed?'partner':'support'):'unknown-marker', pname=getPartnerName(tab,clean), status=known?(fixed?'Si':'No'):'Sin dato';
    html+='<div class="area '+cls+' partner-marker" data-fixed="'+status+'" style="left:'+p.left+'%;top:'+p.top+'%;width:'+p.width+'%;height:'+p.height+'%">'+photoBubbleHTML(tab,pname)+'<span class="marker-letter">'+escHtml(letter)+'</span><span class="marker-name">'+escHtml(pname)+'</span></div>';
  }
  return html;
}
function renderLayout(tab,play){
 var el=document.getElementById(tab+'_layout');if(!el)return;
 el.innerHTML='<div class="sheet-grid" style="height:'+(1000/PBT_SHEET[tab].rows)+'%">'+staticLayout(tab)+(play?layoutMarkers(tab,play):fallbackMarkers(tab,play))+'</div>';
}
function partnerSelectHTML(tab,letter){var clean=String(letter||'').replace('.','').trim().toUpperCase(),selected=getAssignedPartner(tab,clean),names=getTeamList(tab),seen={},unique=[];for(var i=0;i<names.length;i++){var n=String(names[i]||'').trim().toUpperCase();if(n&&!seen[n]){seen[n]=true;unique.push(n)}}var html='<option value="">Nombre</option>';if(selected&&!seen[selected])html+='<option value="'+escHtml(selected)+'" selected>'+escHtml(selected)+'</option>';for(var j=0;j<unique.length;j++)html+='<option value="'+escHtml(unique[j])+'" '+(unique[j]===selected?'selected':'')+'>'+escHtml(unique[j])+'</option>';return '<select class="partner-name-select" data-change="assign" data-tab="'+tab+'" data-letter="'+clean+'">'+html+'</select>'}
function fallbackRoutines(tab){var n=state[tab].partners||4,letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''),rows=[];var stCafe=['POS 1','Bar 1','Soporte','Soporte','Bar 2','CBS 1','CBS 2','Horno 1','Hand off 1'];var stDt=['DTR','DTO','POS 1','Bar 1','Bar 2','Soporte','CBS 1','CBS 2','Horno 1','Hand off 1','Soporte'];for(var i=0;i<n&&i<letters.length;i++){var st=(tab==='cafe'?stCafe[i]||'Soporte':stDt[i]||'Soporte');rows.push([letters[i],st,(st==='Soporte'?'No':'Sí'),'Función '+st])}return rows}
function renderRoutines(tab,play){var rows=(EXCEL_DATA.routines&&EXCEL_DATA.routines[play])||fallbackRoutines(tab),tbody=document.getElementById(tab+'_tbody');if(!tbody)return;var tabletOn=tab==='dt'&&state.dt&&state.dt.partnerTablet==='Sí',html='';for(var i=0;i<rows.length;i++){var r=rows[i],letra=String(r[0]||''),clean=letra.replace('.','').trim().toUpperCase(),isDtoTablet=tabletOn&&clean==='B',estacion=isDtoTablet?r[1]+' + Carril':r[1],rutina=isDtoTablet?r[3]+' + Tablet':r[3];html+='<tr><td><div class="partner-name-cell"><span class="partner-letter">'+letra+'</span>'+partnerSelectHTML(tab,letra)+'</div></td><td>'+estacion+'</td><td>'+r[2]+'</td><td>'+rutina+'</td></tr>'}tbody.innerHTML=html}
function setTotals(tab,channels,mix){
 var values=[channels.lobby,channels.mop].concat(tab==='dt'?[channels.dt]:[]),m=[mix.esp,mix.brew,mix.cbs,mix.food,mix.other];
 var sum=function(arr){return arr.some(function(n){return n==null})?null:arr.reduce(function(a,n){return a+Math.round(n*10)},0)/10};
 var chTotal=sum(values),mixTotal=sum(m),ch=document.getElementById(tab+'_channelTotal'),mt=document.getElementById(tab+'_mixTotal');
 if(ch){ch.textContent='Total: '+pctText(chTotal);ch.className=chTotal===100?'total ok':'total bad'}
 if(mt){mt.textContent='Total: '+pctText(mixTotal);mt.className=mixTotal===100?'total ok':'total bad'}
 return {chTotal:chTotal,mixTotal:mixTotal,valid:chTotal===100&&mixTotal===100};
}
function filterHTML(tab,key,label){var id=tab+'_'+key;return '<div class="filter"><label id="'+id+'_title">'+label+'</label><div class="ms" id="'+id+'_ms"><button class="ms-btn" id="'+id+'_button" type="button" aria-expanded="false" aria-controls="'+id+'_panel" aria-labelledby="'+id+'_title '+id+'_label" data-click="months" data-tab="'+tab+'" data-key="'+key+'"><span id="'+id+'_label">Todos</span><span aria-hidden="true">▾</span></button><div class="ms-panel" id="'+id+'_panel" role="group" aria-labelledby="'+id+'_title"><div class="ms-actions"><button type="button" data-click="months-all" data-tab="'+tab+'" data-key="'+key+'">Todos los meses</button></div><div id="'+id+'_options"></div></div></div></div>'}
function storeSearchHTML(tab,label){return '<div class="store-search"><label for="'+tab+'_tienda_search">'+label+'</label><div class="store-search-wrap"><input class="store-search-input" id="'+tab+'_tienda_search" placeholder="Cargando…" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="'+tab+'_tienda_results" data-input="search" data-focus="search" data-keydown="search" data-tab="'+tab+'"><button class="store-search-clear" type="button" aria-label="Cambiar tienda" title="Cambiar tienda" data-click="clear" data-tab="'+tab+'">×</button></div><div class="store-results" id="'+tab+'_tienda_results" role="listbox" aria-label="Tiendas"></div><span class="sr-only" id="'+tab+'_store_count" role="status"></span><div id="'+tab+'_store_error" class="store-error" role="alert"></div></div>'}
function buildPage(tab){
 var c=config[tab],opts='';for(var i=2;i<=c.maxPartners;i++)opts+='<option value="'+i+'" '+(i===state[tab].partners?'selected':'')+'>'+i+'</option>';
 document.getElementById(tab).innerHTML='<div class="card filter-card"><div class="card-title">Filtro</div><div class="card-body">'+storeSearchHTML(tab,'Tienda')+'<div class="filters operativo" id="'+tab+'_controls" hidden>'+filterHTML(tab,'mes','Mes / meses')+'<div class="filter"><label for="'+tab+'_partners">Partners</label><select class="partner-select" id="'+tab+'_partners" data-change="partners" data-tab="'+tab+'">'+opts+'</select></div>'+(tab==='dt'?'<div class="filter"><label for="dt_partnerTablet_filter">Partner Tablet</label><select class="partner-select" id="dt_partnerTablet_filter" data-change="tablet" data-tab="'+tab+'"><option value="No">No</option><option value="Sí">Sí</option></select></div>':'')+pbtContextHTML(tab)+'</div></div></div><div id="'+tab+'_results" hidden><p class="plan-context" id="'+tab+'_context"></p><div class="manual-top"><div class="box"><div class="box-title">Distribución de canal</div><div class="box-body"><div class="metric-grid '+(tab==='cafe'?'channels-cafe':'channels-dt')+'" id="'+tab+'_channels"></div></div></div><div class="box"><div class="box-title">Mix de producto</div><div class="box-body"><div class="metric-grid mix-grid" id="'+tab+'_mix"></div></div></div></div><div class="plan-toolbar" id="'+tab+'_plan"><h2>Plan de distribución</h2><div class="plan-actions"><button class="export-button" id="'+tab+'_export" type="button" data-click="export">Exportar PDF</button></div></div><div class="layout-wrap" id="'+tab+'_layout_wrap" tabindex="0" role="region" aria-label="Plano de distribución"><div class="layout" id="'+tab+'_layout"></div></div><details class="routines-panel" id="'+tab+'_routines" open><summary>Rutinas</summary><div class="table-wrap"><table><thead><tr><th>Partner</th><th>Estación</th><th>Fijo</th><th>Rutinas</th></tr></thead><tbody id="'+tab+'_tbody"></tbody></table></div></details></div>';
}
function fillMS(tab,key,values){var box=document.getElementById(tab+'_'+key+'_options');if(!box)return;var html='',chosen=state[tab].filters[key]||[];values=values||[];for(var i=0;i<values.length;i++){var safe=escHtml(values[i]);html+='<label class="ms-option"><input type="checkbox" value="'+safe+'" '+(!chosen.length||chosen.includes(values[i])?'checked':'')+' data-change="months" data-tab="'+tab+'" data-key="'+key+'"><span class="ms-option-text"><span class="ms-main">'+safe+'</span></span></label>'}box.innerHTML=html;updateMSLabel(tab,key)}
function populateFilters(){fillMS('cafe','mes',getSourceList('Mes'));fillMS('dt','mes',getSourceList('Mes'))}
function closeMS(tab,key,focus){var id=tab+'_'+key,el=document.getElementById(id+'_ms'),button=document.getElementById(id+'_button');if(el)el.classList.remove('open');if(button){button.setAttribute('aria-expanded','false');if(focus&&button.focus)button.focus();}}
function toggleMS(tab,key){var id=tab+'_'+key,el=document.getElementById(id+'_ms'),opening=el&&!el.classList.contains('open');['cafe','dt'].forEach(function(name){closeMS(name,'mes',false)});if(opening){el.classList.add('open');document.getElementById(id+'_button').setAttribute('aria-expanded','true');}}

function changeMS(tab,key){var checked=document.querySelectorAll('#'+tab+'_'+key+'_options input:checked'),all=document.querySelectorAll('#'+tab+'_'+key+'_options input'),arr=[];for(var i=0;i<checked.length;i++)arr.push(checked[i].value);if(!arr.length){fillMS(tab,key,getSourceList('Mes'));return;}state[tab].filters[key]=arr.length===all.length?[]:arr;updateMSLabel(tab,key);renderDataTab(tab)}
function selectAllMS(tab,key){state[tab].filters[key]=[];fillMS(tab,key,getSourceList('Mes'));renderDataTab(tab)}
function clearMS(tab,key){selectAllMS(tab,key)}
function updateMSLabel(tab,key){var el=document.getElementById(tab+'_'+key+'_label'),arr=state[tab].filters[key]||[];if(el)el.textContent=arr.length===0?'Todos':arr.length===1?arr[0]:arr.length+' meses'}

function normalizeStoreText(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()}
function getStoreList(tab){return tab==='cafe'?getSourceList('TiendaCafe'):getSourceList('TiendaDT')}
function pbtStoreLabel(value){return window.PBT_DIRECTORY?PBT_DIRECTORY.label(value):String(value||'')}
function closeStoreResults(tab){var box=document.getElementById(tab+'_tienda_results'),input=document.getElementById(tab+'_tienda_search');if(box)box.classList.remove('open');if(input){input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');}}
function activeStoreOption(tab,index){var input=document.getElementById(tab+'_tienda_search'),items=document.getElementById(tab+'_tienda_results').querySelectorAll('.store-option');for(var i=0;i<items.length;i++){items[i].classList.toggle('active',i===index);items[i].setAttribute('aria-selected',String(i===index));}if(items[index]){input.setAttribute('aria-activedescendant',items[index].id);if(items[index].scrollIntoView)items[index].scrollIntoView({block:'nearest'});}else input.removeAttribute('aria-activedescendant');}
function searchStore(tab,value){
 var box=document.getElementById(tab+'_tienda_results'),input=document.getElementById(tab+'_tienda_search');if(!box||input.disabled)return;
 var selected=state[tab].filters.tienda[0],q=normalizeStoreText(value).replace(/^ceco\s*(?=\d)/,''),list=getStoreList(tab);
 if(selected&&value===pbtStoreLabel(selected))q='';else if(selected){state[tab].filters.tienda=[];renderDataTab(tab);}
 var seen=new Set(),matches=[];
 list.forEach(function(name){if(seen.has(name))return;seen.add(name);var item=PBT_DIRECTORY.lookup(name),code=item.code,text=normalizeStoreText(item.name||name),score=99;if(!q)score=0;else if(code===q)score=0;else if(text===q)score=1;else if(code.indexOf(q)===0)score=2;else if(text.indexOf(q)===0)score=3;else if(q.split(/\s+/).every(function(word){return normalizeStoreText(pbtStoreLabel(name)+' '+name).includes(word)}))score=4;if(score<99)matches.push({name:name,score:score});});
 matches.sort(function(a,b){return a.score-b.score||pbtStoreLabel(a.name).localeCompare(pbtStoreLabel(b.name),'es');});matches=matches.slice(0,20);
 box.innerHTML=matches.length?matches.map(function(item,i){var name=item.name,dt=PBT_WEEKLY.engine.typeOf(name)==='DT';return '<button id="'+tab+'_store_option_'+i+'" type="button" tabindex="-1" role="option" aria-selected="false" class="store-option" data-click="store" data-tab="'+tab+'" data-store="'+escHtml(name)+'"><span>'+escHtml(pbtStoreLabel(name))+'</span><small>'+(dt?'DT':'Café')+'</small></button>'}).join(''):'<div class="store-empty">Sin coincidencias</div>';
 box.classList.add('open');input.setAttribute('aria-expanded','true');activeStoreOption(tab,0);document.getElementById(tab+'_store_count').textContent=matches.length+' resultados';
}
function storeKeydown(ev,tab){
 var box=document.getElementById(tab+'_tienda_results'),wasOpen=box.classList.contains('open');
 if(ev.key==='Enter'){if(wasOpen){ev.preventDefault();var selected=box.querySelector('.store-option.active');if(selected)selected.click();}return;}
 if(ev.key==='Escape'||ev.key==='Tab'){closeStoreResults(tab);return;}
 if(!['ArrowDown','ArrowUp','Home','End'].includes(ev.key))return;ev.preventDefault();if(!wasOpen)searchStore(tab,document.getElementById(tab+'_tienda_search').value);
 var items=box.querySelectorAll('.store-option');if(!items.length)return;var current=Array.prototype.findIndex.call(items,function(el){return el.classList.contains('active')}),next=!wasOpen?0:(current+(ev.key==='ArrowDown'?1:-1)+items.length)%items.length;if(ev.key==='Home')next=0;if(ev.key==='End'||(!wasOpen&&ev.key==='ArrowUp'))next=items.length-1;activeStoreOption(tab,next);
}

function selectStore(tab,name){
 if(!window.PBT_WEEKLY||!PBT_WEEKLY.active||!getStoreList(tab).includes(String(name)))return;
 if(window.saveStorePlan)saveStorePlan(tab);state[tab].filters.tienda=[String(name)];
 if(window.restoreStorePlan)restoreStorePlan(tab);
 document.getElementById(tab+'_tienda_search').value=pbtStoreLabel(name);closeStoreResults(tab);
 fillMS(tab,'mes',getSourceList('Mes'));applyOperationalContext(false);showTab(tab,true);
 if(window.savePBTContext)savePBTContext();
 var input=document.getElementById(tab+'_tienda_search');if(input.blur)input.blur();
}
function clearStore(tab){state[tab].filters.tienda=[];var input=document.getElementById(tab+'_tienda_search');if(input)input.value='';closeStoreResults(tab);renderDataTab(tab);if(input&&input.focus)input.focus()}
document.addEventListener('click',function(e){if(!e.target.closest('.store-search'))['cafe','dt'].forEach(closeStoreResults);if(!e.target.closest('.ms'))['cafe','dt'].forEach(function(tab){closeMS(tab,'mes',false)});});
document.addEventListener('keydown',function(e){if(e.key==='Escape')['cafe','dt'].forEach(function(tab){var el=document.getElementById(tab+'_mes_ms');if(el&&el.classList.contains('open')){e.preventDefault();closeMS(tab,'mes',true);}});});

function pad2(n){n=String(n);return n.length<2?'0'+n:n}
function getOperationalContext(date){date=date||new Date();var day=date.getDay(),hour=date.getHours(),minute=date.getMinutes(),weekpart=day>=1&&day<=4?'Weekday':'Weekend',daypart='Afternoon';if(hour>=6&&hour<12)daypart='Morning';else if(hour>=12&&hour<17)daypart='Lunch';var dias=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];return{weekpart:weekpart,daypart:daypart,stamp:dias[day]+' '+pad2(date.getDate())+'/'+pad2(date.getMonth()+1)+' · '+pad2(hour)+':'+pad2(minute),key:weekpart+'|'+daypart+'|'+hour}}
var operationalKey='';function applyOperationalContext(force){var ctx=getOperationalContext(),changed=ctx.key!==operationalKey;['cafe','dt'].forEach(function(tab){var automatic=state[tab].mode!=='manual';if(automatic){state[tab].filters.weekpart=[ctx.weekpart];state[tab].filters.daypart=[ctx.daypart];}syncCalculationContext(tab,ctx);if(force||(automatic&&changed))renderDataTab(tab);});operationalKey=ctx.key;}

function getEngineFilters(tab){var f=state[tab].filters;return{Q:f.q,DayPart:f.daypart,Mes:f.mes,Semana:f.semana,Weekpart:f.weekpart,Tienda:f.tienda}}function calculate(tab){
 if(state[tab].filters.tienda.length!==1)return {registros:0,valid:false,basis:'units',requiresStore:true,mix:{},canales:{}};
 var source=window.PBT_WEEKLY;
 if(!source||!source.active||!source.ready||!source.engine)return {registros:0,valid:false,basis:'units',mix:{},canales:{},reason:'Motor CSV no disponible.'};
 try{return source.engine.calculate(getEngineFilters(tab),config[tab].tipoEngine)}catch(e){return {registros:0,valid:false,basis:'units',mix:{},canales:{},reason:'No se pudo calcular este filtro. Relee los motores en Acerca de.'};}
}
function pick(obj,names){for(var i=0;i<names.length;i++)if(obj&&obj[names[i]]!=null)return obj[names[i]];return 0}function valuesFromData(tab){
 var data=calculate(tab),mix=data.mix||{},canales=data.canales||{};
 function mapValues(ch,m){return {channels:{lobby:pick(ch,['Lobby','Cafe','CAFE']),mop:pick(ch,['Pick up & Delivery','PickUpDelivery','MOP & Delivery','MOP']),dt:tab==='dt'?pick(ch,['DT','Drive Thru']):0},mix:{esp:pick(m,['Espresso','ESPRESSO']),brew:pick(m,['Café filtrado','COD','Café Filtrado','CafeFiltrado','BREWED','Brewed']),cbs:pick(m,['CBS']),food:pick(m,['Food','FOOD']),other:pick(m,['Otro','Other','OTHER'])}}}
 var displayValues=mapValues(canales,mix),plan=mapValues(data.playCanales||canales,data.playMix||mix);
 if(!data.registros||!data.valid){Object.keys(displayValues.channels).forEach(function(k){displayValues.channels[k]=null});Object.keys(displayValues.mix).forEach(function(k){displayValues.mix[k]=null})}
 return {raw:data,partners:state[tab].partners,channels:displayValues.channels,mix:displayValues.mix,planChannels:plan.channels,planMix:plan.mix};
}
function renderDataTab(tab){
 var selected=state[tab].filters.tienda.length===1,controls=document.getElementById(tab+'_controls'),results=document.getElementById(tab+'_results'),button=document.getElementById(tab+'_export'),input=document.getElementById(tab+'_tienda_search'),error=document.getElementById(tab+'_store_error');
 if(!controls||!results)return;if(window.savePBTSession)savePBTSession();if(window.saveStorePlan)saveStorePlan(tab);if(tab===activeTab){document.getElementById('teamButton').disabled=!selected;if(window.refreshPBTNavigation)refreshPBTNavigation();
 if(!selected){document.getElementById('equipo').hidden=true;document.getElementById('teamButton').setAttribute('aria-expanded','false');}}input.disabled=!!(window.PBT_WEEKLY&&!PBT_WEEKLY.ready);input.placeholder=input.disabled?(PBT_WEEKLY.loading?'Cargando…':'Revisar motor'):'CeCo o tienda';input.setAttribute('aria-busy',String(input.disabled&&!!PBT_WEEKLY.loading));controls.hidden=!selected;results.hidden=!selected;error.textContent='';
 if(!selected){document.getElementById(tab+'_layout').innerHTML='';document.getElementById(tab+'_tbody').innerHTML='';document.getElementById(tab+'_channels').innerHTML='';document.getElementById(tab+'_mix').innerHTML='';button.disabled=true;setTotals(tab,{lobby:null,mop:null,dt:null},{esp:null,brew:null,cbs:null,food:null,other:null});if(window.updateAboutContext)updateAboutContext();return;}
 var c=config[tab],v=valuesFromData(tab),valid=!!v.raw.registros&&v.raw.valid===true;button.disabled=!valid||!!window.PBT_EXPORT_BUSY;
 var ch='',mx='';c.channelLabels.forEach(function(x){ch+='<div class="metric"><label>'+x[0]+'</label><span>'+pctText(v.channels[x[2]])+'</span></div>'});mixLabels.forEach(function(y){mx+='<div class="metric"><label>'+y[0]+'</label><span>'+pctText(v.mix[y[2]])+'</span></div>'});
 document.getElementById(tab+'_channels').innerHTML=ch;document.getElementById(tab+'_mix').innerHTML=mx;setTotals(tab,v.channels,v.mix);renderPBTAudit(tab,v.raw);
 if(!valid){var reason=v.raw.reason||'Sin datos para este filtro.';document.getElementById(tab+'_layout').innerHTML='<div class="empty-motor">'+escHtml(reason)+'</div>';document.getElementById(tab+'_tbody').innerHTML='';}
 else if(window.PBT_PLAN&&!PBT_PLAN.ready){
  button.disabled=true;document.getElementById(tab+'_layout').innerHTML='<div class="empty-motor">'+escHtml(PBT_PLAN.error?'No se pudo cargar el catálogo. Usa Volver a cargar.':'Preparando el plan de distribución…')+'</div>';document.getElementById(tab+'_tbody').innerHTML='';
 }
 else {try{var res=getPlay(tab,v.partners,v.planChannels,v.planMix);if(!res.play)throw Error('No existe un plan original para esta combinación de partners. Elige de 2 a '+c.maxPartners+'.');renderLayout(tab,res.play);renderRoutines(tab,res.play);}
 catch(problem){button.disabled=true;document.getElementById(tab+'_layout').innerHTML='<div class="empty-motor">'+escHtml(problem.message||'No se pudo mostrar el plan. Vuelve a cargar.')+'</div>';document.getElementById(tab+'_tbody').innerHTML='';}}

 if(window.updateAboutContext)updateAboutContext();if(window.refreshPBTNavigation)refreshPBTNavigation();
}
function setPartners(tab){state[tab].partners=Number(document.getElementById(tab+'_partners').value);renderDataTab(tab)}function syncPartnerTabletSelects(){var el=document.getElementById('dt_partnerTablet_filter');if(el)el.value=state.dt.partnerTablet||'No'}function setPartnerTablet(tab,value){if(tab==='dt'){state.dt.partnerTablet=value||'No';syncPartnerTabletSelects();renderDataTab(tab)}}function showTab(tab,keepSelection){
 if(!['cafe','dt'].includes(tab))return;
 activeTab=tab;if(!document.getElementById('equipo').hidden)buildEquipo();
 ['cafe','dt'].forEach(function(name){document.getElementById(name).classList.toggle('active',name===tab);var button=document.getElementById(name==='cafe'?'tabCafe':'tabDt');button.classList.toggle('active',name===tab);button.setAttribute('aria-selected',String(name===tab));button.setAttribute('tabindex',name===tab?'0':'-1');closeStoreResults(name);closeMS(name,'mes',false)});renderDataTab(tab);if(!keepSelection&&!state[tab].filters.tienda.length){var input=document.getElementById(tab+'_tienda_search');if(input&&!input.disabled&&input.focus)input.focus();}
}
function initPBT(){if(typeof PBT_DIRECTORY==='undefined'||typeof PBT_SHEET==='undefined'){document.getElementById('appLoading').textContent='No se pudo cargar PBT. Recarga la página.';return;}buildPage('cafe');buildPage('dt');window.PBT_UI_READY=true;populateFilters();syncPartnerTabletSelects();applyOperationalContext(true);setInterval(function(){applyOperationalContext(false)},60000)}
if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',initPBT);else initPBT();

document.addEventListener('pbt:plan',function(){if(window.PBT_UI_READY){renderDataTab('cafe');renderDataTab('dt');}});
