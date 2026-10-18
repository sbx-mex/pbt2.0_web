const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
 const elements=new Map(),node=id=>{if(!elements.has(id)){const classes=new Set();elements.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,value)=>{const add=value===undefined?!classes.has(x):value;add?classes.add(x):classes.delete(x);return add;}},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},querySelectorAll:()=>[],querySelector:()=>null,focus(){},scrollIntoView(){}});}return elements.get(id);};
 let calls=0,lastFilters=null;
 const result={registros:1,valid:true,basis:'units',unidades:100,tiendasVisibles:1,mix:{Espresso:36,'Café filtrado':3,CBS:45,Food:12,Otro:4},canales:{Lobby:95,'Pick up & Delivery':5,DT:0}};
 const engine={months:['Ene 2026'],stores:type=>type==='DT'?['CeCo 38134']:type==='CAFE'?['CeCo 38333']:['CeCo 38333','CeCo 38134'],typeOf:name=>name==='CeCo 38134'?'DT':'CAFE',calculate(filters){calls++;lastFilters=filters;assert.equal(filters.Tienda.length,1);return result;}};
 const memory=new Map(),device={get:k=>memory.has(k)?JSON.parse(memory.get(k)):undefined,set:(k,v)=>{memory.set(k,JSON.stringify(v));return Promise.resolve(true);},legacy:()=>null,requestPersistence(){}};
 const context={console,addEventListener(){},PBT_DEVICE:device,document:{readyState:'loading',addEventListener(){},getElementById:node,querySelectorAll:()=>[]},navigator:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setInterval(){},PBT_SHEET:require('../js/sheet-template.js'),EXCEL_DATA:{},PBT_WEEKLY:{active:true,ready:true,engine},PBT_DIRECTORY:require('../js/store-directory.js'),pbtContextHTML:()=>'',pbtWeekLabel:v=>v==='Weekend'?'Vie–Dom':'Lun–Jue',pbtDayLabel:v=>({Morning:'Mañana',Lunch:'Intermedio',Afternoon:'Tarde'}[v]),syncCalculationContext(){},renderPBTAudit(){},updateAboutContext(){},savePBTContext(){}};
 context.window=context;vm.createContext(context);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())vm.runInContext(match[1],context);
 node('equipo').hidden=true;vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/device-ui.js'),'utf8'),context);
 context.renderLayout=()=>{};context.renderRoutines=()=>{};vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/print.js'),'utf8'),context);
 return {context,node,engine,result,get calls(){return calls;},get filters(){return lastFilters;}};
}
test('the UI never calculates or displays aggregate data before a store is selected',()=>{
 const f=fixture(),c=f.context;c.initPBT();c.renderDataTab('cafe');c.renderDataTab('dt');
 assert.equal(c.calculate('cafe').requiresStore,true);assert.equal(f.calls,0);assert.equal(f.node('cafe_results').hidden,true);assert.equal(f.node('dt_controls').hidden,true);assert.equal(f.node('cafe_layout').innerHTML,'');assert.equal(f.node('cafe_export').disabled,true);assert.throws(()=>c.buildPBTSnapshot('cafe'),/Selecciona una tienda/);
});
test('selecting a store passes its exact key and returning to a tab preserves the selected store',()=>{
 const f=fixture(),c=f.context;c.state.cafe.filters.tienda=['CeCo 38333'];c.state.cafe.filters.weekpart=['Weekday'];c.state.cafe.filters.daypart=['Morning'];c.renderDataTab('cafe');
 assert.equal(f.filters.Tienda[0],'CeCo 38333');assert.equal(f.node('cafe_results').hidden,false);assert.match(f.node('cafe_mix').innerHTML,/36%/);assert.doesNotMatch(f.node('cafe_mix').innerHTML,/\.\d%/);
 const before=f.calls;c.showTab('dt');c.showTab('cafe');assert.equal(c.state.cafe.filters.tienda[0],'CeCo 38333');assert.equal(f.node('cafe_results').hidden,false);assert.ok(f.calls>before);
});
test('PDF snapshots contain names only when selected and retain the CeCo for naming',()=>{
 const f=fixture(),c=f.context;c.state.cafe.filters.tienda=['CeCo 38333'];c.state.cafe.filters.weekpart=['Weekday'];c.state.cafe.filters.daypart=['Morning'];
 let name='Seleccionar';const first={querySelector:selector=>selector==='select'?{value:name}:{textContent:'A'}};
 const cells=[first,{textContent:'POS 1'},{textContent:'Sí'},{textContent:'Rutina'}];f.node('cafe_tbody').querySelectorAll=()=>[{querySelectorAll:()=>cells}];
 let result=c.buildPBTSnapshot('cafe');assert.equal(result.ceco,'38333');assert.equal(result.routines[0].partner,'A');name='ENRIQUE';result=c.buildPBTSnapshot('cafe');assert.equal(result.routines[0].partner,'A · ENRIQUE');assert.equal(result.store,'38333 · Izcalli Mega');
});
test('Enter on a closed store search cannot select a stale hidden option',()=>{
 const f=fixture(),c=f.context;let clicks=0;const item={click:()=>clicks++};f.node('cafe_tienda_results').querySelector=()=>item;f.node('cafe_tienda_results').querySelectorAll=()=>[item];
 c.storeKeydown({key:'Enter',preventDefault(){}},'cafe');assert.equal(clicks,0);
 f.node('cafe_tienda_results').classList.add('open');c.storeKeydown({key:'Enter',preventDefault(){}},'cafe');assert.equal(clicks,1);
});

test('an unavailable CSV engine never falls back to historical sale data',()=>{
 const f=fixture(),c=f.context;c.state.cafe.filters.tienda=['CeCo 38333'];c.PBT_WEEKLY.active=false;c.PBT_WEEKLY.ready=false;
 c.PBT_ENGINE={calculate(){throw Error('Obsolete sale source was called');}};
 assert.equal(c.calculate('cafe').valid,false);assert.deepEqual([...c.getSourceList('Mes')],[]);assert.equal(f.calls,0);
 c.renderDataTab('cafe');assert.equal(f.node('cafe_export').disabled,true);assert.throws(()=>c.buildPBTSnapshot('cafe'),/Motor CSV no disponible/);
});

test('the PDF month range omits years without inventing unselected months',()=>{
 const c=fixture().context;
 assert.equal(c.pbtPeriodLabel(['Mar 2026','Ene 2026','Feb 2026','Feb 2026']),'Ene - Mar');
 assert.equal(c.pbtPeriodLabel(['Ene 2026','Mar 2026','Abr 2026']),'Ene, Mar - Abr');
 assert.equal(c.pbtPeriodLabel(['Ene 2026','Dic 2025']),'Dic - Ene');
 assert.equal(c.pbtPeriodLabel(['Jun 2026']),'Jun');assert.throws(()=>c.pbtPeriodLabel([]),/Selecciona meses/);assert.throws(()=>c.pbtPeriodLabel(['Bad']),/Mes no válido/);
});

test('comments reflect the selected store and filters and explicitly identify the estimated current quarter',()=>{
 const f=fixture(),c=f.context;c.state.cafe.filters={tienda:['CeCo 38333'],mes:['Ene 2026','Feb 2026'],weekpart:['Weekend'],daypart:['Lunch']};
 const result=c.buildPBTSnapshot('cafe',new Date(2026,9,18));assert.equal(result.months,'Ene - Feb');assert.equal(result.days,'Vie - Dom');assert.equal(result.daypart,'Intermedio');
 assert.match(result.comments,/38333 · Izcalli Mega/);assert.match(result.comments,/Ene - Feb, Vie - Dom y turno Intermedio/);assert.match(result.comments,/estimada del Q4 actual/);assert.doesNotMatch(result.comments,/2026/);
});

test('store search tolerates CeCo prefixes and mixed code/name queries and excludes directory-only stores',()=>{
 const f=fixture(),c=f.context;
 for(const query of ['ceco38333','38333 Izcalli','IZCÁLLI mega']){c.searchStore('cafe',query);assert.match(f.node('cafe_tienda_results').innerHTML,/38333 · Izcalli Mega/);}
 c.searchStore('cafe','38101');assert.match(f.node('cafe_tienda_results').innerHTML,/Sin coincidencias/);
});

test('large or non-image team photos are rejected before decoding and preserve stored photos',()=>{
 const c=fixture().context,messages=[];let writes=0;c.alert=message=>messages.push(message);c.localStorage.setItem=()=>writes++;
 for(const file of [{type:'image/jpeg',size:11*1024*1024},{type:'text/plain',size:50}]){const input={files:[file],value:'selected'};c.savePartnerPhoto('cafe',1,input);assert.equal(input.value,'');}
 assert.match(messages[0],/10 MB/);assert.match(messages[1],/imagen/);assert.equal(writes,0);
});


test('store suggestions and direct selection cannot cross Cafe/DT',()=>{
 const f=fixture(),c=f.context;c.searchStore('cafe','38134');assert.match(f.node('cafe_tienda_results').innerHTML,/Sin coincidencias/);
 c.searchStore('dt','38333');assert.match(f.node('dt_tienda_results').innerHTML,/Sin coincidencias/);
 c.selectStore('cafe','CeCo 38134');assert.equal(c.state.cafe.filters.tienda.length,0);assert.equal(c.activeTab,'cafe');
});

test('team names, photos and explicit empty assignments remain isolated by CeCo',()=>{
 const f=fixture(),c=f.context;c.state.cafe.filters.tienda=['CeCo 38333'];
 c.PBT_DEVICE.set('team:38333',{names:['ANA'],photos:{1:'data:image/jpeg;base64,YWJj'},assignments:{A:'ANA'}});
 c.setTeamPartner('cafe',1,{value:'JESSICA'});assert.equal(c.getPartnerName('cafe','A'),'JESSICA');assert.equal(c.getPartnerPhoto('cafe','JESSICA'),'data:image/jpeg;base64,YWJj');
 c.state.cafe.filters.tienda=['CeCo 38368'];assert.equal(c.getPartnerPhoto('cafe','JESSICA'),'');assert.equal(c.getTeamList('cafe').length,0);
 c.state.cafe.filters.tienda=['CeCo 38333'];assert.equal(c.getTeamList('cafe')[0],'JESSICA');c.setPartnerName('cafe','A',{value:''});assert.equal(c.getPartnerName('cafe','A'),'');
});

test('saved CeCo, months, manual context and partner counts restore together',()=>{
 const f=fixture(),c=f.context;c.PBT_DEVICE.set('session',{activeTab:'dt',dt:{store:'CeCo 38134',mode:'manual',mes:['Ene 2026'],weekpart:'Weekend',daypart:'Afternoon',partners:6,partnerTablet:'Sí'},cafe:{store:'CeCo 38333',partners:5}});
 c.restorePBTSession();assert.equal(c.activeTab,'dt');assert.equal(c.state.dt.filters.tienda[0],'CeCo 38134');assert.equal(c.state.dt.partners,6);assert.equal(c.state.dt.mode,'manual');assert.equal(c.state.dt.filters.daypart[0],'Afternoon');assert.equal(c.state.dt.filters.mes[0],'Ene 2026');
 c.state.dt.partners=7;c.savePBTSession();assert.equal(c.PBT_DEVICE.get('session').dt.partners,7);
});
