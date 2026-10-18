(function(root){
 'use strict';
 const MONTHS=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
 const HEADERS=['Tiendas','Semana','Clas_Semana','DayPart','Distribucion Canal','Mix de Producto','Unidades'];
 const DAYPARTS={'1_Mañana':'Morning','2_Intermedio':'Lunch','3_Tarde':'Afternoon'};
 const WEEKPARTS={'Lun-Jue':'Weekday','Vie-Dom':'Weekend'};
 const MIX={Espresso:5,COD:6,CBS:7,Food:8,Otro:9};
 const CHANNEL={Lobby:10,'Pick up & Delivery':11,DT:12};
 function number(value){
  let text=String(value||'').trim(),negative=false;
  if(!text)return 0;
  if(/^\(.*\)$/.test(text)){negative=true;text=text.slice(1,-1);}
  else if(text[0]==='-'){negative=true;text=text.slice(1);}
  if(!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/.test(text))throw Error('Unidades no numéricas: '+text.slice(0,40));
  const amount=Number(text.replace(/,/g,''));
  if(!Number.isFinite(amount)||amount>1e9)throw Error('Unidades fuera de límite');
  return negative?-amount:amount;
 }
 function weekInfo(value){
  if(!/^20\d{2}(?:0[1-9]|[1-4]\d|5[0-3])$/.test(value))throw Error('Semana inválida; se requiere AAAASS: '+value);
  const year=Number(value.slice(0,4)),week=Number(value.slice(4));
  const month=[4,8,13,17,21,26,30,34,39,43,47,53].findIndex(end=>week<=end);
  return {id:value,month:year+'-'+String(month+1).padStart(2,'0'),label:MONTHS[month]+' '+year};
 }
 function decode(buffer){
  const bytes=new Uint8Array(buffer);
  if(bytes[0]===255&&bytes[1]===254)return new TextDecoder('utf-16le').decode(bytes);
  if(bytes[0]===254&&bytes[1]===255)return new TextDecoder('utf-16be').decode(bytes);
  try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{return new TextDecoder('windows-1252').decode(bytes);}
 }
 function splitCSV(text,delimiter){
  const rows=[];let row=[],cell='',quoted=false,closed=false;
  for(let i=0;i<text.length;i++){
   const ch=text[i];
   if(quoted){if(ch==='"'){if(text[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;continue;}
   if(ch==='"'){if(cell||closed)throw Error('CSV con comillas inválidas');quoted=true;}
   else if(ch===delimiter){row.push(cell);cell='';closed=false;}
   else if(ch==='\r'||ch==='\n'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(value=>value!==''))rows.push(row);row=[];cell='';closed=false;}
   else{if(closed&&ch.trim())throw Error('Texto fuera de una celda CSV');cell+=ch;}
   if(rows.length>250001||cell.length>100000)throw Error('CSV excede el límite de lectura');
  }
  if(quoted)throw Error('CSV con comillas sin cerrar');
  row.push(cell);if(row.some(value=>value!==''))rows.push(row);
  return rows;
 }
 async function digest(buffer){
  const value=await root.crypto.subtle.digest('SHA-256',buffer);
  return [...new Uint8Array(value)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 async function parseMotor(buffer,path){
  if(!buffer.byteLength||buffer.byteLength>25*1024*1024)throw Error('CSV vacío o mayor a 25 MB: '+path);
  const text=decode(buffer),lines=text.split(/\r?\n/);let start=-1,delimiter;
  for(let i=0;i<Math.min(100,lines.length)&&start<0;i++)for(const candidate of [',',';','\t']){
   let fields;try{fields=splitCSV(lines[i],candidate)[0]||[];}catch{continue;}
   if(HEADERS.every(name=>fields.includes(name))){start=i;delimiter=candidate;break;}
  }
  if(start<0)throw Error(path+': faltan columnas de Mix de Producto');
  const rows=splitCSV(lines.slice(start).join('\n'),delimiter),headers=rows.shift();
  if(new Set(headers).size!==headers.length)throw Error(path+': encabezados duplicados');
  const indices=Object.fromEntries(headers.map((name,i)=>[name,i]));
  const groups=new Map(),seen=new Set(),weeks=new Set(),dt=new Set();let units=0,unitsAA=0,negativeRows=0;
  for(const cells of rows){
   if(cells.length!==headers.length)throw Error(path+': fila con columnas incompletas');
   const row=Object.fromEntries(headers.map(name=>[name,String(cells[indices[name]]||'').trim()]));
   const code=row.Tiendas,week=row.Semana;
   if(!/^\d{3,8}$/.test(code))throw Error(path+': CeCo inválido');
   weekInfo(week);weeks.add(week);if(weeks.size>1)throw Error(path+': conserva una semana por motor CSV');
   if(!Object.hasOwn(DAYPARTS,row.DayPart)||!Object.hasOwn(WEEKPARTS,row.Clas_Semana)||!Object.hasOwn(MIX,row['Mix de Producto'])||!Object.hasOwn(CHANNEL,row['Distribucion Canal']))throw Error(path+': categoría, canal o contexto desconocido');
   const key=JSON.stringify(HEADERS.slice(0,-1).map(name=>row[name]));
   if(seen.has(key))throw Error(path+': registro duplicado en la misma semana');seen.add(key);
   const amount=number(row.Unidades),aa=number(row['Unidades AA']),dim=[code,week,DAYPARTS[row.DayPart],WEEKPARTS[row.Clas_Semana]],groupKey=dim.join('|');
   if(!groups.has(groupKey))groups.set(groupKey,[...dim,...Array(10).fill(0)]);
   const target=groups.get(groupKey);target[4]+=amount;target[MIX[row['Mix de Producto']]]+=amount;target[CHANNEL[row['Distribucion Canal']]]+=amount;target[13]++;
   if(row['Distribucion Canal']==='DT')dt.add(code);
   units+=amount;unitsAA+=aa;negativeRows+=Number(amount<0);
  }
  if(!rows.length)throw Error(path+': sin registros');
  return {file:{path,sha256:await digest(buffer),bytes:buffer.byteLength,week:[...weeks][0],rows:rows.length,units,unitsAA,negativeRows},rows:[...groups.values()],dt:[...dt]};
 }
 function combine(motors){
  const files=[],rows=[],duplicates=[],weeks=new Map(),fingerprints=new Set(),dt=new Set();
  for(const motor of motors){const meta=motor.file;
   if(fingerprints.has(meta.sha256)){duplicates.push(meta.path);continue;}
   if(weeks.has(meta.week))throw Error('Dos motores diferentes para semana '+meta.week+'. Conserva una versión.');
   fingerprints.add(meta.sha256);weeks.set(meta.week,meta.path);files.push(meta);rows.push(...motor.rows);motor.dt.forEach(code=>dt.add(code));
  }
  rows.sort((a,b)=>a.slice(0,4).join('|').localeCompare(b.slice(0,4).join('|'),'en'));
  return {schema:1,basis:'units',calendar:'PBT-445',files,duplicates,weeks:[...weeks.keys()].sort().map(weekInfo),stores:[...new Set(rows.map(row=>row[0]))].sort().map(code=>[code,dt.has(code)?'DT':'CAFE']),rows};
 }
 function validatePack(pack){
  if(!pack||pack.schema!==1||pack.basis!=='units'||pack.calendar!=='PBT-445'||!Array.isArray(pack.rows)||!pack.rows.length||pack.rows.length>1e6||!Array.isArray(pack.weeks)||!pack.weeks.length||pack.weeks.length>128||!Array.isArray(pack.stores)||!Array.isArray(pack.files))throw Error('Índice de motores incompatible');
  const weeks=new Map();for(const info of pack.weeks){const expected=weekInfo(info.id);if(info.month!==expected.month||info.label!==expected.label||weeks.has(info.id))throw Error('Calendario de motores inválido');weeks.set(info.id,info);}
  const stores=new Map();for(const item of pack.stores){if(!Array.isArray(item)||!/^\d{3,8}$/.test(item[0])||!['CAFE','DT'].includes(item[1])||stores.has(item[0]))throw Error('Catálogo de tiendas inválido');stores.set(...item);}
  const keys=new Set();let records=0,total=0;
  for(const row of pack.rows){
   if(!Array.isArray(row)||row.length!==14||!stores.has(row[0])||!weeks.has(row[1])||!['Morning','Lunch','Afternoon'].includes(row[2])||!['Weekday','Weekend'].includes(row[3])||!row.slice(4).every(value=>Number.isFinite(value)&&Math.abs(value)<1e12)||!Number.isInteger(row[13])||row[13]<1)throw Error('Registro de motor inválido');
   const key=row.slice(0,4).join('|');if(keys.has(key))throw Error('Grupos duplicados');keys.add(key);
   if(Math.abs(row.slice(5,10).reduce((a,b)=>a+b,0)-row[4])>.01||Math.abs(row.slice(10,13).reduce((a,b)=>a+b,0)-row[4])>.01)throw Error('Unidades sin conciliación');
   records+=row[13];total+=row[4];
  }
  if(pack.files.length!==weeks.size||pack.files.some(file=>!weeks.has(file.week)||!/^.+\.csv$/i.test(file.path)||!Number.isFinite(file.units)||!Number.isInteger(file.rows)||!file.rows||!Number.isInteger(file.bytes)||!file.bytes||file.bytes>25*1024*1024||!/^[a-f0-9]{64}$/.test(file.sha256)))throw Error('Manifiesto de motores inválido');
  if(new Set(pack.files.map(file=>file.week)).size!==weeks.size||records!==pack.files.reduce((n,file)=>n+file.rows,0)||Math.abs(total-pack.files.reduce((n,file)=>n+file.units,0))>.01)throw Error('Totales de motores no conciliados');
  return pack;
 }
 function engine(pack){
  validatePack(pack);
  const stores=new Map(pack.stores),weeks=new Map(pack.weeks.map(info=>[info.id,info])),cache=new Map();
  const months=[...new Set(pack.weeks.map(info=>info.label))];
  const labels=type=>pack.stores.filter(item=>item[1]===type).map(item=>'CeCo '+item[0]);
  function calculate(filters={},type='CAFE'){
   const key=type+'|'+JSON.stringify(filters);if(cache.has(key))return cache.get(key);
   const sum=Array(10).fill(0),visible=new Set(),activeWeeks=new Set();
   for(const row of pack.rows){
    if(stores.get(row[0])!==type)continue;
    if(filters.Mes?.length&&!filters.Mes.includes(weeks.get(row[1]).label))continue;
    if(filters.DayPart?.length&&!filters.DayPart.includes(row[2]))continue;
    if(filters.Weekpart?.length&&!filters.Weekpart.includes(row[3]))continue;
    if(filters.Semana?.length&&!filters.Semana.includes(row[1]))continue;
    if(filters.Tienda?.length&&!filters.Tienda.includes('CeCo '+row[0]))continue;
    for(let i=0;i<10;i++)sum[i]+=row[i+4];visible.add(row[0]);activeWeeks.add(row[1]);
   }
   const pct=(part,total)=>total>0?Math.round(part/total*100):0;
   const fix=(obj,keys)=>{const total=keys.reduce((n,k)=>n+obj[k],0);if(total&&total!==100)obj[keys[0]]+=100-total;return obj;};
   const mix=fix({Espresso:pct(sum[1],sum[0]),'Café filtrado':pct(sum[2],sum[0]),CBS:pct(sum[3],sum[0]),Food:pct(sum[4],sum[0]),Otro:pct(sum[5],sum[0])},['Espresso','Café filtrado','CBS','Food','Otro']);
   const channelTotal=sum[6]+sum[7]+(type==='DT'?sum[8]:0);
   const canales=fix({Lobby:pct(sum[6],channelTotal),'Pick up & Delivery':pct(sum[7],channelTotal),DT:type==='DT'?pct(sum[8],channelTotal):0},type==='DT'?['Lobby','Pick up & Delivery','DT']:['Lobby','Pick up & Delivery']);
   const result={registros:sum[9],tiendasVisibles:visible.size,unidades:sum[0],basis:'units',weeks:[...activeWeeks].sort(),mix,canales};
   cache.set(key,result);if(cache.size>120)cache.delete(cache.keys().next().value);return result;
  }
  return {calculate,months,stores:labels,pack};
 }
 const api={number,weekInfo,decode,splitCSV,parseMotor,combine,validatePack,engine};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PBT_WEEKLY_CORE=api;
})(typeof globalThis!=='undefined'?globalThis:this);
