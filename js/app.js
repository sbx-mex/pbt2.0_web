(function(){
  'use strict';

  var FALLBACK_PROJECT={
    campaign:{primary:'JUNTÉMONOS',accent:'MÁS',primaryColor:'#006241',accentColor:'#c69a32'},
    footer:{
      title:'Diseñado por Enrique César Flores',
      message:'PBT Web 2.0 es una herramienta interna desarrollada para apoyar la planeación operativa, la toma de decisiones y la mejora continua. Su contenido es de uso exclusivo de los equipos autorizados y no debe reproducirse, distribuirse ni difundirse fuera del ámbito de trabajo.',
      hashtags:['#DistritoKike 🚀','#GreenApronService','JUNTÉMONOS MÁS']
    }
  };

  function applyProject(project){
    project=project||FALLBACK_PROJECT;
    var campaign=project.campaign||FALLBACK_PROJECT.campaign;
    var footer=project.footer||FALLBACK_PROJECT.footer;
    document.documentElement.style.setProperty('--campaign-primary',campaign.primaryColor||'#006241');
    document.documentElement.style.setProperty('--campaign-accent',campaign.accentColor||'#c69a32');
    document.querySelectorAll('[data-campaign-primary]').forEach(function(node){node.textContent=campaign.primary||'JUNTÉMONOS'});
    document.querySelectorAll('[data-campaign-accent]').forEach(function(node){node.textContent=campaign.accent||'MÁS'});
    document.querySelectorAll('[data-campaign-full]').forEach(function(node){node.textContent=(campaign.primary||'JUNTÉMONOS')+' '+(campaign.accent||'MÁS')});
    var title=document.querySelector('[data-footer-title]');
    var message=document.querySelector('[data-footer-message]');
    if(title)title.textContent=footer.title||FALLBACK_PROJECT.footer.title;
    if(message)message.textContent=footer.message||FALLBACK_PROJECT.footer.message;
    var tags=document.querySelector('.footer-tags');
    if(tags&&Array.isArray(footer.hashtags))tags.innerHTML=footer.hashtags.map(function(tag){return '<span>'+escapeHTML(tag)+'</span>'}).join('');
  }

  function escapeHTML(value){
    return String(value||'').replace(/[&<>\"]/g,function(ch){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]});
  }

  function memoizeEngine(){
    if(typeof PBT_ENGINE==='undefined'||!PBT_ENGINE||typeof PBT_ENGINE.calculate!=='function'||PBT_ENGINE.__memoized)return;
    var original=PBT_ENGINE.calculate.bind(PBT_ENGINE),cache=new Map(),limit=120;
    PBT_ENGINE.calculate=function(filters,tipo){
      var key=String(tipo||'CAFE')+'|'+JSON.stringify(filters||{});
      if(cache.has(key)){
        var cached=cache.get(key);cache.delete(key);cache.set(key,cached);return cached;
      }
      var result=original(filters,tipo);cache.set(key,result);
      if(cache.size>limit)cache.delete(cache.keys().next().value);
      return result;
    };
    PBT_ENGINE.__memoized=true;
  }

  function improveTabs(){
    if(typeof window.showTab!=='function'||window.showTab.__accessible)return;
    var original=window.showTab;
    window.showTab=function(tab,keepSelection){
      original(tab,keepSelection);
      ['cafe','dt'].forEach(function(name){
        var button=document.getElementById(name==='cafe'?'tabCafe':'tabDt');
        if(button)button.setAttribute('aria-selected',String(name===tab));
      });
    };
    window.showTab.__accessible=true;
  }

  function markReady(){
    var chip=document.getElementById('readyChip');
    var loader=document.getElementById('appLoading');
    var source=window.PBT_WEEKLY||{},ready=source.ready===true;
    if(chip){chip.textContent=ready?(source.active?'Motor CSV listo':'Base original activa'):(source.error?'Revisar motor':'Cargando motor…');chip.classList.toggle('ready',ready)}
    if(loader&&(ready||source.error)){loader.classList.add('hidden');setTimeout(function(){loader.remove()},260)}
    document.documentElement.setAttribute('data-app-ready',String(ready));
  }

  memoizeEngine();
  improveTabs();
  fetch('data/project.json',{cache:'no-cache'}).then(function(response){
    if(!response.ok)throw new Error('project.json '+response.status);
    return response.json();
  }).then(applyProject).catch(function(){applyProject(FALLBACK_PROJECT)});

  document.addEventListener('DOMContentLoaded',function(){
    memoizeEngine();improveTabs();
    requestAnimationFrame(function(){requestAnimationFrame(markReady)});
  });
  document.addEventListener('pbt:source',markReady);
  document.addEventListener('keydown',function(event){
    if(!event.target.closest||!event.target.closest('.tabs [role="tab"]')||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    event.preventDefault();var next=event.key==='Home'?'cafe':event.key==='End'?'dt':(activeTab==='cafe'?'dt':'cafe');
    showTab(next);document.getElementById(next==='cafe'?'tabCafe':'tabDt').focus();
  });
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&typeof applyOperationalContext==='function')applyOperationalContext(false);});
})();
