const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const compact=require('../js/plan-catalog.js');
const source=fs.readFileSync(path.join(__dirname,'../js/excel_data.js'),'utf8');
const original=JSON.parse(source.slice(source.indexOf('{')).trim().replace(/;$/,''));

test('all 459256 compact lookups return exactly the original play, including the largest team',()=>{
 let count=0;
 for(const tab of ['cafe','dt']){
  assert.deepEqual(compact[tab+'Candidates'],original[tab+'Candidates']);
  const vectors=new Map(compact[tab+'Candidates'].map(row=>[row.join(','),row]));
  for(const [key,play] of original[tab+'PlayEntries']){
   const split=key.indexOf(',');assert.equal(compact.lookupPlay(tab,Number(key.slice(0,split)),vectors.get(key.slice(split+1))),play,key);count++;
  }
  assert.equal(compact.lookupPlay(tab,1,compact[tab+'Candidates'][0]),undefined);
 }
 assert.equal(count,459256);
 for(const key of ['routines','coords','channelProd'])assert.deepEqual(compact[key],original[key]);
});

test('repeated and tied nearest selections retain the first original candidate',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),start=html.indexOf('function dist('),end=html.indexOf('function cellPos(',start);
 const context={EXCEL_DATA:compact,NEAREST:{cafe:new Map(),dt:new Map()},round0:Math.round};vm.createContext(context);vm.runInContext(html.slice(start,end),context);
 const nearest=(tab,values)=>{let best=original[tab+'Candidates'][0],distance=Infinity;for(const row of original[tab+'Candidates']){const d=row.reduce((sum,value,i)=>sum+(value-values[i])**2,0);if(d<distance){distance=d;best=row;if(d===0)break;}}return best;};
 for(const tab of ['cafe','dt'])for(let i=0;i<60;i++){
  const values=Array.from({length:8},(_,j)=>(i*17+j*23)%101),expected=nearest(tab,values);
  assert.deepEqual([...context.nearestMix(tab,values)],expected);assert.deepEqual([...context.nearestMix(tab,values)],expected);
 }
});
