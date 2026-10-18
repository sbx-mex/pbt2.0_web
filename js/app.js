(function(){
  'use strict';

  var FALLBACK_PROJECT={
    campaign:{primary:'JUNTÉMONOS',accent:'MÁS',primaryColor:'#006241',accentColor:'#c69a32'},
    footer:{
      title:'Diseñado por Enrique César Flores & Jorge Antonio Alcantar Aguiar',
      message:'PBT Web 2.0 es una herramienta interna desarrollada para apoyar la planeación operativa, la toma de decisiones y la mejora continua. Su contenido es de uso exclusivo de los equipos autorizados y no debe reproducirse, distribuirse ni difundirse fuera del ámbito de trabajo.',
      hashtags:['#GreenApronService','JUNTÉMONOS MÁS']
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
    if(chip){chip.textContent=ready?'Motor CSV listo':(source.error?'Revisar motor':'Cargando motor…');chip.classList.toggle('ready',ready)}
    if(loader&&(ready||source.error)){loader.classList.add('hidden');setTimeout(function(){loader.remove()},260)}
    document.documentElement.setAttribute('data-app-ready',String(ready));
  }

  improveTabs();
  fetch('data/project.json?v=24',{cache:'no-cache'}).then(function(response){
    if(!response.ok)throw new Error('project.json '+response.status);
    return response.json();
  }).then(applyProject).catch(function(){applyProject(FALLBACK_PROJECT)});

  document.addEventListener('DOMContentLoaded',function(){
    improveTabs();
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
