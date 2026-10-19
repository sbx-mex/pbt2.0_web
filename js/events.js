/* Explicit event allowlist. No inline handlers, eval or dynamically executed strings. */
(function(){
 'use strict';
 const click={
  'create-plans':()=>openCreatePlans(),'about-plans':()=>{closeAbout();openCreatePlans(true);},weeks:n=>openPBTWeeks(n.dataset.tab),
  about:()=>openAbout(),'close-about':()=>closeAbout(),tab:n=>showTab(n.dataset.tab),team:()=>toggleEquipo(),'team-close':()=>toggleEquipo(false),'recover-team':()=>recoverPreviousTeam(),
  months:n=>toggleMS(n.dataset.tab,'mes'),'months-all':n=>selectAllMS(n.dataset.tab,'mes'),clear:n=>clearStore(n.dataset.tab),store:n=>selectStore(n.dataset.tab,n.dataset.store),mode:n=>setCalculationMode(n.dataset.tab),export:()=>exportPBTLetter(),
  photo:n=>{if(/^(photo|camera)_(cafe|dt)_\d{1,2}$/.test(n.dataset.target))document.getElementById(n.dataset.target)?.click();},
  navigate:n=>{const target=document.getElementById(activeTab+'_'+n.dataset.section);if(target){if(target.tagName==='DETAILS')target.open=true;target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}}
 };
 const input={search:n=>searchStore(n.dataset.tab,n.value),'team-name':n=>setTeamPartner(n.dataset.tab,Number(n.dataset.index),n),'team-search':n=>filterTeam(n.dataset.tab,n.value)};
 const change={assign:n=>setPartnerName(n.dataset.tab,n.dataset.letter,n),months:n=>changeMS(n.dataset.tab,'mes'),partners:n=>setPartners(n.dataset.tab),tablet:n=>setPartnerTablet(n.dataset.tab,n.value),context:n=>setManualContext(n.dataset.tab),photo:n=>savePartnerPhoto(n.dataset.tab,Number(n.dataset.index),n)};
 for(const [event,actions] of Object.entries({click,input,change,focusin:{search:input.search},keydown:{search:(n,e)=>storeKeydown(e,n.dataset.tab)}})){
  const key=event==='focusin'?'focus':event;
  document.addEventListener(event,function(e){const node=e.target.closest?.('[data-'+key+']');if(!node||node.disabled)return;const action=actions[node.dataset[key]];if(Object.prototype.hasOwnProperty.call(actions,node.dataset[key])&&action)action(node,e);});
 }
})();
