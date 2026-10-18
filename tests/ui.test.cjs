const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(){
 const elements=new Map(),node=id=>{if(!elements.has(id)){const classes=new Set();elements.set(id,{id,hidden:false,disabled:false,value:'',textContent:'',innerHTML:'',children:[],classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,value)=>{const add=value===undefined?!classes.has(x):value;add?classes.add(x):classes.delete(x);return add;}},setAttribute(k,v){this[k]=v;},removeAttribute(k){delete this[k];},querySelectorAll:()=>[]});}return elements.get(id);};
 let calls=0,lastFilters=null;
 const result={registros:1,valid:true,basis:'units',unidades:100,tiendasVisibles:1,mix:{Espresso:36,'Café filtrado':3,CBS:45,Food:12,Otro:4},canales:{Lobby:95,'Pick up & Delivery':5,DT:0}};
 const engine={months:['Ene 2026'],stores:type=>type==='DT'?['CeCo 38134']:type==='CAFE'?['CeCo 38333']:['CeCo 38333','CeCo 38134'],typeOf:name=>name==='CeCo 38134'?'DT':'CAFE',calculate(filters){calls++;lastFilters=filters;assert.equal(filters.Tienda.length,1);return result;}};
 const context={console,document:{readyState:'loading',addEventListener(){},getElementById:node,querySelectorAll:()=>[]},navigator:{},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},setInterval(){},PBT_ENGINE:{calculate:()=>{throw Error('The weekly source must be used');}},EXCEL_DATA:{},PBT_WEEKLY:{active:true,ready:true,engine},PBT_DIRECTORY:require('../js/store-directory.js'),pbtContextHTML:()=>'',pbtWeekLabel:v=>v==='Weekend'?'Vie–Dom':'Lun–Jue',pbtDayLabel:v=>({Morning:'Mañana',Lunch:'Intermedio',Afternoon:'Tarde'}[v]),syncCalculationContext(){},renderPBTAudit(){},updateAboutContext(){},savePBTContext(){}};
 context.window=context;vm.createContext(context);
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');for(const match of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(match[1].trim())vm.runInContext(match[1],context);
 context.renderLayout=()=>{};context.renderRoutines=()=>{};vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/print.js'),'utf8'),context);
 return {context,node,engine,result,get calls(){return calls;},get filters(){return lastFilters;}};
}
test('the UI never calculates or displays aggregate data before a store is selected',()=>{
 const f=fixture(),c=f.context;c.initPBT();c.renderDataTab('cafe');c.renderDataTab('dt');
 assert.equal(c.calculate('cafe').requiresStore,true);assert.equal(f.calls,0);assert.equal(f.node('cafe_results').hidden,true);assert.equal(f.node('dt_controls').hidden,true);assert.equal(f.node('cafe_layout').innerHTML,'');assert.equal(f.node('cafe_export').disabled,true);assert.throws(()=>c.buildPBTSnapshot('cafe'),/Selecciona una tienda/);
});
test('selecting a store passes its exact key and returning to a tab requires a new selection',()=>{
 const f=fixture(),c=f.context;c.state.cafe.filters.tienda=['CeCo 38333'];c.state.cafe.filters.weekpart=['Weekday'];c.state.cafe.filters.daypart=['Morning'];c.renderDataTab('cafe');
 assert.equal(f.filters.Tienda[0],'CeCo 38333');assert.equal(f.node('cafe_results').hidden,false);assert.match(f.node('cafe_mix').innerHTML,/36%/);assert.doesNotMatch(f.node('cafe_mix').innerHTML,/\.\d%/);
 const before=f.calls;c.showTab('cafe');assert.equal(c.state.cafe.filters.tienda.length,0);assert.equal(f.node('cafe_results').hidden,true);assert.equal(f.calls,before);
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
