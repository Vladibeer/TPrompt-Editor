/* ---------- Телепромптър ---------- */
const pxps=()=>S.speed*0.06*S.fs;
function buildPrompter(){
  const c=edClone();
  c.querySelectorAll('[style]').forEach(el=>{
    const fs=el.style.fontSize;
    if(fs&&fs.endsWith('px'))el.style.fontSize=`calc(var(--pfs) * ${(parseFloat(fs)/BASE).toFixed(4)})`;
  });
  findBm(c).forEach((el,i)=>{el.setAttribute('data-bm',i);stripTilde(el)});
  textcol.innerHTML=c.innerHTML;
  bmEls=[...textcol.querySelectorAll('[data-bm]')];
  textcol.querySelectorAll('img').forEach(im=>{if(!im.complete)im.addEventListener('load',()=>{if(typeof layout==='function')layout()},{once:true})});
}
const mkY=()=>S.markerY;
function layout(){
  if(rmFollow||fitSc)rcFit();
  const H=viewport.clientHeight;
  scroller.style.paddingTop=(H*mkY()/100)+'px';
  scroller.style.paddingBottom=(H*(1-mkY()/100))+'px';
  maxPos=Math.max(0,scroller.offsetHeight-H);
  const ptop=H*mkY()/100;bmPos=bmEls.map(el=>el.offsetTop-ptop);
  pos=Math.min(Math.max(0,pos),maxPos);
}
let lastTxt='';
const elProg=$('#hProgFill'),elTime=$('#hTime'),elPct=$('#hPct');
function draw(force){
  scroller.style.transform=`translate3d(0,${-pos}px,0)`;
  const f=maxPos?pos/maxPos:0;
  if(hud.classList.contains('open')||force)elProg.style.transform=`scaleX(${f})`;
  updateCur();
  const rem=Math.max(0,Math.round((maxPos-pos)/Math.max(1,pxps())));
  const t=`${Math.floor(rem/60)}:${String(rem%60).padStart(2,'0')}`,p=Math.round(f*100)+'%';
  const key=t+p;
  if(force||key!==lastTxt){lastTxt=key;elTime.textContent='−'+t;elPct.textContent=p}
}
function step(now,maxDt){
  if(rmFollow){followStep(now);return}
  const dt=Math.min(maxDt,Math.max(0,(now-lastT)/1000));lastT=now;lastTickAt=performance.now();
  let moved=false;
  if(rd&&rd.last!=null&&Math.abs(pos-rd.last)>.01)rd=null;   /* позицията е сменена другаде (начало, отметка, докосване): плъзгането от другия екран спира */
  if(playing&&!(rd&&rd.abs)){pos+=pxps()*dt;moved=true}
  if(rd){
    const tn=Date.now(),age=Math.min(RD_AGE,Math.max(0,(tn-rd.at)/1000)),tgt=rd.p+rd.v*age;
    let n=(rd.abs?pos:rd.done)+(age<RD_AGE?rd.v*dt:0);
    n+=(tgt-n)*(1-Math.exp(-dt/.08));
    const end=(!rd.v||tn-rd.at>1500)&&Math.abs(tgt-n)<.3;
    if(end)n=tgt;
    if(rd.abs)pos=n;else{pos+=n-rd.done;rd.done=n}
    if(end)rd=null;
    moved=true;
  }
  if(remain){
    let st=remain*(1-Math.exp(-dt*8));
    if(Math.abs(remain)<.5)st=remain;
    remain-=st;pos+=st;moved=true;
  }
  if(flingV){const st=flingV*dt;flingV*=Math.exp(-FLING_K*dt);if(Math.abs(flingV)<25)flingV=0;pos+=st;moved=true}
  if(pos>=maxPos){pos=maxPos;remain=Math.min(0,remain);flingV=0;if(playing){setPlay(false);endHint()}}
  else if(pos<0){pos=0;remain=Math.max(0,remain);flingV=0}
  if(rd)rd.last=pos;
  if(moved)draw();
  /* докато ръчният скрол (колело, плъзгане в превюто) се изглажда, позицията се праща към превюто на ~30 пъти в секунда:
     иначе то получава нова позиция само на всеки 250 мс и подскача */
  if(VIEWER&&moved&&(remain||flingV||rd||hadRemain))postState()
  hadRemain=!!(remain||flingV||rd);
}
/* плъзгане от друг екран (телефон или превю): съобщенията идват на порции през мрежата, затова екранът не скача до всяка нова позиция.
   С всяко съобщение идват скоростта на пръста и моментът (по часовника на този компютър): текстът върви с тази скорост и плавно поема малката разлика.
   abs: абсолютна позиция (seek), иначе отместване (scroll). */
const RD_AGE=.25;let rd=null;
function rdSet(abs,p,v,at){
  const tn=Date.now();at=+at||tn;if(at>tn)at=tn;else if(tn-at>800)at=tn-800;
  v=+v;if(!isFinite(v))v=0;p=+p;if(!isFinite(p))return;
  remain=0;flingV=0;
  if(abs){
    if(rd&&rd.abs&&at<rd.at)return;   /* закъсняло по-старо съобщение */
    const tg=Math.min(maxPos,Math.max(0,p+v*Math.min(RD_AGE,(tn-at)/1000)));
    if(!rd&&Math.abs(tg-pos)>viewport.clientHeight){pos=tg;draw(true)}   /* голям скок: веднага */
    rd={abs:true,p,v,at,done:0,last:pos};
  }else if(rd&&!rd.abs){rd.p+=p;if(at>=rd.at){rd.v=v;rd.at=at}}
  else rd={abs:false,p,v,at,done:0,last:pos};
}
const rdDest=()=>{if(!rd)return pos+remain+flingV/FLING_K;const tg=rd.p+rd.v*Math.min(RD_AGE,Math.max(0,(Date.now()-rd.at)/1000));return rd.abs?tg:pos+tg-rd.done};
let hadRemain=false;
/* плъзгане с пръст: след пускане текстът продължава по инерция и плавно спира, както при обикновеното превъртане на телефона */
const FLING_K=3.2,FLING_MAX=7000;let flingV=0;
function velTrack(){
  let s=[];
  return{
    reset(){s=[]},
    add(d){const n=performance.now();s.push([n,d]);s=s.filter(p=>n-p[0]<=100)},
    v(){
      const n=performance.now();if(!s.length||n-s[s.length-1][0]>60)return 0;   /* пръстът е спрял преди пускането: без инерция */
      const a=s.filter(p=>n-p[0]<=100);if(a.length<2)return 0;
      let sum=0;for(let i=1;i<a.length;i++)sum+=a[i][1];
      const dt=(a[a.length-1][0]-a[0][0])/1000;if(dt<.008)return 0;
      return Math.max(-FLING_MAX,Math.min(FLING_MAX,sum/dt));
    }
  };
}
function flingRun(v,apply,done){
  let last=performance.now(),id=0;
  const f=now=>{
    const dt=Math.min(.05,Math.max(0,(now-last)/1000));last=now;
    const d=v*dt;v*=Math.exp(-FLING_K*dt);
    if(Math.abs(v)<25){id=0;apply(d,true);if(done)done();return}
    apply(d,false);id=requestAnimationFrame(f);
  };
  id=requestAnimationFrame(f);
  return()=>{if(id){cancelAnimationFrame(id);id=0}};
}
/* позицията и състоянието идват от втория прозорец на компютъра (както в превюто), без собствен часовник */
function followStep(now){
  if(performance.now()<fHold){lastT=now;lastTickAt=performance.now();return}   /* пръстът (или колелото) води: компютърът още не е стигнал */
  const dt=Math.min(.1,Math.max(0,(now-lastT)/1000));lastT=now;lastTickAt=performance.now();
  const tgt=Math.min(1,Math.max(0,pvBase.frac+pvBase.fr*Math.max(0,Date.now()-pvBase.ts)/1000))*maxPos;
  const pl=!!remoteSt.playing;if(pl!==playing)setPlay(pl);
  const gap=Math.abs(tgt-pos);let np=pos;
  if(gap>80)np=tgt;
  else if(!pl){np=gap<.05?tgt:pos+(tgt-pos)*(1-Math.exp(-dt*14))}
  else{const st=pvBase.fr*maxPos*dt,lim=Math.abs(st)*.2+.02;np=pos+st+Math.max(-lim,Math.min(lim,tgt-pos-st))}
  np=Math.min(maxPos,Math.max(0,np));remain=0;
  if(np!==pos){pos=np;draw()}
}
function tick(t){
  if(!reading){raf=0;return}
  step(t,.1);
  raf=requestAnimationFrame(tick);
}
function postState(){
  if(VIEWER&&reading&&performance.now()-lastTickAt>60)step(performance.now(),2);
  post({type:'state',ease:!!(remain||flingV||rd),dest:maxPos?Math.min(1,Math.max(0,rdDest()/maxPos)):0,playing,frac:maxPos?pos/maxPos:0,rate:playing?pxps():0,max:maxPos,ts:Date.now(),time:$('#hTime').textContent,W:innerWidth,H:innerHeight,bm:curBm});
}
function addScroll(d){remain=Math.max(-pos,Math.min(maxPos-pos,remain+d))}
function togglePlay(keepHud){
  if(rmFollow){remotePlay();showHud();return}
  if(!playing&&maxPos>0&&pos>=maxPos-1){pos=0;draw(true)}
  const was=playing;
  setPlay(!playing);
  // панелът се скрива само при старт от клавиш или докосване на екрана, не от бутона в панела
  if(!was&&keepHud!==true&&!hudPinned&&hud.classList.contains('open'))setHud(false);
}
function setPlay(v){
  playing=v;setIcon($('#hPlay i'),v?'pause':'play');$('#hPlay').setAttribute('aria-pressed',String(!!v));
  showHud();
  if(VIEWER&&reading)postState();
}
function showHud(){
  const tg=$('#hudToggle');tg.classList.remove('idle');document.body.classList.remove('nocursor');
  clearTimeout(hudTimer);
  if(playing&&!hud.classList.contains('open'))hudTimer=setTimeout(()=>{
    if(!settings.classList.contains('open')&&!bmPanel.classList.contains('open')){tg.classList.add('idle');document.body.classList.add('nocursor')}
  },2600);
}
let hudPinned=false; // отворен ръчно (C или бутона): не се скрива при пускане
function setHud(v,manual){hud.classList.toggle('open',v);if(v&&reading)elProg.style.transform=`scaleX(${maxPos?pos/maxPos:0})`;$('#hudToggle').classList.toggle('active',v);hudPinned=!!manual&&v;showHud()}
function startReading(full,bmIdx){
  clReset();flingV=0;rd=null;
  if(!edText().trim()){if(VIEWER)document.body.classList.add('vempty');else toast(t('No text. Type something or open a file.'),true);return}
  document.body.classList.remove('vempty');
  scMakeLive();closePal();drawer(null);buildPrompter();renderBm();
  reading=true;posImgTool();renderScripts();refreshEditInd();document.body.classList.add('reading');prompter.hidden=false;updateOpenLabel();
  document.activeElement&&document.activeElement.blur&&document.activeElement.blur();
  applyStyles();pos=0;remain=0;layout();
  if(bmIdx!=null&&bmPos[bmIdx]!=null)pos=Math.min(maxPos,Math.max(0,bmPos[bmIdx]));
  draw(true);setPlay(false);setHud(!VIEWER);
  lastT=performance.now();if(!raf)raf=requestAnimationFrame(tick);
  lockScreen();
  if(full)toggleFS(true);
}
let wl=null;
async function lockScreen(){try{if('wakeLock' in navigator&&!wl){wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}}catch(e){if(e&&e.name!=='NotAllowedError')oops('lockScreen#1',e)}}   /* отказът (напр. пестене на батерия) е нормален: екранът просто може да угасне */
function unlockScreen(){try{if(wl)wl.release()}catch(e){oops('unlockScreen#1',e)}wl=null}
document.addEventListener('visibilitychange',()=>{if(reading&&document.visibilityState==='visible')lockScreen()});
function stopReading(){unlockScreen();clReset();
  if(rmFollow){rmFollow=false;rcFull=false;setIcon($('#r2Full i'),'max')}
  rcUnlockOrient();
  reading=false;rcFit();playing=false;prompter.hidden=true;document.body.classList.remove('reading','nocursor');renderBm();renderScripts();refreshEditInd();updateOpenLabel();
  toggleSettings(false);bmPanel.classList.remove('open');$('#hBm').setAttribute('aria-pressed','false');setHud(false);
  if(fsOn())toggleFS(false);
  try{if(LF.on())setTimeout(()=>{lfWarned={};lfCheck()},300)}catch(e){oops('stopReading#1',e)}   /* отложените въпроси за променен файл се задават след четенето */
}
let fsFailShown=false,ourExit=false;
const fsOn=()=>!!(document.fullscreenElement||document.webkitFullscreenElement);
function kbLock(){try{if(navigator.keyboard&&navigator.keyboard.lock)navigator.keyboard.lock(['Escape']).catch(e=>{oops('kbLock#1',e)})}catch(e){oops('kbLock#2',e)}}
function kbUnlock(){try{if(navigator.keyboard&&navigator.keyboard.unlock)navigator.keyboard.unlock()}catch(e){oops('kbUnlock#1',e)}}
function toggleFS(want){
  const d=document,on=fsOn();
  if(want===undefined)want=!on;
  if(!want){if(on){ourExit=true;(d.exitFullscreen||d.webkitExitFullscreen).call(d)}return}
  if(on)return;
  const el=d.documentElement,f=el.requestFullscreen||el.webkitRequestFullscreen;
  const fail=()=>{if(fsFailShown)return;fsFailShown=true;toast(t('The browser did not allow full screen here. Try F11 or open the file locally.'),true)};
  if(!f){fail();return}
  try{const p=f.call(el);if(p&&p.catch)p.catch(fail)}catch(e){fail()}
}
function onFS(){
  const on=fsOn();document.body.classList.toggle('vfs',on);
  for(const id of ['#vFs','#xFs']){const v=$(id);if(v){setIcon($(id+' i'),on?'min':'max');const tt=t(on?'Exit full screen':'Full screen');v.title=tt;v.setAttribute('aria-label',tt)}}
  setIcon($('#hFull i'),on?'min':'max');
  if(on)kbLock();
  else{kbUnlock();if(reading&&!VIEWER&&!ourExit)stopReading();ourExit=false}
  setTimeout(()=>{if(reading){const f=maxPos?pos/maxPos:0;layout();pos=f*maxPos;draw(true)}},120);
}
document.addEventListener('fullscreenchange',onFS);document.addEventListener('webkitfullscreenchange',onFS);
if(window.ResizeObserver)new ResizeObserver(()=>{if(reading){const f=maxPos?pos/maxPos:0;layout();pos=f*maxPos;draw(true)}}).observe(textcol);
window.addEventListener('resize',()=>{if(reading){const f=maxPos?pos/maxPos:0;layout();pos=f*maxPos;draw(true)}});

/* Диалог за стартиране. Запомненият начин (S.startMode) се пуска с един клик; Shift+клик и Ctrl+Shift+Enter винаги показват диалога. */
const stM=$('#startModal');
const closeRun=()=>{stM.hidden=true;pendBm=null};
const MODES=['full','win'],MODE_BTN={full:'#bStart',win:'#bWin'};
const MODE_T={full:'Full screen',win:'In a window'};
const modeAvail=m=>m!=='win'||!(document.body.classList.contains('rc')||matchMedia('(max-width:640px)').matches);
function openStartDlg(note){
  const n=$('#stNote');n.hidden=!note;n.textContent=note||'';
  $('#stRemember').checked=false;
  MODES.forEach(m=>$(MODE_BTN[m]).classList.toggle('cur',S.startMode===m));
  updateOpenLabel();stM.hidden=false;
  const f=$(MODE_BTN[MODES.includes(S.startMode)?S.startMode:'full']);if(f&&getComputedStyle(f).display!=='none')f.focus();
}
/* пускане от отметка: следва запомнения начин на стартиране; отметката се предава на избрания режим */
let pendBm=null,pendBmWin=null;
function runMode(m,hub){
  const bi=pendBm;pendBm=null;closeRun();
  if(m==='full')fullHere(bi);
  else if(m==='win'){if(bi!=null&&!popupOpen())pendBmWin=bi;togglePopup()}
}
const netLinked=()=>{try{return HOSTROLE&&!VIEWER?!!(hostApi().linked()||hostApi().viewing()):!!(netApi&&netApi.state().on)}catch(e){return false}};   /* свързано ли е другото устройство */
function startFromBm(i){
  const m=S.startMode;
  pendBm=i;
  if(!MODES.includes(m)||netLinked()){openStartDlg();return}
  if(!modeAvail(m)){openStartDlg(t('The remembered mode is not available on this device. Choose another.'));return}
  runMode(m);
}
function pickMode(m){
  if($('#stRemember').checked&&S.startMode!==m){S.startMode=m;saveS();syncUI();updateOpenLabel()}
  runMode(m,true);
}
function startRun(forceDlg){
  pendBm=null;
  const m=S.startMode;
  if(forceDlg||!MODES.includes(m)||netLinked()){openStartDlg();return}
  if(!modeAvail(m)){openStartDlg(t('The remembered mode is not available on this device. Choose another.'));return}
  runMode(m);
}
$('#bRun').addEventListener('click',e=>{REMHOOK.stop();startRun(e.shiftKey)});   /* „Пусни“ започва четене на този текст: управлението на текста на компютъра се спира */
$('#stClose').addEventListener('click',closeRun);
stM.addEventListener('mousedown',e=>{if(e.target===stM)closeRun()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!stM.hidden){e.preventDefault();closeRun()}},true);
/* цял екран на това устройство; свързан Android чете на устройството, а компютърът управлява */
const fullHere=bi=>{
  startReading(true,bi);   /* „Цял екран“ винаги пуска избрания тук текст; мрежата не го подменя */
};
$('#bStart').addEventListener('click',()=>pickMode('full'));

$('#bWin').addEventListener('click',()=>pickMode('win'));
try{screen.addEventListener('change',updateOpenLabel)}catch(e){oops('#bWin click#1',e)}
$('#hPlay').addEventListener('click',()=>togglePlay(true));
$('#hHome').addEventListener('click',()=>{if(rmFollow){post({type:'cmd',cmd:'home'});showHud();return}pos=0;remain=0;draw(true)});
$('#hSpdDn').addEventListener('click',()=>bump('speed',-5));
$('#hSpdUp').addEventListener('click',()=>bump('speed',5));
$('#hFsDn').addEventListener('click',()=>bump('fs',-1));
$('#hFsUp').addEventListener('click',()=>bump('fs',1));
$('#hMk').addEventListener('click',()=>set('marker',!S.marker));
$('#hMH').addEventListener('click',()=>set('mirrorH',!S.mirrorH));
$('#hMV').addEventListener('click',()=>set('mirrorV',!S.mirrorV));
$('#hSet').addEventListener('click',()=>toggleSettings());
$('#hFull').addEventListener('click',()=>toggleFS());
const IN_FRAME=window.parent!==window;
/* затваряне на втория прозорец: в приложението се затваря самият прозорец (window.close() там оставя празна бяла страница) */
function closeViewer(){
  post({type:'bye'});
  if(IN_FRAME)return;
  if(IS_TAURI){
    tinvoke('close_reader').catch(e=>{oops('closeViewer#1',e)});
    setTimeout(()=>{try{const w=window.__TAURI__&&window.__TAURI__.window&&window.__TAURI__.window.getCurrentWindow&&window.__TAURI__.window.getCurrentWindow();if(w)w.close()}catch(e){oops('closeViewer#2',e)}},300);
    return;
  }
  window.close();
}
$('#hExit').addEventListener('click',()=>VIEWER?closeViewer():stopReading());
const hProg=$('#hProg');let seeking=false;
/* при дистанционно лентата мести текста веднага и праща позицията плавно (със скорост), както плъзгането с пръст */
const seek=(e,fin)=>{const r=hProg.getBoundingClientRect();const f=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));flingV=0;rd=null;if(rmFollow){followTo(f*maxPos,fin);showHud();return}pos=f*maxPos;remain=0;draw(true);showHud()};
hProg.addEventListener('click',e=>{e.stopPropagation()});
hProg.addEventListener('pointerdown',e=>{e.stopPropagation();seeking=true;fMv.reset();try{hProg.setPointerCapture(e.pointerId)}catch(e){oops('seek#1',e)}seek(e)});
hProg.addEventListener('pointermove',e=>{if(seeking)seek(e)});
hProg.addEventListener('pointerup',e=>{if(!seeking)return;seeking=false;seek(e,true)});
hProg.addEventListener('pointercancel',()=>{if(!seeking)return;seeking=false;if(rmFollow)followTo(pos,true)});
$('#hBm').addEventListener('click',()=>toggleBm(undefined,'bm'));
$('#hSc').addEventListener('click',()=>toggleBm(undefined,'sc'));
$('#hudToggle').addEventListener('click',e=>{e.stopPropagation();if(hud.classList.contains('open'))setHud(false,true);else hudOpenManual()});
if(/Android/i.test(navigator.userAgent)||(window.Capacitor&&window.Capacitor.getPlatform&&window.Capacitor.getPlatform()==='android'))document.body.classList.add('isdroid');
/* Android: превключва между портрет и пейзаж (приставката на приложението, а ако я няма - API на браузъра) */
$('#xRot').addEventListener('click',e=>{
  e.stopPropagation();
  /* вграденият прозорец (iframe) няма достъп до приставката: завъртането се прави от основния прозорец */
  if(IN_FRAME){try{window.parent.postMessage({tpRot:1},'*');return}catch(e){oops('#xRot click#1',e)}}
  rotToggle();
});
$('#xExit').addEventListener('click',e=>{e.stopPropagation();$('#hExit').click()});
$('#xFs').addEventListener('click',e=>{e.stopPropagation();toggleFS()});
hud.addEventListener('click',e=>e.stopPropagation());
bmPanel.addEventListener('click',e=>e.stopPropagation());
$('#bmClose').addEventListener('click',()=>toggleBm(false));
hud.addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});
settings.addEventListener('mousedown',e=>{if(e.target===settings){toggleSettings(false);return}if(reading&&e.target.closest('button'))e.preventDefault()});
prompter.addEventListener('pointermove',showHud);
prompter.addEventListener('click',e=>{
  if(e.target.closest('#hud,#bmPanel'))return;
  if(dragMoved){dragMoved=false;return}
  if(bmPanel.classList.contains('open')){toggleBm(false);return}
  if(settings.classList.contains('open')){toggleSettings(false);return}
  edgeTap(e);
});
let tapT=0,tapZone=0,tapTimer=0;
function edgeTap(e){
  const H=innerHeight,y=e.clientY;
  const zone=y<H*.18?-1:y>H*.82?1:0;
  if(!zone){clearTimeout(tapTimer);tapTimer=0;togglePlay();return}
  const now=performance.now();
  if(tapTimer&&tapZone===zone&&now-tapT<350){
    clearTimeout(tapTimer);tapTimer=0;
    const dir=zone<0?(S.invert?1:-1):(S.invert?-1:1);
    bump('speed',dir*5);
    return;
  }
  tapZone=zone;tapT=now;clearTimeout(tapTimer);
  tapTimer=setTimeout(()=>{tapTimer=0;togglePlay()},350);
}
/* цял екран при дистанционно: позицията е на компютъра, затова плъзгането праща абсолютна позиция (seek), а не се мести локално (followStep би я върнал) */
/* заедно с позицията се праща скоростта на пръста и моментът, за да върви другият екран плавно между съобщенията (вж. rdSet); щом пръстът спре, се праща „спря“ (v=0) */
function moveSender(send){
  const vt=velTrack();let idle=0;
  return{
    add(d){vt.add(d)},
    send(final){clearTimeout(idle);const v=final?0:vt.v();send(v,Date.now());if(v)idle=setTimeout(()=>send(0,Date.now()),90)},
    reset(){vt.reset();clearTimeout(idle)}
  };
}
let fHold=0,fSent=0;
const fMv=moveSender((v,at)=>post({type:'cmd',cmd:'seek',arg:maxPos?pos/maxPos:0,v:maxPos?v/maxPos:0,at}));
function followTo(np,final){
  np=Math.min(maxPos,Math.max(0,np));fMv.add(np-pos);
  pos=np;remain=0;draw(true);
  const f=maxPos?pos/maxPos:0,now=performance.now();
  pvBase={frac:f,fr:pvBase.fr,ts:Date.now()};fHold=now+500;
  if(final||now-fSent>45){fSent=now;fMv.send(final)}
}
function followMove(dStage,final){
  const mv=S.mirrorV?-1:1;
  followTo(pos+dStage*mv,final);
}
prompter.addEventListener('wheel',e=>{
  if(e.target.closest('#bmPanel'))return;e.preventDefault();
  let d=e.deltaY;if(e.deltaMode===1)d*=40;else if(e.deltaMode===2)d*=viewport.clientHeight;
  if(rmFollow){followMove(d/(fitSc||1));showHud();return}
  rd=null;addScroll(d);showHud();
},{passive:false});
let ty=null,tx=null,pinch=null,fStop=null;const tVel=velTrack();
const pdist=e=>Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY);
prompter.addEventListener('touchstart',e=>{
  /* докосване по време на инерцията само я спира (не пуска и не спира четенето) */
  const wasFling=Math.abs(flingV)>60||!!fStop;flingV=0;
  if(fStop){fStop();fStop=null;if(rmFollow)followMove(0,true)}
  tVel.reset();rd=null;
  if(e.target.closest('#bmPanel,#hud')){ty=null;tx=null;return}   /* панелът (лентата за напредък, бутоните) не плъзга текста и не пуска инерция */
  if(e.touches.length===2){pinch={d:pdist(e),fs:S.fs};ty=null;dragMoved=true;return}
  ty=e.touches[0].clientY;tx=e.touches[0].clientX;dragMoved=wasFling;
},{passive:true});
prompter.addEventListener('touchmove',e=>{
  if(pinch&&e.touches.length===2){const f=Math.round(pinch.fs*pdist(e)/pinch.d/2)*2;if(f!==S.fs&&f>=LIM.fs[0]&&f<=LIM.fs[1])set('fs',f);return}
  if(ty===null||e.touches.length!==1)return;
  const y=e.touches[0].clientY,x=e.touches[0].clientX,d=y-ty,dx=x-tx;ty=y;tx=x;
  if(rmFollow){   /* завъртян екран (напр. 16:9 хоризонтално на вертикален телефон): надолу по текста е наляво по екрана */
    const dl=prompter.classList.contains('rot')?-dx:d;
    if(Math.abs(dl)>1)dragMoved=true;
    const ds=-dl/(fitSc||1);tVel.add(ds);
    followMove(ds);return;
  }
  if(Math.abs(d)>1)dragMoved=true;
  const dp=-d*(S.mirrorV?-1:1);tVel.add(dp);
  remain=0;pos=Math.min(maxPos,Math.max(0,pos+dp));draw();
},{passive:true});
prompter.addEventListener('touchend',e=>{
  const wasDrag=ty!==null&&!pinch&&dragMoved;
  ty=e.touches.length===1?e.touches[0].clientY:null;tx=e.touches.length===1?e.touches[0].clientX:null;if(e.touches.length<2)pinch=null;
  if(e.touches.length===0&&wasDrag){
    const v=tVel.v();tVel.reset();
    if(Math.abs(v)>150){
      if(rmFollow){fStop=flingRun(v,(d,fin)=>{if(reading&&rmFollow)followMove(d,fin)},()=>{fStop=null});return}
      if(reading){flingV=v;return}
    }
  }
  if(rmFollow&&e.touches.length===0&&performance.now()<fHold)followMove(0,true);
});
prompter.addEventListener('touchcancel',()=>{ty=null;tx=null;pinch=null;tVel.reset()});
