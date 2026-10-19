const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture(navigator={}){
 const nodes=[],timers=[],revoked=[];
 class Node{
  constructor(tag){this.tagName=tag;this.children=[];this.events={};this.disabled=false;nodes.push(this);}
  setAttribute(k,v){this[k]=v;}removeAttribute(k){delete this[k];}
  appendChild(n){this.children.push(n);return n;}
  addEventListener(name,fn){this.events[name]=fn;}
  showModal(){this.open=true;}close(){this.open=false;this.events.close?.();}remove(){this.removed=true;}
 }
 const body=new Node('body'),context={navigator,console,URL:{revokeObjectURL:url=>revoked.push(url)},setTimeout:fn=>timers.push(fn),document:{createElement:tag=>new Node(tag),body}};
 context.window=context;vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../js/print.js'),'utf8'),context);
 let focused=0;return {api:context.PBT_EXPORT,nodes,timers,revoked,button:{focus:()=>focused++},get focused(){return focused;}};
}
test('iOS detection covers iPhone, iPad desktop mode and desktop browsers',()=>{
 for(const [nav,expected] of [[{userAgent:'iPhone'},true],[{userAgent:'Mozilla Macintosh',platform:'MacIntel',maxTouchPoints:5},true],[{userAgent:'Macintosh',platform:'MacIntel',maxTouchPoints:0},false],[{userAgent:'Windows'},false]])assert.equal(fixture(nav).api.isIOS(),expected);
});
test('file share uses the explicit tap and blocks repeat taps and close while pending',async()=>{
 let release,shared;const f=fixture({canShare:()=>true,share:args=>{shared=args;return new Promise(r=>release=r);}}),file={name:'PBT.pdf',type:'application/pdf'};
 f.api.offerFile(file,'blob:pdf',f.button);const dialog=f.nodes.find(n=>n.tagName==='dialog'),share=f.nodes.find(n=>n.textContent==='Guardar en Archivos / compartir'),close=f.nodes.find(n=>n.textContent==='Cerrar');
 assert.equal(shared,undefined);const pending=share.onclick();assert.equal(shared.files[0],file);assert.equal(share.disabled,true);assert.equal(close.disabled,true);
 let prevented=false;dialog.events.cancel({preventDefault:()=>prevented=true});assert.equal(prevented,true);release();await pending;assert.equal(share.disabled,false);assert.equal(close.disabled,false);
});
test('cancelling native share preserves the file and permits retry without an error',async()=>{
 const f=fixture({canShare:()=>true,share:async()=>{const e=Error('cancelled');e.name='AbortError';throw e;}});f.api.offerFile({name:'PBT.zip',type:'application/zip'},'blob:zip',f.button);
 const dialog=f.nodes.find(n=>n.tagName==='dialog');await f.nodes.find(n=>n.textContent==='Guardar en Archivos / compartir').onclick();
 assert.equal(dialog.open,true);assert.equal(f.nodes.find(n=>n.role==='status').textContent,'');assert.equal(f.nodes.find(n=>n.tagName==='a').download,'PBT.zip');
});
test('a rejected share leaves an actionable download for both PDF and ZIP',async()=>{
 for(const [type,kind] of [['application/pdf','PDF'],['application/zip','ZIP']]){
 const f=fixture({canShare:()=>true,share:async()=>{throw Error('blocked');}});f.api.offerFile({name:'PBT.'+kind.toLowerCase(),type},'blob:file',f.button);
 await f.nodes.find(n=>n.textContent==='Guardar en Archivos / compartir').onclick();assert.match(f.nodes.find(n=>n.role==='status').textContent,new RegExp('Descargar '+kind));
 const link=f.nodes.find(n=>n.tagName==='a');assert.equal(link.rel,'noopener');assert.equal(link.href,'blob:file');assert.equal(link.textContent,'Descargar '+kind);
 }
});
test('unsupported or throwing canShare retains download and revokes only the dialog URL after closing',()=>{
 for(const canShare of [()=>false,()=>{throw Error('unsupported');}]){
 const f=fixture({canShare,share(){throw Error('unexpected share');}});f.api.offerFile({name:'PBT.zip',type:'application/zip'},'blob:dialog-copy',f.button);
 assert.equal(f.nodes.some(n=>n.textContent==='Guardar en Archivos / compartir'),false);assert.ok(f.nodes.find(n=>n.textContent==='Descargar ZIP'));
 f.nodes.find(n=>n.textContent==='Cerrar').onclick();assert.equal(f.focused,1);assert.deepEqual(f.revoked,[]);f.timers.forEach(fn=>fn());assert.deepEqual(f.revoked,['blob:dialog-copy']);
 }
});
