const t=(k,v)=>{let r=(S.lang==='bg'&&BG[k])||k;if(v)for(const x in v)r=r.replace('{'+x+'}',v[x]);return r};
function buildPresets(){
  const box=$('#presets');box.innerHTML='';
  PRESETS.forEach(([c,bg,name])=>{const b=document.createElement('button');b.type='button';const sw=document.createElement('i');sw.textContent='Aa';sw.style.color=c;sw.style.background=bg;b.append(sw);b.title=t(name);b.addEventListener('click',()=>{S.color=c;S.bg=bg;saveS();applyStyles();syncUI()});box.appendChild(b)});
}
function applyLang(){
  const en=S.lang==='en',bg=!en;
  document.documentElement.lang=S.lang;editor.lang=S.lang;
  const skip='#helpBg,#helpEn,#openWrap,#editor,#textcol,#bmOwner,#bmListEdit,#bmListRead,#scList,#scListRead,#ctlPv,#foot,#toast,#arrowHint,script,style';
  const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){
    const pe=n.parentElement;if(!pe||pe.closest(skip))continue;
    if(n.__src===undefined){if(!/\S/.test(n.nodeValue))continue;n.__src=n.nodeValue}
    const o=n.__src,tr=o.trim();
    n.nodeValue=bg&&BG[tr]?o.replace(tr,BG[tr]):o;
  }
  $$('[title],[aria-label]').forEach(el=>{
    if(el.closest('#presets,#bmListEdit,#bmListRead,#scList,#scListRead,#pal,#openWrap,#imgBar'))return;
    ['title','aria-label'].forEach(a=>{
      if(!el.hasAttribute(a))return;const k='__'+a;if(el[k]===undefined)el[k]=el.getAttribute(a);
      el.setAttribute(a,bg&&BG[el[k]]?BG[el[k]]:el[k]);
    });
  });
  document.title='TPrompt';
  $$('.cbtn').forEach(b=>{if(b._sync)b._sync()});
  $$('#imgBar .ib').forEach(b=>{if(b._tt)b.title=b._tt()});
  $('#helpBg').hidden=en;$('#helpEn').hidden=!en;
  {const ls=$('#langSel');if(ls)ls.value=S.lang}
  buildPresets();syncUI();try{renderNetworkSettings()}catch(e){oops('applyLang#1',e)}
  if(!docTouched)edSet(sample());
  renderBm();renderScripts();updateFoot();updateOpenLabel();
  if(docTouched&&!scActive&&typeof SC!=='undefined')scAutosave();   /* съществуващ текст от предишна версия влиза в списъка */
}
