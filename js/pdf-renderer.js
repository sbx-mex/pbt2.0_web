/* PBT Letter renderer: original sheet hierarchy, coordinates and fixed status. */
(function(root){
 'use strict';
 const PAGE=[612,792],MARGIN=36;
 async function create(snapshot,lib){
  const {PDFDocument,StandardFonts,rgb}=lib,pdf=await PDFDocument.create();
  pdf.setTitle('PBT · '+snapshot.title);pdf.setAuthor('Enrique César Flores');pdf.setSubject(snapshot.store+' · '+snapshot.months+' · '+snapshot.days+' · '+snapshot.daypart);
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
  const header=(label,x,top,w,h=17)=>{rect(x,top,w,h,GREEN,GREEN);text(label,x+4,top+3,w-8,8,{bold:true,color:'#ffffff',center:true});};
  const footer=()=>{rect(36,739,540,.5,GREEN,GREEN,0);text('CONFIDENCIAL · USO OPERATIVO INTERNO',36,745,270,6.5);text('Diseñado por Enrique César Flores',306,745,270,6.5,{center:true});};
  const newPage=()=>{page=pdf.addPage(PAGE);footer();return page;};
  newPage();
  text('PBT · '+snapshot.title,36,37,540,11,{bold:true,color:GREEN});
  let y=52;const left=185,rightX=233,rightW=343;
  header('Periodo de tiempo',36,y,left);header('Comentarios',rightX,y,rightW);
  const period=[['Rango de fechas',snapshot.months],['Días de la semana',snapshot.days],['Turno',snapshot.daypart]];
  const rowHeights=period.map(([,value])=>Math.max(18,wrap(value,left-85,8).length*9.6+7));
  let py=y+17;period.forEach(([name,value],i)=>{rect(36,py,82,rowHeights[i],'#ffffff');rect(118,py,left-82,rowHeights[i],GRAY);text(name,40,py+5,74,7.5);text(value,122,py+4,left-90,8,{bold:true});py+=rowHeights[i];});
  rect(rightX,y+17,rightW,py-y-17,GRAY);
  text(snapshot.store+'\n'+snapshot.mode+' · '+snapshot.source+'\n'+(snapshot.weekText||''),rightX+7,y+23,rightW-14,8,{lineHeight:12});
  y=py+13;
  header('Información del turno',36,y,112);header('Distribución de canal',156,y,170);header('Mix de producto',334,y,242);
  function metrics(items,x,width){const w=width/items.length;items.forEach(([label,value],i)=>{rect(x+i*w,y+17,w,16,'#ffffff');text(label,x+i*w+2,y+21,w-4,label.length>15?6:7,{center:true});rect(x+i*w,y+33,w,20,GRAY);text(value,x+i*w+2,y+38,w-4,9,{bold:true,center:true});});}
  metrics([['Partners',String(snapshot.partners)]],36,112);metrics(snapshot.channels,156,170);metrics(snapshot.mix,334,242);
  y+=65;header('Plan de distribución recomendado',36,y,540,19);y+=23;
  const layoutTop=y,layoutHeight=228,layoutWidth=540;
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
   if(y+height>733){newPage();text('PBT · '+snapshot.title+' · Rutinas',36,37,540,11,{bold:true,color:GREEN});text(snapshot.store+' · '+snapshot.days+' · '+snapshot.daypart,36,54,540,8);y=74;tableHeader();}
   if(height>733-y)throw Error('Una rutina excede el espacio de una página. Revisa el contenido antes de exportar.');
   let x=36;cells.forEach((value,i)=>{const w=columns[i][1];rect(x,y,w,height,i===0?GRAY:'#ffffff');text(value,x+5,y+4,w-10,7.5,{bold:i===0,lineHeight:9.2});x+=w;});y+=height;
  }
  const pages=pdf.getPages();pages.forEach((item,index)=>item.drawText((index+1)+' / '+pages.length,{x:550,y:38,size:6,font:regular,color:color(INK)}));
  return pdf.save();
 }
 const api={create,PAGE,MARGIN};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PBT_PDF=api;
})(typeof globalThis!=='undefined'?globalThis:this);
