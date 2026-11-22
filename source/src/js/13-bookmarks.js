/* ---------- Отметки (редове, започващи с ~) ---------- */
const bmPanel=$('#bmPanel');
let bmEls=[],bmPos=[],bmTitles=[],curBm=-1;
let rmFollow=false;   /* цял екран при дистанционно: същият екран като „Цял екран“, но позицията идва от компютъра и бутоните го управляват */
const TILDE=/^[\s\u00a0]*~+[\s\u00a0]*/;
function findBm(root){
  const out=[];
  root.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,div').forEach(el=>{
    if(el.querySelector('p,h1,h2,h3,h4,h5,h6,li,div,ul,ol'))return;
    if(/^[\s\u00a0]*~/.test(el.textContent))out.push(el);
  });
  return out;
}
const bmTitle=el=>el.textContent.replace(TILDE,'').trim();   /* отметка без текст остава с празно име */
function stripTilde(el){
  const w=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){
    if(!n.textContent.trim())continue;
    n.textContent=n.textContent.replace(TILDE,'');break;
  }
  if(!el.textContent.trim()&&!el.querySelector('br'))el.innerHTML='<br>';
}
/* ред със три части: име | ✎ редактирай | ▶ пусни; всяка част показва своето състояние */
function actBtn(kind,icon,title,fn){
  const b=document.createElement('button');b.type='button';b.className='ib act '+kind;
  b.title=title;b.setAttribute('aria-label',title);b.innerHTML=svg(icon);
  b.addEventListener('click',e=>{e.stopPropagation();fn()});return b;
}
function fillList(box,titles,mode){
  box.innerHTML='';
  if(!titles.length){const d=document.createElement('div');d.className='bmempty';d.textContent=t('No bookmarks yet. Start a line with ~ and a title.');box.appendChild(d);return}
  titles.forEach((ttl,i)=>{
    const row=document.createElement('div');row.className='bmi';
    const n=document.createElement('span');n.className='n';n.textContent=i+1;
    const b=document.createElement('button');b.type='button';b.className='tt';   /* името е бутон и в двата списъка: достига се и с клавиатура */
    b.textContent=ttl;b.title=ttl;
    if(mode==='edit'){
      row.append(n,b);
      if(editorOpen()&&bmEd()&&i===bmEdit)row.classList.add('editing');
      /* ✎ отваря отметката в редактора (на показвания текст); ▶ пуска/премества четенето на отметката */
      row.append(actBtn('e','edit',t('Edit bookmark')+(ttl?': '+ttl:''),async()=>{
        /* повторно натискане върху редактираната отметка: редакторът се затваря (както при текстовете) */
        if(editorOpen()&&bmEd()&&i===bmEdit){if(remoteOn())hideEditor();return}
        if(!bmEd()){const k=scIdx(scLive);if(k>=0)await scLoad(k,true);if(!liveSync())return}
        showEditor();gotoEditor(i);
      }));
      b.title=t('Play bookmark')+(ttl?': '+ttl:'');
      b.addEventListener('click',async()=>{
        if(remoteOn()){remoteBm(i);return}
        if(bmEd())scMakeLive();   /* нищо не се показва: пуска се текстът от редактора */
        else{const k=scIdx(scLive);if(k>=0)await scLoad(k,true);if(!liveSync())return}
        startFromBm(i);
      });
    }else{
      const lv=document.createElement('i');lv.className='live';lv.title=t('Shown bookmark');lv.innerHTML=svg('play');
      row.append(n,b,lv);
      row.addEventListener('click',()=>{toggleBm(false);gotoBm(i)});   /* първо се затваря панелът, после се скача: затварящият се панел не се скролва */
    }
    box.appendChild(row);
  });
}
/* коя отметка е на екрана в момента (по състоянието от втория прозорец): реда светва, бутонът става „Активна“ и списъкът се превърта до него */
let bmActive=-2,bmWasVis=false;
/* редактирана отметка = отметката, в чийто раздел е курсорът в редактора; индикаторът се вижда само при отворен редактор */
let bmEdit=-1;
function editorOpen(){
  if(reading)return false;
  const b=document.body;
  if(b.classList.contains('ed-off'))return false;
  try{   /* при първоначално зареждане тези състояния още не са създадени */
    if(rcOn())return rcEff()==='ed';
    if(b.classList.contains('nt'))return ntv==='ed';
  }catch(e){oops('editorOpen#1',e)}
  return true;
}
function selBm(){
  const sel=getSelection();
  if(!sel.rangeCount||!sel.anchorNode||!editor.contains(sel.anchorNode))return null;
  const els=findBm(editor);let k=-1;
  for(let j=0;j<els.length;j++){
    const e=els[j];
    if(e===sel.anchorNode||e.contains(sel.anchorNode)||(e.compareDocumentPosition(sel.anchorNode)&Node.DOCUMENT_POSITION_FOLLOWING))k=j;else break;
  }
  return k;
}
function refreshEditInd(){
  if(typeof SC==='undefined')return;
  const open=editorOpen();
  $$('#scList .bmi').forEach((r,i)=>{if(SC[i])r.classList.toggle('editing',open&&SC[i].id===scActive)});
  $$('#bmListEdit .bmi').forEach((r,i)=>r.classList.toggle('editing',open&&bmEd()&&i===bmEdit));
}
if(!VIEWER)document.addEventListener('selectionchange',()=>{const k=selBm();if(k!==null&&k!==bmEdit){bmEdit=k;refreshEditInd()}});
/* безопасна зона: родното меню за селекция (изрежи/копирай/постави) се отваря над текста – ако селекцията е в най-горните ~72 px на редактора, превъртаме надолу, за да не покрие тулбара */
if(!VIEWER&&matchMedia('(pointer:coarse)').matches){
  const SAFE=72;let kct=0;
  document.addEventListener('selectionchange',()=>{clearTimeout(kct);kct=setTimeout(()=>{
    const ed=document.getElementById('editor'),sl=getSelection();
    if(!ed||!sl||!sl.rangeCount||sl.isCollapsed||!ed.contains(sl.anchorNode))return;
    const er=ed.getBoundingClientRect(),r=sl.getRangeAt(0).getBoundingClientRect();
    if(!r||(!r.width&&!r.height))return;
    const need=er.top+SAFE-r.top;
    if(need>0&&r.top>=er.top-4&&ed.scrollTop>0)ed.scrollTop=Math.max(0,ed.scrollTop-need)
  },140)})
}
function markBmActive(force){
  const idx=(remoteOn()&&typeof remoteSt.bm==='number')?remoteSt.bm:-1;
  if(idx===bmActive&&!force)return;
  const changed=idx!==bmActive;bmActive=idx;
  const rows=[...$('#bmListEdit').children];
  rows.forEach((r,i)=>{
    const on=i===idx;r.classList.toggle('cur',on);
  });
  if(changed)scrollBmActive();
}
function scrollBmActive(){
  const rows=$('#bmListEdit').children,r=rows[bmActive];
  if(!r||$('#bmRSide').offsetParent===null)return;
  /* първата и последната отметка скролват списъка до края, за да се виждат и заглавието над списъка и отстъпът под него */
  const box=r.closest('.bmsec');
  if(box&&bmActive===0)box.scrollTo({top:0,behavior:'smooth'});
  else if(box&&bmActive===rows.length-1)box.scrollTo({top:box.scrollHeight,behavior:'smooth'});
  else r.scrollIntoView({block:'nearest',behavior:'smooth'});
}
function showEditor(){   /* покажи редактора: на телефон избира панела, на компютър връща редактора при отворено превю */
  if(rcOn()){rcv='ed';applyRc();applyView()}
  else if(document.body.classList.contains('nt')){ntv='ed';applyRc();applyView()}
  else if(remoteOn()&&!VT.ed){VT.ed=true;autoEd=false;saveView();applyView()}
}
/* показва ли се текст в момента (четене на цял екран, втори прозорец или устройство) */
function showingNow(){try{return reading||remoteOn()}catch(e){return reading}}
/* отметките са на редактирания текст, когато нищо не се показва, иначе на показвания */
function bmEd(){return liveSync()||!showingNow()}
let bmWasEd=null;
/* списъкът с отметки е на показвания текст (този, който върви в четеца/дистанционното); когато нищо не се показва – на текста в редактора */
function liveBmTitles(){
  if(bmEd())return findBm(editor).map(bmTitle);
  const x=SC[scIdx(scLive)];if(!x)return findBm(editor).map(bmTitle);
  const d=document.createElement('div');d.innerHTML=x.html;return findBm(d).map(bmTitle);
}
function renderBm(){
  bmTitles=liveBmTitles();bmWasEd=bmEd();
  if(bmWasEd){const k=selBm();if(k!==null)bmEdit=k;if(bmEdit>=bmTitles.length)bmEdit=bmTitles.length-1}
  fillList($('#bmListEdit'),bmTitles,'edit');
  $('#bmHint').hidden=bmTitles.length>0;
  fillList($('#bmListRead'),bmTitles,'read');
  curBm=-2;if(reading)updateCur();
  markBmActive(true);updateFoot();
}
function gotoEditor(i){
  drawer(null);
  const el=findBm(editor)[i];if(!el)return;
  let p;try{p=tt.view.posAtDOM(el,0)}catch(e){return}
  tt.commands.setTextSelection(p);tt.view.focus();
  el.scrollIntoView({block:'center',behavior:'smooth'});
  bmEdit=i;refreshEditInd();
}
function gotoBm(i){
  if(rmFollow){remoteBm(Math.max(0,Math.min(bmTitles.length-1,i)));showHud();return}
  if(!bmPos.length)return;
  i=Math.max(0,Math.min(bmPos.length-1,i));
  pos=Math.min(maxPos,Math.max(0,bmPos[i]));remain=0;draw(true);showHud();
  /* без значка с името на отметката */
}
let pvToastT=0;
function pvToast(msg){
  let el=$('#pvToast');if(!el){el=document.createElement('div');el.id='pvToast';pvWrap.appendChild(el)}
  el.textContent=msg;el.classList.add('show');clearTimeout(pvToastT);pvToastT=setTimeout(()=>el.classList.remove('show'),1800);
}
let digBuf='',digT=0;
function bmDigit(d,exec){
  const n=bmTitles.length;
  if(!n||(!digBuf&&d==='0'))return false;
  let b=digBuf+d;
  if(parseInt(b,10)>n){if(d==='0'||parseInt(d,10)>n){digBuf='';clearTimeout(digT);return false}b=d}
  digBuf=b;clearTimeout(digT);
  const v=parseInt(b,10);
  if(v*10<=n){
    digT=setTimeout(()=>{const x=parseInt(digBuf,10);digBuf='';exec(x-1)},650);
  }else{digBuf='';exec(v-1)}
  return true;
}
function gotoPrevBm(){gotoBm(curBm>=0&&pos-bmPos[curBm]>40?curBm:Math.max(curBm,0)-1)}
function updateCur(){
  let c=-1;for(let i=0;i<bmPos.length;i++){if(bmPos[i]<=pos+2)c=i}
  if(c!==curBm){curBm=c;[...$('#bmListRead').children].forEach((r,i)=>r.classList.toggle('cur',i===c));scrollPanelCur(true)}
}
/* панелът при четене показва текущата отметка (или текст); първата и последната скролват до края на панела */
function scrollPanelCur(smooth){
  if(!bmPanel.classList.contains('open'))return;
  const b=smooth?'smooth':'auto',isBm=bmTab==='bm';
  const list=isBm?$('#bmListRead'):$('#scListRead'),rows=[...list.children];
  const k=rows.findIndex(r=>r.classList.contains('cur'));if(k<0)return;
  if(k===0)bmPanel.scrollTo({top:0,behavior:b});
  else if(k===rows.length-1)bmPanel.scrollTo({top:bmPanel.scrollHeight,behavior:b});
  else panelReveal(rows[k],b);
}
/* показва реда в панела, като скролва САМО панела: scrollIntoView скролва и родителските контейнери (сцената се измества, докато панелът се плъзга навън) */
function panelReveal(r,b){
  const pr=bmPanel.getBoundingClientRect(),rr=r.getBoundingClientRect(),top=58,bot=8;   /* 58px: залепената глава на панела (като scroll-margin на .bmi) */
  let d=0;
  if(rr.top<pr.top+top)d=rr.top-pr.top-top;
  else if(rr.bottom>pr.bottom-bot)d=rr.bottom-pr.bottom+bot;
  if(d)bmPanel.scrollBy({top:d,behavior:b||'auto'});
}
let bmTab='bm';
/* един панел наведнъж: контролният панел се скрива при отваряне на „Отметки“/„Библиотека“/„Настройки“ и се връща, когато всички те са затворени */
function hudYield(){if(reading&&hud.classList.contains('open'))setHud(false)}
function hudRestore(){}   /* при затваряне на панел екранът остава чист: контролният панел не се връща сам */
/* ръчно отваряне на контролния панел (C или бутона): затваря отметките/текстовете/настройките, за да не се застъпват */
function hudOpenManual(){if(bmPanel.classList.contains('open'))toggleBm(false);if(settings.classList.contains('open'))toggleSettings(false);setHud(true,true)}   /* контролният панел е бил отворен, преди да се отвори „Отметки“/„Библиотека“ */
function setBmTab(tab){
  const nt=tab==='sc'?'sc':'bm';
  if(bmPanel.dataset.tab!==nt){
    /* страната (ляво/дясно) се сменя без плъзгане, за да не „минава“ панелът през екрана; анимира се само самото отваряне */
    bmPanel.style.transition='none';bmTab=nt;bmPanel.dataset.tab=nt;
    void bmPanel.offsetWidth;bmPanel.style.transition='';
  }else{bmTab=nt;bmPanel.dataset.tab=nt}
}
function toggleBm(force,tab){
  if(tab===undefined)tab=bmTab;
  const open=bmPanel.classList.contains('open');
  const o=force!==undefined?force:!(open&&bmTab===tab);
  if(!clDrive&&(clMode===1||clMode===2)&&typeof clReset==='function')clReset();   /* панелът е сменен от клавиатурата или мишката */
  clKbOpen=!!o&&!clDrive;
  if(o)setBmTab(tab);
  /* панелите не се трупат: контролният панел се скрива при отваряне на „Отметки“/„Библиотека“ и се връща при затваряне */
  if(o){if(settings.classList.contains('open'))toggleSettings(false);hudYield()}
  bmPanel.classList.toggle('open',o);if(!o&&open)hudRestore();if(o)scrollPanelCur(false);$('#hBm').setAttribute('aria-pressed',String(o&&bmTab==='bm'));$('#hSc').setAttribute('aria-pressed',String(o&&bmTab==='sc'));showHud();
}
setBmTab('bm');
