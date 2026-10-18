/* PBT Letter renderer: original sheet hierarchy, coordinates and fixed status. */
(function(root){
 'use strict';
 const PAGE=[612,792],MARGIN=36;
 function filename(snapshot){
  const code=String(snapshot.ceco||''),partners=Number(snapshot.partners);
  const days={Weekday:'lun-jue',Weekend:'vie-dom','Lun–Jue':'lun-jue','Lun-Jue':'lun-jue','Vie–Dom':'vie-dom','Vie-Dom':'vie-dom'}[snapshot.weekpart||snapshot.days];
  const part={Morning:'Manana',Lunch:'Intermedio',Afternoon:'Tarde','Mañana':'Manana',Intermedio:'Intermedio',Tarde:'Tarde'}[snapshot.daypartKey||snapshot.daypart];
  if(!/^\d{3,8}$/.test(code)||!days||!part||!Number.isInteger(partners)||partners<1||partners>13)throw Error('Selecciona una tienda y un filtro válido antes de exportar.');
  return 'PBT_'+code+'_'+days+'_'+part+'_'+partners+'Partners.pdf';
 }
 async function create(snapshot,lib){
  const {PDFDocument,StandardFonts,rgb}=lib,pdf=await PDFDocument.create();
  pdf.setTitle(filename(snapshot).replace(/\.pdf$/,''));pdf.setSubject(snapshot.store+' · '+snapshot.months+' · '+snapshot.days+' · '+snapshot.daypart);
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const color=hex=>{const h=hex.replace('#','');return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);};
  const GREEN='#007050',INK='#202d28',LINE='#a9b7ae',GRAY='#e6e6e6';
  const safe=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/\u202f/g,' ').replace(/[^\n\x20-\x7e\xa0-\xff\u2022]/g,'');
  const wrap=(value,width,size=8,font=regular)=>{
   const lines=[];for(const paragraph of safe(value).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){
    if(!word)continue;if(font.widthOfTextAtSize(word,size)>width){if(current){lines.push(current);current='';}let part='';for(const char of word){if(font.widthOfTextAtSize(part+char,size)>width&&part){lines.push(part);part='';}part+=char;}current=part;}
    else if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){lines.push(current);current=word;}else current+=(current?' ':'')+word;
   }lines.push(current);}return lines.length?lines:[''];
  };
  let page;
  const rect=(x,top,w,h,fill=undefined,border=LINE,borderWidth=.5)=>page.drawRectangle({x,y:792-top-h,width:w,height:h,...(fill?{color:color(fill)}:{}),...(border?{borderColor:color(border),borderWidth}:{})});
  const text=(value,x,top,w,size=8,opts={})=>{
   const font=opts.bold?bold:regular,lines=wrap(value,Math.max(1,w),size,font),height=opts.lineHeight||size*1.2;
   lines.forEach((line,i)=>{const offset=opts.center?Math.max(0,(w-font.widthOfTextAtSize(line,size))/2):0;page.drawText(line,{x:x+offset,y:792-top-size-i*height,font,size,color:color(opts.color||INK)});});return lines.length*height;
  };
  const header=(label,x,top,w,h=17,size=8)=>{rect(x,top,w,h,GREEN,GREEN);text(label,x+4,top+Math.max(3,(h-size)/2-1),w-8,size,{bold:true,color:'#ffffff',center:true});};
  const newPage=()=>{page=pdf.addPage(PAGE);return page;};
  newPage();
  header('PBT · '+snapshot.store,36,36,540,24,10);
  let y=65;
  const fields=[['Mes / meses',snapshot.months,220],['Días',snapshot.days,90],['Turno',snapshot.daypart,130],['Partners',String(snapshot.partners),100]];
  const valueHeight=Math.max(23,...fields.map(([,value,w])=>wrap(value,w-12,8.5).length*10.2+8));
  let x=36;for(const [label,value,w] of fields){rect(x,y,w,17,'#ffffff');text(label,x+6,y+4,w-12,7.5);rect(x,y+17,w,valueHeight,GRAY);text(value,x+6,y+22,w-12,8.5,{bold:true});x+=w;}
  y+=17+valueHeight+12;
  header('Distribución de canal',36,y,194);header('Mix de producto',242,y,334);
  function metrics(items,left,width){const w=width/items.length;items.forEach(([label,value],i)=>{rect(left+i*w,y+17,w,16,'#ffffff');text(label,left+i*w+2,y+21,w-4,label.length>15?6.5:7,{center:true});rect(left+i*w,y+33,w,22,GRAY);text(value,left+i*w+2,y+38,w-4,10,{bold:true,center:true});});}
  metrics(snapshot.channels,36,194);metrics(snapshot.mix,242,334);
  y+=67;header('Plan de distribución',36,y,540,19);
  const photoPadding=snapshot.areas.some(area=>area.marker&&area.photo&&area.top<10)?24:0;
  const layoutTop=y+23+photoPadding,layoutHeight=228,layoutWidth=540;
  rect(36,layoutTop,layoutWidth,layoutHeight,'#f7f7f7','#394b42',.8);
  const fills={gray:'#a6a6a6',cbs:'#cfe0f6',pick:'#ffc000',hand:'#d8ccff',espresso:'#9a856d',pos:'#c6e0b4',food:'#ffe699',horno:'#f4b183',brew:'#6f5445','empty-zone':'#eeeeee'};
  for(const area of snapshot.areas.filter(item=>!item.marker)){
   const x=36+area.left/100*layoutWidth,top=layoutTop+area.top/100*layoutHeight,w=area.width/100*layoutWidth,h=area.height/100*layoutHeight;
   const fill=Object.keys(fills).find(name=>area.classes.includes(name));rect(x,top,w,h,fill?fills[fill]:'#ffffff','#333333',.5);
   if(area.text)text(area.text,x+2,top+Math.max(2,(h-16)/2),w-4,Math.min(8,w<42?6.2:8),{bold:true,center:true,color:fill==='brew'?'#ffffff':INK});
  }
  for(const area of snapshot.areas.filter(item=>item.marker)){
   const x=36+area.left/100*layoutWidth,top=layoutTop+area.top/100*layoutHeight,w=area.width/100*layoutWidth,h=area.height/100*layoutHeight,fixed=area.classes.includes('partner');
   rect(x,top,w,h,fixed?GREEN:'#ffffff',GREEN,.8);
   text(area.letter,x+1,top+3,w-2,11,{bold:true,center:true,color:fixed?'#ffffff':GREEN});
   if(area.name)text(area.name,x+1,top+15,w-2,5.3,{bold:true,center:true,color:fixed?'#ffffff':GREEN});
   if(area.photo){try{const image=area.photo.startsWith('data:image/png')?await pdf.embedPng(area.photo):await pdf.embedJpg(area.photo);page.drawImage(image,{x:x+(w-23)/2,y:792-top-1,width:23,height:23});}catch{/* A bad optional photo never prevents the plan export. */}}
  }
  y=layoutTop+layoutHeight+12;
  const columns=[['Partner',108],['Estación',93],['Fijo',31],['Rutinas',308]],tableHeader=()=>{let x=36;columns.forEach(([label,w])=>{header(label,x,y,w,18);x+=w;});y+=18;};
  tableHeader();
  for(const row of snapshot.routines){
   const cells=[row.partner,row.station,row.fixed,row.routine],lines=cells.map((value,i)=>wrap(value,columns[i][1]-10,7.5)),height=Math.max(18,...lines.map(value=>value.length*9.2+8));
   if(y+height>751){newPage();text('PBT · '+snapshot.title+' · Rutinas',36,37,540,11,{bold:true,color:GREEN});text(snapshot.store+' · '+snapshot.days+' · '+snapshot.daypart,36,54,540,8);y=74;tableHeader();}
   if(height>751-y)throw Error('Una rutina excede el espacio de una página. Revisa el contenido antes de exportar.');
   let x=36;cells.forEach((value,i)=>{const w=columns[i][1];rect(x,y,w,height,i===0?GRAY:'#ffffff');text(value,x+5,y+4,w-10,7.5,{bold:i===0,lineHeight:9.2});x+=w;});y+=height;
  }
  const pages=pdf.getPages();if(pages.length>1)pages.forEach((item,index)=>item.drawText((index+1)+' / '+pages.length,{x:550,y:38,size:6,font:regular,color:color(INK)}));
  return pdf.save();
 }
 const api={create,filename,PAGE,MARGIN};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PBT_PDF=api;
})(typeof globalThis!=='undefined'?globalThis:this);
