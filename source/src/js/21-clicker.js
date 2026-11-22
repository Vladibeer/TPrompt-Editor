/* ---------- Кликър (презентър) ---------- */
/* режими: 0 скорост, 1 отметки, 2 текстове, 3 размер */
let clMode=0,clT=0,clLast=0,clSel=0,clUndo=null,clBadgeEl=null,clBT=0,clPickT=0,clHoldT=0,clHeld=false,clDown=false,clUpOK=true,clDT=0,clPressT=0;
const clToast=m=>{if(!(reading||VIEWER))pvToast(m)}; /* при четене информацията е в #clBadge, без дублиращ toast */
function clRole(e){
  /* Кликърът реагира само на презентерските клавиши; Space, стрелките, B, T, N, P и т.н. са чисто клавиатурни
     и се обработват от клавишните комбинации (без режими и без двойно натискане). */
  const k=e.key;
  if(k==='F5'||k==='Enter'||k==='MediaPlayPause'||k==='MediaPlay'||k==='MediaPause')return 'play';
  if(k==='PageDown'||k==='MediaTrackNext')return 'fwd';
  if(k==='PageUp'||k==='MediaTrackPrevious')return 'back';
  return null;
}
/* режимът „Библиотека“ е наличен винаги, когато има поне един записан текст */
const clOk=m=>m===0||m===3||(m===1&&bmTitles.length>0)||(m===2&&SC.length>0);
const svgI=n=>`<i data-ic="${n}">${svg(n)}</i>`;
function clMark(){[...$(clMode===2?'#scListRead':'#bmListRead').children].forEach((r,i)=>{r.classList.toggle('sel',i===clSel);if(i===clSel)panelReveal(r,'auto')})}
function clHide(){clearTimeout(clBT);if(clBadgeEl)clBadgeEl.classList.remove('show')}
/* рисува съдържанието на значката за текущия режим и я поставя малко над контролния панел, центрирана */
function clPaint(){
  if(!clBadgeEl)return;
  const sp=S.speed,fz=S.fs;
  const lab=['Speed','Bookmarks','Library','Size'][clMode]||'Speed',ic=['gauge','bookmark','text','type'][clMode]||'gauge';
  const val=clMode===1?`${Math.max(clSel,0)+1}/${bmTitles.length}`:clMode===2?`${Math.max(clSel,0)+1}/${SC.length}`:clMode===3?fz:sp;
  const av=(clMode===1||clMode===2)?[1,2].filter(clOk):[0,3];   /* точките показват наличните режими и кой е текущият */
  clBadgeEl.innerHTML=`${svgI(ic)}<span class="l">${esc(t(lab))}</span><b>${esc(String(val))}</b><span class="dots">${av.map(x=>`<span class="${x===clMode?'on':''}"></span>`).join('')}</span>`;
  clBadgeEl.dataset.m=clMode;
  try{const pr=prompter.getBoundingClientRect(),hr=hud.getBoundingClientRect();
    if(hr.height>0)clBadgeEl.style.bottom=Math.max(8,Math.round(pr.bottom-(hr.top-(hud.classList.contains('open')?0:10))+8))+'px'}catch(e){oops('clPaint#1',e)}
}
/* значката се показва само при смяна на режима (clSwitch) */
function clBadge(){
  if(!S.clicker||!(reading||VIEWER)||(clMode!==0&&clMode!==3)){clHide();return}   /* значка има само за скорост и размер */
  if(!clBadgeEl){clBadgeEl=document.createElement('div');clBadgeEl.id='clBadge';$('#prompter').appendChild(clBadgeEl)}
  clPaint();clBadgeEl.classList.add('show');clearTimeout(clBT);
  if(clMode===0)clBT=setTimeout(()=>clBadgeEl.classList.remove('show'),2200);
}
/* ако значката вече е видима, само обновява стойността в нея; сама не се появява */
function clLive(){if(clBadgeEl&&clBadgeEl.classList.contains('show')&&S.clicker)clPaint()}
let clOn=null;
function clWatch(){
  if(clOn!==!!S.clicker){const was=clOn;clOn=!!S.clicker;if(was!==null&&!clOn)clReset()}   /* изключване на кликъра: значката изчезва */
  clLive();
}
function clSwitch(A){
  const quiet=clKbOpen&&(clMode===1||clMode===2);
  clearTimeout(clPickT);clPickT=0;
  if((clMode===1||clMode===2)&&A.bm)A.bm(false);
  clMode=clMode===0?3:0;   /* двоен клик: скорост <-> размер (от отметки/текстове – към скорост) */
  if(quiet)clHide();else clBadge();
}
/* задържане на бутона за старт: отваря „Отметки“, следващото задържане – „Библиотека“, третото затваря и връща към скорост */
const CL_HOLD_MS=550;
function clHold(A){
  clHeld=true;clearTimeout(clHoldT);clHoldT=0;
  if(clUndo){clUndo();clUndo=null;clT=0}   /* натискането вече е пуснало/спряло четенето – връщаме го */
  clearTimeout(clPickT);clPickT=0;
  const was=clMode;
  if((was===1||was===2)&&A.bm)A.bm(false);
  let nm=0;
  if(was===1)nm=clOk(2)?2:0;
  else if(was===2)nm=0;
  else nm=clOk(1)?1:clOk(2)?2:was;
  clMode=nm;
  if((nm===1||nm===2)&&A.bm)A.bm(true,nm===1?'bm':'sc');
  clBadge();
}
/* в отворен панел: ляво/дясно превключват между „Отметки“ и „Библиотека“ */
function clTab(A){
  const to=clMode===1?2:1;if(!clOk(to))return;
  clearTimeout(clPickT);clPickT=0;
  A.bm(false);clMode=to;A.bm(true,to===1?'bm':'sc');
  clBadge();
}
function clUpStop(){clDown=false;clearTimeout(clHoldT);clHoldT=0}
window.addEventListener('keyup',e=>{
  const kk=(e.key&&e.key!=='Unidentified')?e.key:(typeof KC!=='undefined'?KC[e.keyCode]:'');
  if(kk==='F5'||kk==='Enter'||kk==='MediaPlayPause'||kk==='MediaPlay'||kk==='MediaPause'){clUpOK=true;clUpStop()}
},true);
window.addEventListener('blur',clUpStop);
function clickerKey(e,A){const r=clickerKey0(e,A);if(r)clLive();return r}
/* всичко, което не идва от кликъра, връща кликъра в начално състояние, за да не се смесват двете управления */
let clDrive=false;
var clKbOpen=false;   /* панелът е отворен от клавиатурата или мишката, не от кликъра: значката не се показва */
function clReset(){clearTimeout(clPickT);clPickT=0;clUpStop();clHeld=false;clUndo=null;clT=0;clMode=0;if(clBadgeEl)clBadgeEl.classList.remove('show')}
function clKeyboard(){clUndo=null;clT=0;if(clPickT){clearTimeout(clPickT);clPickT=0}}
function clickerKey0(e,A){
  if(!S.clicker)return false;
  const r=clRole(e);if(!r)return false;
  if(e.repeat){if(r==='play'&&!clHeld)clHold(A);return true}   /* продължително държане (повторение на клавиша) */
  const n=performance.now();
  /* някои кликъри при държане пращат поредица от обикновени натискания (без знак за повторение): ако клавишът още не е „пуснат“, това е държане, не нов клик */
  if(r==='play'&&clDown){
    if(clUpOK&&n-clDT<600){clDT=n;if(!clHeld&&n-clPressT>=CL_HOLD_MS)clHold(A);return true}
    if(n-clDT>=600)clUpOK=false;   /* твърде отдавна без „пускане“: този кликър не праща keyup */
  }
  if(n-clLast<120)return true;clLast=n;
  if(r==='play'){
    /* ако се знае, че кликърът праща и „пускане“ на клавиша, задържането се познава и по време */
    clDown=true;clHeld=false;clDT=n;clPressT=n;clearTimeout(clHoldT);
    clHoldT=clUpOK?setTimeout(()=>{clHoldT=0;if(clDown&&!clHeld){clHold(A);clLive()}},CL_HOLD_MS):0;
    if((clMode===1||clMode===2)&&A.bm){
      /* в панела: едно натискане избира (след кратко изчакване), двойно затваря панела без избор */
      if(clPickT){clSwitch(A);return true}
      const quiet=clKbOpen;   /* панелът е отворен от клавиатурата: след избора няма значка */
      clPickT=setTimeout(()=>{clPickT=0;A.pick();clMode=0;if(!quiet)clBadge()},350);return true;
    }
    if(clUndo&&n-clT<350){clUndo();clUndo=null;clT=0;clSwitch(A);return true}
    clT=n;A.play();clUndo=A.play;return true;
  }
  if(clPickT){clearTimeout(clPickT);clPickT=0}
  if(r==='mode'){clSwitch(A);return true}
  const d=r==='fwd'?1:-1;
  if(clMode===1||clMode===2){
    if(A.bm)clTab(A);
    else if(clMode===1){if(d>0)A.next();else A.prev()}
    else A.step(d);
  }
  else if(clMode===3){bump('fs',d);clToast(t('Size: {n}',{n:S.fs}))}
  else{bump('speed',d*(e.shiftKey?1:5));clToast(t('Speed: {n}',{n:S.speed}))}
  return true;
}
const clRead={play:()=>togglePlay(),next:()=>gotoBm(curBm+1),prev:()=>gotoPrevBm(),
  bm:(o,tab)=>{clDrive=true;try{toggleBm(o,tab||'bm')}finally{clDrive=false}if(o){clSel=Math.max(tab==='sc'?scIdx(liveId()):curBm,0);clMark()}},
  pick:()=>{clDrive=true;try{if(clMode===2){const r=$('#scListRead').children[clSel];if(r)r.click()}else{gotoBm(clSel);toggleBm(false,'bm')}}finally{clDrive=false}}};
const clRem={play:()=>remotePlay(),next:()=>post({type:'cmd',cmd:'next'}),prev:()=>post({type:'cmd',cmd:'prev'}),step:d=>scStep(d)};

/* Дистанционни и кликъри (Bluetooth, Android TV): някои пращат клавиши без име ("Unidentified") или само с цифров код.
   Допълваме липсващото име по keyCode, преди останалите обработчици да го видят. */
const KC={13:'Enter',23:'Enter',66:'Enter',37:'ArrowLeft',38:'ArrowUp',39:'ArrowRight',40:'ArrowDown',33:'PageUp',34:'PageDown',27:'Escape',32:' ',
  179:'MediaPlayPause',176:'MediaTrackNext',177:'MediaTrackPrevious',19:'ArrowUp',20:'ArrowDown',21:'ArrowLeft',22:'ArrowRight',85:'MediaPlayPause'};
window.addEventListener('keydown',e=>{
  if((!e.key||e.key==='Unidentified'||e.key==='Dead')&&KC[e.keyCode]){try{Object.defineProperty(e,'key',{value:KC[e.keyCode],configurable:true})}catch(e){oops('clickerKey0#1',e)}}
  if(!e.code&&e.key){const n={ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',Enter:'Enter',PageUp:'PageUp',PageDown:'PageDown'}[e.key];if(n){try{Object.defineProperty(e,'code',{value:n,configurable:true})}catch(e){oops('clickerKey0#2',e)}}}
},true);
/* Windows: кръстачката и OK на Bluetooth дистанционни (Mi Remote и др.) идват от приложението (Raw Input),
   защото Windows не ги превръща в клавиши. Подаваме ги като обикновени натискания на стрелките и Enter. */
(function(){
  const EV=window.__TAURI__&&window.__TAURI__.event;if(!EV||!EV.listen)return;
  const KCODE={Enter:13,ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40},real={};
  window.addEventListener('keydown',e=>{if(e.isTrusted)real[e.key]=performance.now()},true);
  EV.listen('hidkey',ev=>{
    const p=ev.payload||{},k=p.key;if(!KCODE[k])return;
    if(p.down&&performance.now()-(real[k]||-1e9)<100)return;   /* същият бутон вече е дошъл и като истински клавиш */
    const e=new KeyboardEvent(p.down?'keydown':'keyup',{key:k,code:k,bubbles:true,cancelable:true});
    try{Object.defineProperty(e,'keyCode',{value:KCODE[k]});Object.defineProperty(e,'which',{value:KCODE[k]})}catch(e){oops('clickerKey0#3',e)}
    (document.activeElement||document.body).dispatchEvent(e);
  }).catch(e=>{oops('clickerKey0#4',e)});
})();
document.addEventListener('keydown',e=>{
  const t=e.target,k=keyName(e);
  if(k==='F1'){e.preventDefault();toggleHelp();return}
  if(!$('#helpModal').hidden){if(k==='Escape'){e.preventDefault();toggleHelp(false)}else if(k==='Tab'||k==='ArrowUp'||k==='ArrowDown'||k==='PageUp'||k==='PageDown'||k==='Home'||k==='End'||k==='space'){/* прокарване в прозореца */}e.stopPropagation();return}
  const typing=t.closest&&t.closest('input[type=number],input[type=text],select,textarea,[contenteditable="true"]');
  if(k==='Escape'&&settings.classList.contains('open')){e.preventDefault();toggleSettings(false);return}
  if(!reading){
    if(settings.classList.contains('open')&&!e.ctrlKey&&!e.metaKey&&!e.altKey){   /* докато настройките са отворени, клавишите на редактора не действат */
      if(k==='s'&&!typing){e.preventDefault();toggleSettings(false)}
      return;
    }
    if(e.shiftKey&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&k==='Enter'){e.preventDefault();togglePopup();return}
    if(S.clicker&&!remoteOn()&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&(k==='F5'||k==='MediaPlayPause'||k==='MediaPlay')){e.preventDefault();if(!e.repeat)startReading(true);return}
    const mod=e.ctrlKey||e.metaKey;
    /* единични клавиши работят винаги, освен докато се пише в текстово поле или в редактора */
    if(!typing&&!mod&&!e.altKey&&k!=='Escape'){
      if(remoteOn()?handleRemoteKey(e):handleLocalKey(e)){e.preventDefault();return}
    }
    if(mod&&!e.altKey&&!e.shiftKey&&k==='n'){e.preventDefault();scAddEmpty();return}
    if(remoteActive&&remoteOn()&&k==='Escape'&&handleRemoteKey(e)){e.preventDefault();return}
    if(mod&&k==='Enter'){e.preventDefault();if(e.shiftKey)startRun(true);else startReading(true)}
    else if(mod&&k==='s'){e.preventDefault();openSaveDlg()}
    else if(mod&&k==='o'){e.preventDefault();openDialog()}
    else if(k==='Escape'){closePal();drawer(null)}
    return;
  }
  if(typing){if(k==='Escape')t.blur();return}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(t.tagName==='BUTTON')t.blur();
  /* отворен панел „Отметки“ или „Библиотека“: ↑ и ↓ избират ред, Enter го пуска (иначе стрелките сменят скоростта) */
  /* стрелката към ръба на панела го затваря (← „Библиотека“, → „Отметки“), обратната стрелка сменя панела (удобно за дистанционно с кръстачка) */
  if(bmPanel.classList.contains('open')&&!e.shiftKey&&(k==='ArrowRight'||k==='ArrowLeft')){
    e.preventDefault();
    const closeKey=bmTab==='sc'?'ArrowLeft':'ArrowRight';   /* „Библиотека“ са вляво, „Отметки“ – вдясно */
    if(k===closeKey){clearTimeout(clPickT);clPickT=0;clRead.bm(false);clMode=0;clHide();showHud();return}
    const to=bmTab==='sc'?1:2;
    if(clOk(to)){const quiet=clKbOpen;clearTimeout(clPickT);clPickT=0;clRead.bm(false);clMode=to;clRead.bm(true,to===1?'bm':'sc');if(quiet)clKbOpen=true;else clBadge()}
    showHud();return;
  }
  if(bmPanel.classList.contains('open')&&!e.shiftKey&&(k==='ArrowUp'||k==='ArrowDown'||(k==='Enter'&&!S.clicker))){
    const m=bmTab==='sc'?2:1,n=m===2?SC.length:bmTitles.length;
    if(n){
      e.preventDefault();clearTimeout(clPickT);clPickT=0;
      let chg=false;if(clMode!==m){clMode=m;chg=true;clSel=Math.max(m===2?scIdx(liveId()):curBm,0)}
      if(k==='Enter'){clRead.pick();clMode=0}
      else{clSel=Math.max(0,Math.min(n-1,clSel+(k==='ArrowDown'?1:-1)));clMark();if(chg&&!clKbOpen)clBadge();else clLive()}
      showHud();return;
    }
  }
  if(clickerKey(e,clRead)){e.preventDefault();showHud();return}
  clKeyboard();
  let handled=true;
  const fine=e.shiftKey?1:5;
  if(k==='space')togglePlay();
  else if(k==='ArrowUp'||k==='ArrowDown'){
    /* с включен кликър стрелките следват избрания режим (размер или скорост) и значката се обновява */
    const up=k==='ArrowUp';
    if(S.clicker&&clMode===3)bump('fs',up?1:-1);
    else bump('speed',(up?-1:1)*(S.invert?-1:1)*fine);
    clLive();
  }
  else if(k==='plus')bump('fs',1);
  else if(k==='minus')bump('fs',-1);
  else if(k==='PageDown'||k==='ArrowRight')addScroll(viewport.clientHeight*.8);
  else if(k==='PageUp'||k==='ArrowLeft')addScroll(-viewport.clientHeight*.8);
  else if(k==='Home'){pos=0;remain=0;draw(true)}
  else if(k==='End'){pos=maxPos;remain=0;draw(true)}
  else if(k==='f')toggleFS();
  else if(k==='m')set('marker',!S.marker);
  else if(k==='h')set('mirrorH',!S.mirrorH);
  else if(k==='v')set('mirrorV',!S.mirrorV);
  else if(k==='[')bump('markerY',-2);
  else if(k===']')bump('markerY',2);
  else if(k==='s')toggleSettings();
  else if(/^[0-9]$/.test(k)){if(!bmDigit(k,gotoBm))handled=false}
  else if(k==='>')gotoBm(curBm+1);
  else if(k==='<')gotoPrevBm();
  else if(k==='b')toggleBm(undefined,'bm');
  else if(k==='t'){if(!document.body.classList.contains('vnosc'))toggleBm(undefined,'sc')}
  else if(k==='n')scStep(1);
  else if(k==='p')scStep(-1);
  else if(k==='c'){if(hud.classList.contains('open'))setHud(false,true);else hudOpenManual()}
  else if(k==='e'){if(!VIEWER)stopReading();else handled=false}
  else if(k==='Escape'){if(VIEWER){if(fsOn())toggleFS(false)}else stopReading()}
  else handled=false;
  if(handled){e.preventDefault();showHud()}
});
document.addEventListener('keyup',e=>{if((reading||remoteActive)&&e.code==='Space'&&!(e.target.closest&&e.target.closest('input,select,textarea')))e.preventDefault()});
