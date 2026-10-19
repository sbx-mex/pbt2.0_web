/* Combination validation and interoperable ZIP files. No remote dependencies. */
(function(root){
'use strict';
const MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAYS=['Weekday','Weekend'],SHIFTS=['Morning','Lunch','Afternoon'],MAX=120;
function monthCode(value){const m=/^(Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic) (20\d{2})$/.exec(value);if(!m)throw Error('Mes inválido.');return m[2]+'-'+String(MONTHS.indexOf(m[1])+1).padStart(2,'0');}
function normalize(job){
 if(!job||!/^\d{3,8}$/.test(String(job.ceco||''))||!['cafe','dt'].includes(job.tab))throw Error('Ingresa un CeCo válido.');
 const months=[...new Set(job.months||[])];months.forEach(monthCode);months.sort((a,b)=>monthCode(a).localeCompare(monthCode(b)));
 if(!months.length||months.length>24)throw Error('Selecciona entre 1 y 24 meses.');
 const partners=Number(job.partners);
 if(!DAYS.includes(job.weekpart)||!SHIFTS.includes(job.daypart)||!Number.isInteger(partners)||partners<2||partners>(job.tab==='dt'?13:11))throw Error('Combinación de turno o partners no válida.');
 return {ceco:String(job.ceco),tab:job.tab,months,weekpart:job.weekpart,daypart:job.daypart,partners,partnerTablet:job.tab==='dt'&&job.partnerTablet==='Sí'?'Sí':'No'};
}
function key(job){return JSON.stringify(normalize(job));}
function expand(base,choices){const jobs=[];for(const weekpart of DAYS)for(const daypart of SHIFTS)for(const partners of [...new Set(choices[weekpart]?.[daypart]||[])].sort((a,b)=>a-b))jobs.push(normalize({...base,weekpart,daypart,partners}));return jobs;}
function merge(existing,added){const map=new Map(existing.map(j=>[key(j),normalize(j)]));let duplicates=0;for(const job of added){const k=key(job);if(map.has(k))duplicates++;else map.set(k,normalize(job));}if(map.size>MAX)throw Error('El lote admite hasta '+MAX+' planes. Descárgalo antes de agregar más.');return {jobs:[...map.values()],duplicates,added:map.size-existing.length};}
const SHIFT_LABELS={Morning:'Mañana · 6 am a 12 pm',Lunch:'Intermedio · 12 pm a 5 pm',Afternoon:'Tarde · 5 pm a 6 am (día siguiente)'};
function shiftLabel(value){if(!SHIFTS.includes(value))throw Error('Turno inválido.');return SHIFT_LABELS[value];}
function periodName(months){
 const codes=months.map(monthCode),groups=[];let start=codes[0],last=start;
 const serial=v=>Number(v.slice(0,4))*12+Number(v.slice(5));
 for(const value of codes.slice(1)){if(serial(value)===serial(last)+1)last=value;else{groups.push(start===last?start:start+'a'+last);start=last=value;}}
 groups.push(start===last?start:start+'a'+last);return groups.join('+');
}
function pdfName(job){
 const j=normalize(job),day=j.weekpart==='Weekday'?'1-Lun-Jue':'2-Vie-Dom',shift={Morning:'1-Manana',Lunch:'2-Intermedio',Afternoon:'3-Tarde'}[j.daypart];
 const name=['PBT',j.ceco,periodName(j.months),day,shift,String(j.partners).padStart(2,'0')+'Partners',j.tab==='dt'?'DT_Tablet-'+(j.partnerTablet==='Sí'?'Si':'No'):'CAFE'].join('_')+'.pdf';
 if(name.length>255)throw Error('El nombre del período es demasiado largo. Divide los meses en dos lotes.');
 return name;
}
function path(job){return pdfName(job);}
function order(jobs){return jobs.map(normalize).sort((a,b)=>Number(a.ceco)-Number(b.ceco)||pdfName(a).localeCompare(pdfName(b),'en'));}
function archiveName(jobs,date=new Date()){
 if(!Array.isArray(jobs)||!jobs.length||jobs.length>MAX||!Number.isFinite(date.getTime()))throw Error('Lote o fecha no válidos.');
 const codes=[...new Set(jobs.map(j=>normalize(j).ceco))],ceco=codes.length===1?codes[0]:'VariosCeCo';
 const stamp=String(date.getDate()).padStart(2,'0')+String(date.getMonth()+1).padStart(2,'0')+String(date.getFullYear()).slice(-2);
 return 'PBT_Planes_'+jobs.length+'_'+ceco+'_'+stamp+'.zip';
}
const table=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;table[n]=c>>>0;}
function crc(bytes){let c=0xffffffff;for(const byte of bytes)c=table[(c^byte)&255]^(c>>>8);return (c^0xffffffff)>>>0;}
function zip(files,date=new Date()){
 if(!Array.isArray(files)||!files.length||files.length>MAX+2)throw Error('Contenido del ZIP no válido.');
 const locals=[],central=[],names=new Set(),encoder=new TextEncoder();let offset=0,total=0,centralSize=0;
 const year=Math.min(2107,Math.max(1980,date.getFullYear())),time=(date.getHours()<<11)|(date.getMinutes()<<5)|(date.getSeconds()>>1),day=((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate();
 for(const file of files){
  if(typeof file.name!=='string'||!file.name||file.name.startsWith('/')||file.name.split('/').some(p=>!p||p==='.'||p==='..')||/[\\\x00-\x1f]/.test(file.name)||names.has(file.name))throw Error('Nombre de archivo duplicado o inseguro en el ZIP.');
  names.add(file.name);const name=encoder.encode(file.name),bytes=file.bytes instanceof Uint8Array?file.bytes:encoder.encode(file.bytes);total+=bytes.length;
  if(name.length>65535||total>64*1024*1024)throw Error('El lote supera 64 MB. Divide los planes en dos lotes.');
  const sum=crc(bytes),header=new Uint8Array(30),h=new DataView(header.buffer);
  h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x800,true);h.setUint16(10,time,true);h.setUint16(12,day,true);h.setUint32(14,sum,true);h.setUint32(18,bytes.length,true);h.setUint32(22,bytes.length,true);h.setUint16(26,name.length,true);
  locals.push(header,name,bytes);
  const item=new Uint8Array(46),c=new DataView(item.buffer);c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x800,true);c.setUint16(12,time,true);c.setUint16(14,day,true);c.setUint32(16,sum,true);c.setUint32(20,bytes.length,true);c.setUint32(24,bytes.length,true);c.setUint16(28,name.length,true);c.setUint32(42,offset,true);
  central.push(item,name);centralSize+=46+name.length;offset+=30+name.length+bytes.length;
 }
 const end=new Uint8Array(22),e=new DataView(end.buffer);e.setUint32(0,0x06054b50,true);e.setUint16(8,files.length,true);e.setUint16(10,files.length,true);e.setUint32(12,centralSize,true);e.setUint32(16,offset,true);
 return new Blob([...locals,...central,end],{type:'application/zip'});
}
function pdfZip(files,date=new Date()){
 if(!Array.isArray(files)||!files.length||files.length>MAX)throw Error('Selecciona entre 1 y '+MAX+' PDF.');
 const names=new Set();
 for(const file of files){
  const name=file.name,bytes=file.bytes;
  if(typeof name!=='string'||name.length>255||!/^PBT_[A-Za-z0-9_+.-]+\.pdf$/.test(name)||names.has(name.toLowerCase()))throw Error('El ZIP admite sólo PDF con nombres únicos, sin subcarpetas.');
  if(!(bytes instanceof Uint8Array)||bytes.length<5||String.fromCharCode(...bytes.subarray(0,5))!=='%PDF-'||!new TextDecoder().decode(bytes.subarray(Math.max(0,bytes.length-1024))).includes('%%EOF'))throw Error('Uno de los PDF no se generó correctamente. Vuelve a intentar.');
  names.add(name.toLowerCase());
 }
 return zip(files,date);
}
const api={MAX,monthCode,normalize,key,expand,merge,path,pdfName,order,archiveName,shiftLabel,zip,pdfZip};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PBT_BATCH_CORE=api;
})(typeof globalThis!=='undefined'?globalThis:this);

