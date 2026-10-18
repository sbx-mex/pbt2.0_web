/* Letter export: original PBT boxes, sheet backgrounds and partner coordinates. */
(function(root){
 'use strict';
 const PAGE=[612,792],MARGIN=36;
 const CREDIT='Diseñado por Enrique César Flores & Jorge Antonio Alcantar Aguiar';
 const template=typeof module!=='undefined'&&module.exports?require('./sheet-template.js'):root.PBT_SHEET;
 function filename(snapshot){
  const code=String(snapshot.ceco||''),partners=Number(snapshot.partners);
  const days={Weekday:'lun-jue',Weekend:'vie-dom'}[snapshot.weekpart];
  const part={Morning:'Manana',Lunch:'Intermedio',Afternoon:'Tarde'}[snapshot.daypartKey];
  if(!/^\d{3,8}$/.test(code)||!days||!part||!Number.isInteger(partners)||partners<1||partners>13)throw Error('Selecciona una tienda y un filtro válido antes de exportar.');
  return 'PBT_'+code+'_'+days+'_'+part+'_'+partners+'Partners.pdf';
 }
 function column(column,span=1){
  const total=template.columns.reduce((a,b)=>a+b,0),left=template.columns.slice(0,column-2).reduce((a,b)=>a+b,0),width=template.columns.slice(column-2,column-2+span).reduce((a,b)=>a+b,0);
  return {x:MARGIN+540*left/total,width:540*width/total};
 }
 async function create(snapshot,lib){
  const {PDFDocument,StandardFonts,rgb}=lib,pdf=await PDFDocument.create();
  const title=filename(snapshot).replace(/\.pdf$/,''),tab=snapshot.tab||(snapshot.title==='DRIVE THRU'?'dt':'cafe'),sheet=template[tab];
  if(!sheet)throw Error('No se encontró la plantilla original.');
  pdf.setTitle(title);pdf.setAuthor('Enrique César Flores & Jorge Antonio Alcantar Aguiar');
  pdf.setSubject(snapshot.store+' · '+snapshot.months+' · '+snapshot.days+' · '+snapshot.daypart);
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),italic=await pdf.embedFont(StandardFonts.HelveticaOblique);
  const color=hex=>{const h=hex.replace('#','');return rgb(parseInt(h.slice(0,2),16)/255,parseInt(h.slice(2,4),16)/255,parseInt(h.slice(4,6),16)/255);};
  const GREEN='#007050',INK='#222222',LINE='#939393',GRAY='#e7e6e6';
  const safe=value=>String(value??'').replace(/[\u2010-\u2015]/g,'-').replace(/\u202f/g,' ').replace(/[^\n\x20-\x7e\xa0-\xff\u2022]/g,'');
  const wrap=(value,width,size=8,font=regular)=>{
   const lines=[];for(const paragraph of safe(value).split('\n')){let current='';for(const word of paragraph.split(/\s+/)){
    if(!word)continue;
    if(font.widthOfTextAtSize(word,size)>width){if(current){lines.push(current);current='';}let part='';for(const char of word){if(font.widthOfTextAtSize(part+char,size)>width&&part){lines.push(part);part='';}part+=char;}current=part;}
    else if(current&&font.widthOfTextAtSize(current+' '+word,size)>width){lines.push(current);current=word;}else current+=(current?' ':'')+word;
   }lines.push(current);}return lines.length?lines:[''];
  };
  let page;
  const rect=(x,top,w,h,fill,border=LINE,borderWidth=.4)=>page.drawRectangle({x,y:792-top-h,width:w,height:h,...(fill?{color:color(fill)}:{}),...(border?{borderColor:color(border),borderWidth}:{})});
  const line=(x1,y1,x2,y2,ink=LINE)=>page.drawLine({start:{x:x1,y:792-y1},end:{x:x2,y:792-y2},thickness:.45,color:color(ink)});
  const text=(value,x,top,w,size=8,opts={})=>{
   const font=opts.bold?bold:opts.italic?italic:regular,lines=wrap(value,Math.max(1,w),size,font),height=opts.lineHeight||size*1.2;
   lines.forEach((value,i)=>{const offset=opts.center?Math.max(0,(w-font.widthOfTextAtSize(value,size))/2):0;page.drawText(value,{x:x+offset,y:792-top-size-i*height,font,size,color:color(opts.color||INK)});});return lines.length*height;
  };
  const header=(label,x,top,w,h=17,size=7.5)=>{rect(x,top,w,h,GREEN,GREEN);text(label,x+3,top+(h-size)/2-1,w-6,size,{bold:true,color:'#ffffff',center:true});};
  const newPage=()=>{page=pdf.addPage(PAGE);return page;};
  newPage();
  text(snapshot.store,36,36,425,10,{bold:true,color:GREEN});text('PBT · '+(tab==='dt'?'DT':'CAFÉ'),492,36,84,9,{bold:true,color:GREEN,center:true});
  const period=column(2,4),comments=column(7,9),shift=column(4,2),channels=column(7,3),mix=column(11,5);
  const periodTop=51,fieldValues=[['Rango de fechas',snapshot.months],['Días de la semana',snapshot.days],['Turno',snapshot.daypart]];
  const fieldHeights=fieldValues.map(([,value])=>Math.max(15,wrap(value,shift.width-8,7.6).length*9.2+6));
  const commentsText=snapshot.comments||'Plan para la tienda '+snapshot.store+', con base en '+snapshot.months+', '+snapshot.days+' y turno '+snapshot.daypart+'.';
  const commentHeight=Math.max(fieldHeights.reduce((a,b)=>a+b,0),wrap(commentsText,comments.width-10,8.2).length*10.3+10);
  header('Periodo de tiempo',period.x,periodTop,period.width);header('Comentarios',comments.x,periodTop,comments.width);
  rect(comments.x,periodTop+17,comments.width,commentHeight,GRAY);text(commentsText,comments.x+5,periodTop+22,comments.width-10,8.2,{lineHeight:10.3});
  let y=periodTop+17;
  fieldValues.forEach(([label,value],i)=>{text(label,period.x+1,y+4,shift.x-period.x-4,7.6,{italic:true});rect(shift.x,y,shift.width,fieldHeights[i],GRAY);text(value,shift.x+4,y+4,shift.width-8,7.6);y+=fieldHeights[i];});
  y=periodTop+17+commentHeight+10;
  header('Información de turno',shift.x,y,shift.width,17,6.8);header('Distribución de canales',channels.x,y,channels.width,17,7);header('Mix de productos',mix.x,y,mix.width,17,7.5);
  const labelHeight=21,valueHeight=17;
  rect(shift.x,y+17,shift.width,labelHeight,'#ffffff');text('Partners',shift.x+3,y+25,shift.width-6,8,{italic:true,center:true});rect(shift.x,y+17+labelHeight,shift.width,valueHeight,GRAY);text(String(snapshot.partners),shift.x+3,y+17+labelHeight+3,shift.width-6,10,{center:true});
  text('Cantidad de partners',period.x+1,y+17+labelHeight+5,shift.x-period.x-5,7.2,{italic:true});
  function metrics(items,startColumn){items.forEach(([label,value],i)=>{const cell=column(startColumn+i);rect(cell.x,y+17,cell.width,labelHeight,'#ffffff');text(label==='COD'?'Café\nfiltrado':label,cell.x+2,y+20,cell.width-4,6.8,{italic:true,center:true});rect(cell.x,y+17+labelHeight,cell.width,valueHeight,GRAY);text(value,cell.x+2,y+17+labelHeight+4,cell.width-4,10,{center:true});});}
  metrics(snapshot.channels,7);metrics(snapshot.mix,11);
  y+=17+labelHeight+valueHeight;
  if(tab==='dt'){y+=5;text('Partner Tablet',period.x+1,y+3,shift.x-period.x-5,7.2,{italic:true});rect(shift.x,y,shift.width,15,GRAY);text(snapshot.partnerTablet||'No',shift.x+4,y+3,shift.width-8,7.2);y+=15;}
  y+=10;header('Plan de distribución recomendado',36,y,540,21,8.5);
  const layoutTop=y+26,layoutHeight=tab==='dt'?224:222,layoutWidth=540,rowHeight=layoutHeight/sheet.rows;
  rect(36,layoutTop,layoutWidth,layoutHeight,'#f2f2f2','#333333',.7);
  for(const [row,col,fill,edges] of sheet.cells){const cell=column(col),top=layoutTop+(row-18)*rowHeight;rect(cell.x,top,cell.width,rowHeight,fill,null);for(const edge of edges){if(edge==='l')line(cell.x,top,cell.x,top+rowHeight);if(edge==='r')line(cell.x+cell.width,top,cell.x+cell.width,top+rowHeight);if(edge==='t')line(cell.x,top,cell.x+cell.width,top);if(edge==='b')line(cell.x,top+rowHeight,cell.x+cell.width,top+rowHeight);}}
  for(const [row,col,rows,cols,label,ink] of sheet.labels){const cell=column(col,cols),height=rows*rowHeight,size=cell.width<42?6.7:7.4,lines=wrap(label,cell.width-4,size,bold).length;text(label,cell.x+2,layoutTop+(row-18)*rowHeight+(height-lines*size*1.2)/2,cell.width-4,size,{bold:true,center:true,color:ink});}
  for(const area of snapshot.areas.filter(item=>item.marker)){
   const x=36+area.left/100*layoutWidth,top=layoutTop+area.top/100*10*rowHeight,w=area.width/100*layoutWidth,h=area.height/100*10*rowHeight,fixed=area.classes.includes('partner');
   if(top<layoutTop-.1||top+h>layoutTop+layoutHeight+.1||x<35.9||x+w>576.1)throw Error('Una posición del plan está fuera del plano original.');
   rect(x,top,w,h,fixed?GREEN:'#ffffff',GREEN,.6);
   let photo=null;if(area.photo){try{photo=area.photo.startsWith('data:image/png')?await pdf.embedPng(area.photo):await pdf.embedJpg(area.photo);}catch{}}
   const size=photo?Math.min(14,h-12):0;if(photo)page.drawImage(photo,{x:x+3,y:792-top-3-size,width:size,height:size});
   text(area.letter,x+(photo?18:1),top+3,w-(photo?19:2),area.name?9.5:11,{bold:true,center:true,color:fixed?'#ffffff':GREEN});
   if(area.name)text(area.name,x+1,top+h-8,w-2,5.5,{bold:true,center:true,color:fixed?'#ffffff':GREEN});
  }
  rect(36,layoutTop,layoutWidth,layoutHeight,undefined,'#333333',.7);
  y=layoutTop+layoutHeight+12;
  const columns=[['Partner',90],['Estación',76],['Fijo',38],['Rutinas',336]];
  const tableHeader=()=>{let x=36;columns.forEach(([label,w])=>{header(label,x,y,w,20);x+=w;});y+=20;};
  tableHeader();
  for(const row of snapshot.routines){
   const cells=[row.partner,row.station,row.fixed,row.routine],lines=cells.map((value,i)=>wrap(value,columns[i][1]-8,7.5)),height=Math.max(19,...lines.map(value=>value.length*9.2+8));
   if(y+height>738){newPage();text(snapshot.store+' · '+snapshot.days+' · '+snapshot.daypart,36,36,540,9,{bold:true,color:GREEN});y=55;tableHeader();}
   if(height>738-y)throw Error('Una rutina excede el espacio de una página. Revisa el contenido antes de exportar.');
   let x=36;cells.forEach((value,i)=>{const w=columns[i][1];rect(x,y,w,height,'#ffffff');text(value,x+4,y+4,w-8,7.5,{lineHeight:9.2,center:i===2});x+=w;});y+=height;
  }
  pdf.getPages().forEach((item,index,all)=>{item.drawText(CREDIT,{x:36,y:39,size:6.5,font:regular,color:color('#5b625e')});if(all.length>1)item.drawText((index+1)+' / '+all.length,{x:550,y:39,size:6.5,font:regular,color:color(INK)});});
  return pdf.save();
 }
 const api={create,filename,column,PAGE,MARGIN,CREDIT};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.PBT_PDF=api;
})(typeof globalThis!=='undefined'?globalThis:this);
