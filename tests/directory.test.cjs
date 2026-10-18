const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const directory=require('../js/store-directory.js');
test('every motor store has a directory name and retains its CeCo',()=>{
 const pack=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/motores/indice.json')));
 for(const [code] of pack.stores){const entry=directory.lookup('CeCo '+code);assert.equal(entry.code,code);assert.ok(entry.name);assert.ok(directory.label('CeCo '+code).startsWith(code+' · '));}
});
test('both CeCo and original store names resolve without guessing ambiguous names',()=>{
 assert.deepEqual(directory.lookup('CeCo 38333'),{code:'38333',name:'Izcalli Mega'});assert.deepEqual(directory.lookup('Luna Park'),{code:'38368',name:'Luna Park'});assert.equal(directory.lookup('38134 · Pilares').name,'Pilares');assert.equal(directory.lookup('No existe').code,'');assert.equal(directory.lookup('CeCo 000000').name,'');
});
