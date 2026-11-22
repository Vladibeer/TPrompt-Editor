/* ---------- Старт ---------- */
/* ---------- Втори прозорец (втори монитор) ---------- */
let netOnFlag=false,netOpen=null,netStop=null,netCtl=false,lastNet=null,netSt=null,netSeq=0,netDirty=false,takeUntil=-1e9;
let predHold=0;   /* докато тече ръчно скролиране от устройството към компютъра, закъснелите състояния от компютъра не дърпат превюто назад */
let popupWin=null,remoteSeen=-1e9,remoteSt={playing:false,frac:0,time:''},viewerGot=false;
const seenIds=new Set();
const remoteOn=()=>performance.now()-remoteSeen<6000;
/* Android в роля „домакин“: няма втори прозорец, затова четецът е вграден на цял екран (същият #view, както при „Покажи на устройството“) */
let embBox=null;
function embOpen(){
  if(embBox)return;
  try{oriFree()}catch(e){oops('embOpen#1',e)}
  const box=document.createElement('div');box.id='embBox';
  const fr=document.createElement('iframe');
  fr.src=location.href.split('#')[0]+'#view';fr.title='TPrompt';fr.setAttribute('allowfullscreen','');
  box.appendChild(fr);document.body.appendChild(box);embBox=box;
  popupWin={closed:false,emb:true,focus(){},close(){embClose()}};
  remoteClosedAt=-1e9;updateOpenLabel();
}
function embClose(){
  if(!embBox)return;
  embBox.remove();embBox=null;
  if(popupWin&&popupWin.emb)popupWin=null;
  try{oriPortrait()}catch(e){oops('embClose#1',e)}
  try{updateOpenLabel()}catch(e){oops('embClose#2',e)}
}
function openPopup(local){
  if(!local&&netOnFlag&&netOpen){netOpen();return}   /* „В прозорец“ (local) винаги отваря прозорец тук; към другото устройство праща само „Покажи на…“ */
  if(popupWin&&!popupWin.closed){try{popupWin.focus()}catch(e){oops('openPopup#1',e)}return}
  if(!IS_TAURI&&HOSTROLE&&isDroidApp()){embOpen();return}
  if(IS_TAURI){
    tinvoke('open_reader').then(()=>{
      popupWin={closed:false,focus(){tinvoke('open_reader').catch(e=>{oops('openPopup#2',e)})},close(){tinvoke('close_reader').catch(e=>{oops('openPopup#3',e)})}};
      remoteClosedAt=-1e9;updateOpenLabel();
    }).catch(e=>toast(String(e),true));
    return;
  }
  /* Прозорецът се отваря с noopener: така браузърът го пуска в собствен процес със собствена нишка. С връзка към главния
     прозорец (opener) двамата делят една нишка и всеки кадър на превюто или всяко обновяване на списъците забавя четеца на втория екран. */
  const url=location.href.split('#')[0]+'#view';
  try{window.open(url,'tprompt_view','popup=yes,noopener,noreferrer,width=1280,height=720')}catch(e){oops('openPopup#4',e)}
  const pw={closed:false,pending:true,nowin:true,focus(){},close(){}};
  popupWin=pw;remoteClosedAt=-1e9;updateOpenLabel();
  setTimeout(()=>{if(popupWin===pw&&pw.pending&&!remoteOn()){popupWin=null;updateOpenLabel();toast(t('The browser blocked the new window. Allow pop-ups for this site.'),true)}},3500);
  placeOnSecond();
}
async function placeOnSecond(){
  try{
    if(!hasScreen2()||!window.getScreenDetails)return;
    const d=await window.getScreenDetails(),cur=d.currentScreen;
    const o=d.screens.find(x=>x.left!==cur.left||x.top!==cur.top);
    if(!o)return;
    /* прозорецът без opener се мести от самия себе си: изчакваме първия му сигнал и му пращаме мястото */
    const t0=performance.now();
    const go=()=>post({type:'cmd',cmd:'place',arg:{x:o.availLeft,y:o.availTop,w:o.availWidth,h:o.availHeight}});
    const wait=()=>{if(remoteOn()){go();setTimeout(go,250)}else if(performance.now()-t0<5000)setTimeout(wait,150)};
    wait();
  }catch(e){toast(t('Allow access to displays to open automatically on the second screen.'))}
}
let tauriMon=1;
if(IS_TAURI&&!VIEWER){const pm=()=>tinvoke('monitor_count').then(n=>{if(n!==tauriMon){tauriMon=n;updateOpenLabel()}}).catch(e=>{oops('pm#1',e)});pm();setInterval(pm,4000)}

/* Запомняне на размера и положението на прозорците между стартиранията (само в приложението за Windows).
   Главният и вторият прозорец пазят данните си поотделно. Вторият помни и дали е на цял екран и на кой монитор.
   Ако мониторът вече не съществува, положението се пропуска и прозорецът се отваря на обичайното място.
   Прозорците се създават скрити (Rust) и се показват тук, след като им върнем размера и мястото, за да няма скачане.
   Ако нещо тук се провали, прозорецът пак се показва (а Rust го показва сам най-късно след 4 секунди). */
if(IS_TAURI)(async()=>{
  let w=null;
  const showNow=async()=>{try{if(w&&!(await w.isMinimized()))await w.show()}catch(e){oops('showNow#1',e)}};
  try{
    const TA=window.__TAURI__||{},WN=TA.window,DP=TA.dpi;
    w=(WN&&WN.getCurrentWindow&&WN.getCurrentWindow())||null;
    if(!w||!DP||!DP.PhysicalPosition||!DP.PhysicalSize){await showNow();return}
    const KEY='tp.win.'+(VIEWER?'reader':'main');
    const num=v=>typeof v==='number'&&isFinite(v);
    const load=()=>{try{const j=JSON.parse(localStorage.getItem(KEY)||'null');return j&&typeof j==='object'?j:null}catch(e){return null}};
    let mons=[];try{mons=(WN.availableMonitors&&await WN.availableMonitors())||[]}catch(e){oops('load#1',e)}
    /* положението е годно, ако заглавната лента е върху някой монитор (иначе прозорецът не може да се хване) */
    const onScreen=(x,y)=>mons.some(m=>x+80>=m.position.x&&x+80<m.position.x+m.size.width&&y+30>=m.position.y&&y+30<m.position.y+m.size.height);
    const st=load();
    if(st){
      try{
        const mini=await w.isMinimized();   /* старт с Windows (--minimized): връщаме мястото, но не разгръщаме прозореца */
        if(!st.fs&&await w.isFullscreen())await w.setFullscreen(false);
        if(num(st.w)&&num(st.h)&&st.w>=300&&st.h>=200)await w.setSize(new DP.PhysicalSize(Math.round(st.w),Math.round(st.h)));
        if(num(st.x)&&num(st.y)&&onScreen(st.x,st.y))await w.setPosition(new DP.PhysicalPosition(Math.round(st.x),Math.round(st.y)));
        if(VIEWER&&st.fs&&num(st.fx)&&num(st.fy)&&onScreen(st.fx,st.fy)){
          await w.setPosition(new DP.PhysicalPosition(Math.round(st.fx),Math.round(st.fy)));
          await w.setFullscreen(true);
        }else if(st.max&&!mini)await w.maximize();
      }catch(e){oops('onScreen#1',e)}
    }
    await showNow();
    /* следим на всяка секунда; запис само при промяна */
    let last=JSON.stringify(st||null);
    const snap=async()=>{
      try{
        if(await w.isMinimized())return;
        const [mx,fs,p,sz]=await Promise.all([w.isMaximized(),w.isFullscreen(),w.outerPosition(),w.innerSize()]);
        if(!num(p.x)||!num(p.y)||p.x<-30000||p.y<-30000)return;
        const o=load()||{},n={x:o.x,y:o.y,w:o.w,h:o.h,fx:o.fx,fy:o.fy,max:!!mx,fs:!!(VIEWER&&fs)};
        if(fs){if(VIEWER){n.fx=p.x;n.fy=p.y}}
        else if(!mx&&sz.width>=300&&sz.height>=200){n.x=p.x;n.y=p.y;n.w=sz.width;n.h=sz.height}
        const js=JSON.stringify(n);
        if(js!==last){last=js;try{localStorage.setItem(KEY,js)}catch(e){oops('snap#1',e)}}
      }catch(e){oops('snap#2',e)}
    };
    setInterval(snap,1000);
    window.addEventListener('beforeunload',snap);
  }catch(e){await showNow()}
})();
const hasScreen2=()=>IS_TAURI?tauriMon>1:(()=>{try{return !!screen.isExtended}catch(e){return false}})();   /* втори монитор на това устройство */
const hasSecond=()=>netOnFlag||hasScreen2();
const popupOpen=()=>!VIEWER&&(remoteOn()||!!(popupWin&&!popupWin.closed));
function closePopup(){
  remoteClosedAt=performance.now();post({type:'cmd',cmd:'close'});
  try{if(popupWin)popupWin.close()}catch(e){oops('closePopup#1',e)}
  popupWin=null;remoteSeen=-1e9;updateRemote();updateOpenLabel();
}
const NOHOST={linked:()=>false,connected:()=>false,viewing:()=>false,isOn:()=>false,showOnPhone(){}};
const hostApi=()=>{try{return HOST||NOHOST}catch(e){return NOHOST}};   /* HOST се създава по-надолу */
function togglePopup(){
  /* четене на устройството и във втори прозорец едновременно не се поддържа: сменяме мястото */
  if(HOSTROLE&&hostApi().viewing()){closePopup();openPopup(true);return}
  if(popupWin&&popupWin.net){if(netStop)netStop();openPopup(true);return}   /* текстът се показва на другото устройство: спираме го там и отваряме прозорец тук */
  if(popupOpen())closePopup();else openPopup(true);
}
var currentNetRoleTab=null;
function setNetRoleTab(role){
  const selected=role==='cli'?'cli':'host';
  const isHost=selected==='host';
  const bH=document.getElementById('netTabHost'),bC=document.getElementById('netTabCli');
  const hs=document.getElementById('netHostSec'),cs=document.getElementById('netCliSec');
  /* пишем в DOM само при реална промяна, за да не предизвикваме излишно преизчисляване на стилове */
  const same=currentNetRoleTab===selected&&hs&&cs&&hs.hidden===!isHost&&cs.hidden===isHost;
  currentNetRoleTab=selected;
  if(same)return;
  if(bH){bH.classList.toggle('on',isHost);bH.setAttribute('aria-selected',String(isHost));bH.tabIndex=isHost?0:-1}
  if(bC){bC.classList.toggle('on',!isHost);bC.setAttribute('aria-selected',String(!isHost));bC.tabIndex=isHost?-1:0}
  if(hs){hs.hidden=!isHost;hs.style.display=isHost?'':'none'}
  if(cs){cs.hidden=isHost;cs.style.display=isHost?'none':''}
}
window.setNetRoleTab=setNetRoleTab;
/* изборът на роля от потребителя веднага сменя ролята на устройството:
   „Монитор“ включва режима и показва QR кода; „Дистанционно“ спира Монитора.
   Ако в момента има свързано устройство, първо се иска потвърждение, защото връзката ще прекъсне. */
function pickNetRole(role){
  if(VIEWER){setNetRoleTab(role);return}
  if(role==='host'){
    setNetRoleTab('host');
    if(!canHost())return;
    let on=false;try{on=HOSTROLE&&!!hostApi().isOn()}catch(e){oops('pickNetRole#1',e)}
    if(!on)switchRole('host','show');
    return;
  }
  if(!HOSTROLE){setNetRoleTab('cli');return}
  const go=()=>{setNetRoleTab('cli');switchRole('client')};
  let linked=false;try{linked=!!hostApi().linked()}catch(e){oops('pickNetRole#2',e)}
  if(!linked){go();return}
  dlg({title:t('Change role'),icon:'swap',text:t('The connection to the linked device will end. Continue?'),ok:t('Continue')}).then(ok=>{if(ok===true)go();else setNetRoleTab('host')});
}
window.pickNetRole=pickNetRole;

function renderNetworkSettings(){
  const hb=$('#netHostBody'),hi=$('#netHostInactive'),hn=$('#netHostNoSupport');
  const cb=$('#netCliBody');
  const hostMode=HOSTROLE&&!VIEWER;
  const setH=(e,v)=>{if(e&&e.hidden!==v)e.hidden=v};
  const setS=(e,txt,cls)=>{if(!e)return;if(e.textContent!==txt)e.textContent=txt;if(e.className!==cls)e.className=cls};
  let hostOn=false,hostLinked=false;try{hostOn=!!hostApi().isOn();hostLinked=!!(hostApi().connected()||hostApi().viewing())}catch(e){oops('setS#1',e)}
  setH(hb,!hostOn);
  setH(hi,true);   /* без междинен бутон: разделът „Монитор“ сам включва режима */
  setH(hn,canHost());
  setH($('#netHostDesc'),!canHost());   /* в браузър описанието се заменя с бележката, че е само Дистанционно */
  setH(cb,false); /* Панелът за Дистанционно остава напълно видим и използваем */
  setS($('#netHostSt'),hostOn?(hostLinked?t('Connected'):t('Waiting for a connection…')):t('Off'),'sub net-state '+(hostLinked?'ok':hostOn?'warn':''));
  let st=null;try{st=netApi&&netApi.state()}catch(e){oops('setS#2',e)}
  const connected=!!(st&&st.on&&st.ok);
  setS($('#netCliSt'),connected?t('Connected'):st&&st.on?t('Connection lost, retrying…'):t('Not connected'),'sub net-state '+(connected?'ok':st&&st.on?'warn':''));
  {const off=$('#netHostOff');if(off){off.hidden=false;off.disabled=!(hostOn&&hostLinked)}}   /* „Прекъсни връзката“ се вижда винаги; без връзка е недостъпен */
  const addr=$('#netCliAddr');
  if(addr&&(!addr.value||!addr.dataset.initialized)){addr.value=netSavedAddr||'';if(addr.value)addr.dataset.initialized='1'}
  setH($('#netCliScan'),connected);
  if(!currentNetRoleTab)currentNetRoleTab=hostMode?'host':'cli';
  setNetRoleTab(currentNetRoleTab);
}

var netApi=null;   /* вързва се към мрежовия клиент, когато е създаден */
var netSavedAddr='';   /* последният адрес на монитора: пълни полето в Настройки › Връзка след прекъсване или рестарт */
function updateOpenLabel(){
  const phoneV=HOSTROLE&&!VIEWER&&hostApi().viewing(),netV=!!(popupWin&&popupWin.net),open=popupOpen()&&!phoneV&&!netV;
  const net=(!HOSTROLE&&!VIEWER&&netApi)?netApi.state():null,linked=!!(net&&net.on);
  const setT=(id,v)=>setTxt($(id),v);
  const sm=MODES.includes(S.startMode)?S.startMode:'',rt=sm?t('Start')+': '+t(MODE_T[sm]):t('Start');
  setT('#bRunT',t('Start'));if($('#bRun').title!==rt)$('#bRun').title=rt;
  /* Цял екран: винаги чете избрания текст на това устройство */
  setT('#bStartT',t('Full screen'));setT('#bStartS',t('on this device'));
  /* В прозорец: втори прозорец за четене */
  const winT=t(open?'Close the window':'on this device');
  $('#bWin').classList.toggle('on',open);$('#bStart').classList.toggle('on',document.body.classList.contains('reading'));$('#bWin').setAttribute('aria-pressed',String(open));
  setT('#bWinT',t('In a window'));setT('#bWinS',winT);if($('#bWin').title!==winT)$('#bWin').title=winT;
  /* В мрежа: показва текста на свързаното устройство */
  let remOn=false;
  if(HOSTROLE&&!VIEWER){
    const h=hostApi(),ds=h.viewing()?2:h.linked()?1:0;
    remOn=ds===2;
    const b=$('#rmShow');
    if(b){b.disabled=!(h.linked()||h.viewing());b.classList.toggle('on',ds===2);setTxt($('#rmShowT'),t('Full screen'));const sb=$('#rmShowS');if(sb)setTxt(sb,ds===2?t('Stop showing on the connected device'):t('on the connected device'))}
  }else if(linked){
    remOn=popupOpen();
    {const b=$('#rmShow');if(b){b.disabled=!net.ok&&!remOn;b.classList.toggle('on',remOn);const sb2=$('#rmShowS');if(sb2)setTxt(sb2,remOn?t('Stop showing on the connected device'):t('on the connected device'))}}
  }else{const b=$('#rmShow');if(b){b.disabled=true;b.classList.remove('on');const sb2=$('#rmShowS');if(sb2)setTxt(sb2,t('on the connected device'))}}   /* без връзка опцията се вижда, но е недостъпна */
  $('#bRemote').classList.toggle('on',remOn);
  $('#bRemote').classList.toggle('warn',!!(linked&&!net.ok));
  /* „Пусни“ е активен, докато програмата показва текст: на цял екран тук, във втория прозорец или на друго устройство */
  const showing=!VIEWER&&(document.body.classList.contains('reading')||open||remOn||!!(net&&net.on&&popupOpen()));
  $('#bRun').setAttribute('aria-pressed',String(showing));
  setT('#bRemoteT',t('Network'));
  /* под името е само състоянието на връзката: Свързано (Wi‑Fi) или Няма връзка (Wi‑Fi с кръг и ×) */
  const conn=HOSTROLE&&!VIEWER?(hostApi().linked()||hostApi().viewing()):!!(linked&&net.ok),stS=t(conn?'Connected':'Disconnected');
  setT('#bRemoteS',stS);setIcon($('#bRemoteSI'),conn?'netOn':'netOff');$('#bRemote').classList.toggle('off',!conn);
  {const mb=$('#setMode');if(mb){mb.hidden=!conn;if(conn){const host=!!(HOSTROLE&&!VIEWER);setIcon($('#setModeI'),host?'monitor':'swap');setT('#setModeT',t(host?'Monitor':'Remote'))}}}
  /* бутонът в Настройки: „Свържи“ без връзка, „Прекъсни връзката“ при установена връзка */
  const actT=t('Connection settings');$('#bRemote').dataset.conn=conn?'1':'';setT('#bRemoteA',actT);setIcon($('#bRemoteAI'),'link');if($('#bRemote').title!==actT)$('#bRemote').title=actT;
}
/* преглед на втория прозорец (без огледало, за да чете операторът заедно с водещия) */
const pv=$('#pv'),pvWrap=$('#pvWrap'),pvStage=$('#pvStage'),pvScroller=$('#pvScroller'),pvText=$('#pvText');
let pvDims={W:1280,H:720},pvBase={frac:0,fr:0,ts:0},pvLastFr=0,pvRaf=0,pvLast=0,pvDisp=0,pvMax=0,pvRendered=false,remoteActive=false,remoteClosedAt=-1e9;
function previewHtml(){
  const c=liveSync()?edClone():(()=>{const d=document.createElement('div');d.innerHTML=liveHtml();return d})();
  c.querySelectorAll('[style]').forEach(el=>{const fs=el.style.fontSize;if(fs&&fs.endsWith('px'))el.style.fontSize=`calc(var(--pfs) * ${(parseFloat(fs)/BASE).toFixed(4)})`});
  findBm(c).forEach(stripTilde);
  return c.innerHTML;
}
let pvH=0;try{pvH=parseInt(localStorage.getItem('tp.pvH'),10)||0}catch(e){oops('previewHtml#1',e)}
function pvLimits(){const sw=pvWrap.closest('.stagewrap');return{min:80,max:Math.max(80,sw.clientHeight-120-110-30)}}
function layoutPreview(){
  /* превюто е точно копие на втория прозорец (същите W×H), вписано в зоната; височината на зоната е автоматична или зададена от разделителя */
  const W=pvDims.W,H=pvDims.H,aw=pvWrap.clientWidth;if(!aw||!W||!H)return;
  const sw=pvWrap.closest('.stagewrap'),lim=pvLimits();
  let area;
  if(sw.classList.contains('pvfull')){pvWrap.style.height='';area=pvWrap.clientHeight;if(!area)return}
  else if(pvH)area=Math.min(lim.max,Math.max(lim.min,pvH));
  else area=Math.min(H*aw/W,Math.max(140,sw.clientHeight*.6-100));
  const sc=Math.min(aw/W,area/H);
  if(!sw.classList.contains('pvfull'))pvWrap.style.height=area+'px';
  pv.style.width=(W*sc)+'px';pv.style.height=(H*sc)+'px';
  pvStage.style.width=W+'px';pvStage.style.height=H+'px';
  pvStage.style.transform=`scale(${sc})`;
  const PM=S,mY=PM.markerY!=null?PM.markerY:42;
  pvScroller.style.paddingTop=(H*mY/100)+'px';
  pvScroller.style.paddingBottom=(H*(1-mY/100))+'px';
  pvMax=Math.max(0,pvScroller.offsetHeight-H);
  pv.classList.toggle('mk',!!PM.marker);
  pvKick();
}
function renderPreview(){pvText.innerHTML=previewHtml();layoutPreview();pvText.querySelectorAll('img').forEach(im=>{if(!im.complete)im.addEventListener('load',()=>layoutPreview(),{once:true})})}
let pvShown=NaN,pvEase=false,pvDest=0,pvFr=0,pvFinal=0;
function pvEaseTo(m){
  /* ръчно скролиране: вторият прозорец праща докъде ще стигне (dest), а превюто стига дотам със същото плавно намаляване (8 за секунда) в собствените си кадри, независимо от забавянето на съобщенията */
  /* позицията на втория прозорец (frac) се взема само в началото; по време на скрола тя закъснява и дърпа превюто назад, затова се следва само целта (dest) */
  pvEase=true;pvFinal=0;pvFr=m.rate&&m.max?m.rate/m.max:0;pvDest=m.dest||0;pvBase={frac:pvDisp,fr:0,ts:Date.now()};const was=pvRaf;pvKick();if(!was)pvLast=performance.now()-16;   /* първият кадър е с нормална стъпка, иначе превюто подскача в началото на скрола */
}
/* Превюто се обновява на всеки кадър на екрана (при 30 к/с върви накъсано спрямо плавния втори прозорец) и цикълът спира напълно при пауза. */
function pvKick(){if(!pvRaf&&pvRendered&&!VIEWER){pvLast=performance.now()-34;pvRaf=requestAnimationFrame(pvLoop)}}
function pvLoop(now){
  pvRaf=0;
  if(!remoteOn()||VIEWER)return;
  const dt=Math.min(.1,Math.max(0,(now-pvLast)/1000));pvLast=now;
  const target=Math.min(1,Math.max(0,pvBase.frac+pvBase.fr*Math.max(0,performance.timeOrigin+now-pvBase.ts)/1000));   /* точно време в долни милисекунди: без стъпаловидни грешки */
  /* малка разлика се изглажда, а голям скок (отметка, начало) става веднага, както във втория прозорец */
  const gap=Math.abs(target-pvDisp)*pvMax;
  if(pvEase){
    /* вторият прозорец е свършил (pvFinal): целта вече само върви със скоростта на четене, а превюто я догонва със същото плавно приближаване;
       щом достигне стабилното изоставане, предава се на обичайното следване без ускорение или скок */
    if(pvFinal)pvDest=Math.min(1,pvDest+pvFr*dt);
    pvDisp+=(pvDest-pvDisp)*(1-Math.exp(-dt*8));
    const d=(pvDest-pvDisp)*pvMax,lag=pvFinal?pvFr*pvMax/8:0;
    if(Math.abs(d-lag)<1||(pvFinal&&now-pvFinal>1500)){pvEase=false;pvBase={frac:pvFr?pvDisp:pvDest,fr:pvFr,ts:Date.now()}}
    else pvBase={frac:pvDisp,fr:0,ts:Date.now()};
  }
  else if(gap>60)pvDisp=target;   /* при ръчно скролиране големите стъпки също се изглаждат */
  else if(pvBase.fr<=0){
    /* на пауза: бързо доближаване до точната позиция */
    if(gap<.05)pvDisp=target;else pvDisp+=(target-pvDisp)*(1-Math.exp(-dt*14));
  }else{
    /* при движение превюто върви със скоростта на втория прозорец, а остатъчната разлика се поема плавно (експоненциално),
       без рязко ускоряване или забавяне на отделен кадър */
    const step=pvBase.fr*dt,err=target-pvDisp-step;
    pvDisp+=step+err*(1-Math.exp(-dt/.5));
  }
  if(pvDisp<0)pvDisp=0;else if(pvDisp>1)pvDisp=1;
  const y=Math.round(pvDisp*pvMax*20)/20;
  if(y!==pvShown){pvShown=y;pvScroller.style.transform=`translate3d(0,${-y}px,0)`}
  pvPaintBar();
  if(pvBase.fr>0||Math.abs(target-pvDisp)*pvMax>=.05||pvEase)pvRaf=requestAnimationFrame(pvLoop);
}

/* лентите за напредък показват позицията, която се вижда в превюто (не последната получена от другия екран, която по време на плъзгане изостава) */
let pvBarF=-1;
function pvPaintBar(){if(document.body.classList.contains('ctlLock')){pvBarF=-1;return}   /* заключеният главен прозорец на компютъра рисува лентата сам */
  const f=Math.round(Math.min(1,Math.max(0,pvDisp))*2000)/2000;if(f===pvBarF)return;pvBarF=f;const tr=`scaleX(${f})`;$('#rProgFill').style.transform=tr;$('#r2ProgFill').style.transform=tr}
window.addEventListener('resize',()=>{if(pvRendered)layoutPreview()});
if(window.ResizeObserver)new ResizeObserver(()=>{if(pvRendered)layoutPreview()}).observe(pvWrap.closest('.stagewrap'));
function setRemoteActive(v){
  remoteActive=!!v&&remoteOn()&&!VIEWER;
  $('#remote').classList.toggle('active',remoteActive);
}
let pendPlay=null,pendTimer=0;
function remotePlay(){
  /* команда с явна стойност (идемпотентна): интерфейсът показва желаното състояние, докато вторият прозорец потвърди;
     ако потвърждение няма, командата се праща още веднъж, а след ~1 с се показва реалното състояние */
  const v=!remoteSt.playing;
  remoteSt=Object.assign({},remoteSt,{playing:v});
  pendPlay={v,t:performance.now()};
  /* превюто реагира веднага: при пауза спира там, където е, при старт тръгва с последната известна скорост */
  /* командата стига до другия екран с известно закъснение (EST): при пауза превюто спира там, където ще спре и четенето,
     при старт тръгва след същото закъснение. Така потвърждението почти не се различава от показаното и няма „клатушкане“. */
  const EST=130,nowT=Date.now(),curFrac=Math.min(1,Math.max(0,pvBase.frac+pvBase.fr*Math.max(0,nowT-pvBase.ts)/1000));
  if(v)pvBase={frac:curFrac,fr:pvLastFr,ts:nowT+EST};
  else pvBase={frac:Math.min(1,curFrac+pvBase.fr*EST/1000),fr:0,ts:nowT};
  post({type:'cmd',cmd:'play',arg:v});
  clearTimeout(pendTimer);
  pendTimer=setTimeout(()=>{if(pendPlay&&pendPlay.v===v)post({type:'cmd',cmd:'play',arg:v})},400);
  updateRemote();
}
function remoteBm(i){post({type:'cmd',cmd:'bm',arg:i})}   /* без значка с името на отметката във визуализацията */
/* клавиши в редактора, когато няма отворен четец */
function handleLocalKey(e){
  if(e.ctrlKey||e.metaKey||e.altKey)return false;
  const k=keyName(e),fine=e.shiftKey?1:5;
  if(k==='ArrowUp')bump('speed',(S.invert?1:-1)*fine);
  else if(k==='ArrowDown')bump('speed',(S.invert?-1:1)*fine);
  else if(k==='plus')bump('fs',1);
  else if(k==='minus')bump('fs',-1);
  else if(k==='b')togglePanel('bm');
  else if(k==='t')togglePanel('sc');
  else if(k==='s')toggleSettings();
  else if(k==='e')toggleVT('ed');
  else if(k==='c')toggleVT('ctl');
  else if(k==='n')scStep(1);
  else if(k==='p')scStep(-1);
  else if(k==='m')set('marker',!S.marker);
  else if(k==='h')set('mirrorH',!S.mirrorH);
  else if(k==='v')set('mirrorV',!S.mirrorV);
  else return false;
  return true;
}
function handleRemoteKey(e){
  if(e.ctrlKey||e.metaKey||e.altKey)return false;
  if(clickerKey(e,clRem))return true;
  clKeyboard();
  const k=keyName(e),fine=e.shiftKey?1:5,cmd=(c,arg)=>post({type:'cmd',cmd:c,arg});
  if(k==='space')remotePlay();
  else if(k==='ArrowUp')bump('speed',(S.invert?1:-1)*fine);
  else if(k==='ArrowDown')bump('speed',(S.invert?-1:1)*fine);
  else if(k==='plus')bump('fs',1);
  else if(k==='minus')bump('fs',-1);
  else if(k==='PageDown'||k==='ArrowRight')cmd('page',1);
  else if(k==='PageUp'||k==='ArrowLeft')cmd('page',-1);
  else if(k==='Home')cmd('home');
  else if(k==='End')cmd('end');
  else if(/^[0-9]$/.test(k)){if(!bmDigit(k,remoteBm))return false}
  else if(k==='>')cmd('next');
  else if(k==='<')cmd('prev');
  else if(k==='b')togglePanel('bm');
  else if(k==='t')togglePanel('sc');
  else if(k==='s')toggleSettings();
  else if(k==='e')toggleVT('ed');
  else if(k==='c')toggleVT('ctl');
  else if(k==='n')scStep(1);
  else if(k==='p')scStep(-1);
  else if(k==='m')set('marker',!S.marker);
  else if(k==='h')set('mirrorH',!S.mirrorH);
  else if(k==='v')set('mirrorV',!S.mirrorV);
  else if(k==='Escape')setRemoteActive(false);
  else return false;
  return true;
}
let wasRemoteOn=false;
function updateRemote(){
  const on=remoteOn()&&!VIEWER;
  if(!VIEWER&&bmWasEd!==null&&bmEd()!==bmWasEd)renderBm();
  if(!VIEWER&&scWasShown!==null&&showingNow()!==scWasShown)renderScripts();   /* текстът започна или спря да се показва: зеленият номер се появява или изчезва */   /* текстът започна или спря да се показва: отметките сменят източника */
  applyRc();
  $('#remote').hidden=!on;
  $('#pvGrip').hidden=!on;
  if(on!==wasRemoteOn){wasRemoteOn=on;if(on){if(VT.ed){VT.ed=false;autoEd=true}}else if(autoEd){VT.ed=true;autoEd=false}applyView()}
  if(!on){pvRendered=false;if(remoteActive)setRemoteActive(false);return}
  if(!pvRendered){pvRendered=true;renderPreview()}
  markBmActive();
  pvKick();
  setIcon($('#rPlay i'),remoteSt.playing?'pause':'play');$('#rPlay').setAttribute('aria-pressed',String(!!remoteSt.playing));
  pvBarF=-1;pvPaintBar();
  setTxt($('#rSpd'),S.speed);setTxt($('#rFs'),S.fs);
  setIcon($('#r2Play i'),remoteSt.playing?'pause':'play');$('#r2Play').setAttribute('aria-pressed',String(!!remoteSt.playing));
  setTxt($('#r2Spd'),S.speed);setTxt($('#r2Fs'),S.fs);
}
setInterval(()=>{if(VIEWER)return;if(popupWin&&popupWin.nowin&&!popupWin.pending&&performance.now()-remoteSeen>3000)popupWin.closed=true;   /* без сигнал 3 с = прозорецът е затворен */if(popupWin&&popupWin.closed){popupWin=null;remoteSeen=-1e9;if(netCtl){netSt=null;netSeq++;netDirty=true;netCtl=false;lastNet=null}}updateRemote();updateOpenLabel()},500);
if(IS_TAURI&&!VIEWER)setInterval(()=>{if(popupWin&&!popupWin.closed&&!popupWin.net)tinvoke('reader_open').then(o=>{if(!o&&popupWin)popupWin.closed=true}).catch(e=>{oops('updateRemote#1',e)})},700);
function mergeSettings(src){
  const lg=S.lang;
  for(const k in DEF)if(k!=='startMode'&&k in src&&typeof src[k]===typeof DEF[k])S[k]=src[k];
  fromRemote=true;try{saveS()}finally{fromRemote=false}
  applyStyles();syncUI();if(lg!==S.lang)applyLang();
}
function onMsg(m){
  if(!m||!m.type||(m.id&&seenIds.has(m.id)))return;
  /* ако rAF е спрян (прозорецът е на заден план), догонваме позицията по часовник, преди да сменим старт/пауза/скорост */
  if(VIEWER&&reading&&performance.now()-lastTickAt>60)step(performance.now(),2);
  if(m.id){seenIds.add(m.id);if(seenIds.size>200)seenIds.delete(seenIds.values().next().value)}
  /* устройството чете на цял екран: съобщенията на вградения прозорец отиват към компютъра, а не се обработват тук */
  if(!VIEWER&&rvOn&&(m.type==='hello'||m.type==='state'||m.type==='bye'||m.type==='settings')){NETC.fromViewer(m);return}
  if(m.type==='settings'){mergeSettings(m.S||{});if(VIEWER&&reading)postState();return}
  if(VIEWER){
    if(m.type==='content'){
      if(m.S)mergeSettings(m.S);
      docTouched=true;edSet(m.html);viewerGot=true;
      if(reading){const f=maxPos?pos/maxPos:0;buildPrompter();renderBm();layout();pos=(m.reset?0:f)*maxPos;if(m.reset)remain=0;draw(true)}else startReading(false);
    }else if(m.type==='cmd'){
      if(m.cmd==='home'){pos=0;remain=0;draw(true)}
      else if(m.cmd==='seek'){const f=Math.min(1,Math.max(0,+m.arg||0));if(typeof m.v==='number')rdSet(true,f*maxPos,m.v*maxPos,m.at);else{rd=null;pos=f*maxPos;remain=0;draw(true)}}
      else if(m.cmd==='bm')gotoBm(m.arg);
      else if(m.cmd==='play'){if(!!m.arg!==playing)togglePlay(true)}
      else if(m.cmd==='end'){pos=maxPos;remain=0;draw(true)}
      else if(m.cmd==='page')addScroll(m.arg*viewport.clientHeight*.8);
      else if(m.cmd==='scroll'){if(typeof m.v==='number')rdSet(false,m.arg,m.v,m.at);else addScroll(m.arg);showHud();postState()}
      else if(m.cmd==='next')gotoBm(curBm+1);
      else if(m.cmd==='prev')gotoPrevBm();
      else if(m.cmd==='bmpanel')toggleBm();
      else if(m.cmd==='place'){try{const a=m.arg;window.moveTo(a.x,a.y);window.resizeTo(a.w,a.h)}catch(e){oops('onMsg#1',e)}}
      else if(m.cmd==='close'){closeViewer();return}
      postState();
    }
  }else{
    if(m.type==='scsel'){const i=scIdx(m.sid);if(i>=0)scShow(i);return}
    if(m.type==='hello'){if(netCtl&&lastNet)post(Object.assign({},lastNet));else post({type:'content',html:liveHtml(),S:{...S}})}
    else if(m.type==='state'){
      if(performance.now()-remoteClosedAt<2000)return;
      if(netCtl){netSt=m;netSeq++;netDirty=true;return}   /* управлява се от устройството: състоянието отива към него, не към този екран */
      /* бърз път при ръчно скролиране: по едно съобщение на кадър не бива да обновява бутони, текст и размери, иначе главният прозорец се насича */
      if(m.ease&&remoteSt&&remoteOn()&&!pendPlay&&m.W===pvDims.W&&m.H===pvDims.H){
        remoteSeen=performance.now();if(performance.now()<predHold)return;pvEaseTo(m);return;
      }
      if(!remoteOn())pvDisp=m.frac||0;
      let stale=false;
      if(pendPlay){
        /* докато вторият прозорец не потвърди, остарелите съобщения не променят нито бутона, нито позицията (иначе бутонът мига, а текстът подскача назад) */
        if(m.playing===pendPlay.v||performance.now()-pendPlay.t>4000){pendPlay=null;clearTimeout(pendTimer)}
        else{stale=true;m=Object.assign({},m,{playing:pendPlay.v})}
      }
      remoteSt=m;remoteSeen=performance.now();if(popupWin&&popupWin.pending)popupWin.pending=false;
      if(pendBmWin!=null){const b=pendBmWin;pendBmWin=null;remoteBm(b)}   /* пуснато от отметка с прозорец: прозорецът отива на нея, щом отговори */
      if(m.W&&m.H&&(m.W!==pvDims.W||m.H!==pvDims.H)){pvDims={W:m.W,H:m.H};if(pvRendered)layoutPreview();rcRefit()}
      if(m.rate&&m.max)pvLastFr=m.rate/m.max;
      if(!stale&&performance.now()>=predHold){
        /* по време на ръчно скролиране преводите на втория прозорец (със закъснение) не дърпат превюто назад; позицията се доизглажда след края */
        if(m.ease)pvEaseTo(m);
        else if(pvEase){pvFr=m.rate&&m.max?m.rate/m.max:0;pvDest=Math.min(1,(m.frac||0)+pvFr*Math.max(0,Date.now()-(m.ts||Date.now()))/1000);pvFinal=performance.now()}
        else pvBase={frac:m.frac||0,fr:m.rate&&m.max?m.rate/m.max:0,ts:m.ts||Date.now()}   /* вторият прозорец е спрял да изглажда: превюто минава към обичайното следване (при пускане върви със скоростта му) */
      }
      updateRemote();
    }
    else if(m.type==='bye'){if(embBox)embClose();if(netCtl){netSt=null;netSeq++;netDirty=true;netCtl=false;lastNet=null;popupWin=null;updateOpenLabel();return}remoteSeen=-1e9;updateRemote()}
  }
}
if(chan)chan.onmessage=e=>onMsg(e.data);
window.addEventListener('storage',e=>{if(e.key==='tp.msg'&&e.newValue){try{onMsg(JSON.parse(e.newValue))}catch(e){oops('onMsg#2',e)}}});
function initViewer(){
  document.body.classList.add('viewer');if(/Android/i.test(navigator.userAgent))document.body.classList.add('android');docTouched=true;
  document.body.dataset.empty=IN_FRAME?t('There is no text on {d}. Load a text there.',{d:peerN('def')}):t('No text loaded. Load a text in the main window.');
  if(IN_FRAME)document.body.classList.add('vnosc');   /* вграден прозорец на устройството: текстовете се избират от компютъра */
  scReload();
  setIcon($('#hExit i'),'x');
  post({type:'hello'});
  const beat=()=>{if(!reading)return;if(performance.now()-lastTickAt>120)step(performance.now(),2);postState()};
  /* сигналът е от Worker, защото таймерите на прозорец на заден план или закрит от друг се забавят до 1 път в секунда или по-рядко */
  try{
    const w=new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},250)'],{type:'text/javascript'})));
    w.onmessage=beat;
  }catch(e){setInterval(beat,250)}
  setTimeout(()=>{
    if(!viewerGot&&IN_FRAME){   /* четене от компютъра: чакаме текста му, никога не показваме собствения текст на устройството */
      toast(t('Waiting for the text from {d}…',{d:peerN('def')}));
      let n=0;const iv=setInterval(()=>{
        if(viewerGot){clearInterval(iv);return}
        if(++n>=5){clearInterval(iv);toast(t('{n} did not send a text.',{n:peerN('nom')}),true);setTimeout(()=>post({type:'bye'}),1200);return}
        post({type:'hello'});
      },1500);
      return;
    }
    if(!viewerGot)(async()=>{   /* главният прозорец не отговори: показваният текст се взима от голямото хранилище */
      await scReload();
      if(viewerGot)return;
      const x=SC[scIdx(liveId())];if(x)edSet(x.html||'');
      startReading(false);
    })();
  },900);
  if(!IS_TAURI&&!IN_FRAME)toast(t('Click or press a key for full screen.'));
  const arm=ev=>{
    document.removeEventListener('pointerdown',arm,true);document.removeEventListener('keydown',arm,true);
    if(fsOn())return;
    if(ev.type==='keydown'&&(ev.code==='KeyF'||ev.code==='Escape'))return;
    if(ev.target.closest&&ev.target.closest('#hFull,#vBar,#xFs,#xExit,#xRot,#hudToggle'))return;
    dragMoved=true;toggleFS(true);
  };
  if(!IS_TAURI&&!IN_FRAME){document.addEventListener('pointerdown',arm,true);document.addEventListener('keydown',arm,true)}
  window.addEventListener('beforeunload',()=>post({type:'bye'}));
  $('#vFs').addEventListener('click',()=>toggleFS());
  $('#vClose').addEventListener('click',closeViewer);
}
{
  const mk=(side,grip,vname,key,sign)=>{
    let w=250;
    try{w=parseInt(localStorage.getItem(key),10)||250}catch(e){oops('mk#1',e)}
    const setW=x=>{w=Math.round(Math.min(Math.max(200,x),Math.min(700,innerWidth*.5)));document.documentElement.style.setProperty(vname,w+'px')};
    const save=()=>{try{localStorage.setItem(key,w)}catch(e){oops('save#1',e)}};
    setW(w);
    grip.addEventListener('pointerdown',e=>{
      e.preventDefault();const x0=e.clientX,w0=side.getBoundingClientRect().width;
      grip.setPointerCapture(e.pointerId);grip.classList.add('drag');
      const mv=ev=>setW(w0+sign*(ev.clientX-x0));
      const up=()=>{grip.classList.remove('drag');grip.removeEventListener('pointermove',mv);grip.removeEventListener('pointerup',up);save()};
      grip.addEventListener('pointermove',mv);grip.addEventListener('pointerup',up);
    });
    grip.addEventListener('dblclick',()=>{setW(250);save()});
  };
  mk($('#bmSide'),$('#bmGrip'),'--bmw','tp.bmW',1);      /* текстове (вляво): влачене надясно = по-широк */
  mk($('#bmRSide'),$('#bmGripR'),'--bmrw','tp.bmrW',-1);   /* отметки (вдясно): влачене наляво = по-широк */
}
{
  const g=$('#pvGrip');
  g.addEventListener('pointerdown',e=>{
    e.preventDefault();const y0=e.clientY,h0=pvWrap.getBoundingClientRect().height;
    g.setPointerCapture(e.pointerId);g.classList.add('drag');
    const mv=ev=>{const l=pvLimits();pvH=Math.round(Math.min(l.max,Math.max(l.min,h0-(ev.clientY-y0))));layoutPreview()};
    const up=()=>{g.classList.remove('drag');g.removeEventListener('pointermove',mv);g.removeEventListener('pointerup',up);try{localStorage.setItem('tp.pvH',pvH)}catch(e){oops('up#1',e)}};
    g.addEventListener('pointermove',mv);g.addEventListener('pointerup',up);
  });
  g.addEventListener('dblclick',()=>{pvH=0;try{localStorage.removeItem('tp.pvH')}catch(e){oops('up#2',e)}layoutPreview()});
}
let VT={sc:true,bm:true,ed:true,set:true,ctl:true},autoEd=false;
try{Object.assign(VT,JSON.parse(localStorage.getItem('tp.view')||'{}'))}catch(e){oops('up#3',e)}
function applyView(){
  const on=remoteOn()&&!VIEWER,rc=document.body.classList.contains('rc'),eff=rc?rcEff()==='ed':(VT.ed||!on);
  const wide=!rc&&!matchMedia('(max-width:900px)').matches;   /* скриването на секции важи само на компютър; на телефон панелът се избира с бутоните */
  document.body.classList.toggle('hide-bm',wide&&!VT.bm);
  document.body.classList.toggle('hide-sc',wide&&!VT.sc);
  document.body.classList.toggle('ctl-off',!VT.ctl);
  document.body.classList.toggle('ed-off',!eff);
  refreshEditInd();
  const sw=pvWrap.closest('.stagewrap');sw.classList.toggle('pvfull',on&&(!eff||rc));   /* при свързан компютър превюто винаги запълва своя панел */
  {const vis=$('#bmRSide').offsetParent!==null;if(vis&&!bmWasVis)scrollBmActive();bmWasVis=vis}
  if(narrowMQ.matches)syncPanelBtns();
  else $$('[data-vt]').forEach(b=>{const k=b.dataset.vt;b.setAttribute('aria-pressed',String(k==='ed'?eff:VT[k]));if(k==='ed')b.disabled=!on&&!REMHOOK.can()});
  if(pvRendered)layoutPreview();
}
function toggleVT(k){
  VT[k]=!VT[k];if(k==='ed')autoEd=false;   /* текстовете са вляво, отметките вдясно: независими панели */
  saveView();applyView();
}
function togglePanel(k){
  if(narrowMQ.matches){if(rcOn())setRcv(k);else setNtv(k)}
  else toggleVT(k);
}
function saveView(){try{localStorage.setItem('tp.view',JSON.stringify(VT))}catch(e){oops('saveView#1',e)}}
$$('[data-vt]').forEach(b=>b.addEventListener('click',()=>{
  const k=b.dataset.vt;
  if(k==='ed'&&REMHOOK.can()){REMHOOK.go();return}
  if(k==='sc'||k==='bm'){togglePanel(k);return}
  if(narrowMQ.matches){
    if(rcOn())setRcv(k);else setNtv(k);
    return;
  }
  toggleVT(k);
}));
/* малък екран + свързано дистанционно: горе превю/редактор/отметки/настройки, долу контролите */
const narrowMQ=matchMedia('(max-width:900px)');
/* rcv: какво е отворено в горната половина; „pv“ = само превюто и управлението (редакторът е затворен, както в Windows с втори прозорец) */
let rcv='pv',ntv='ed',ntWas=false,rcWas=false,rcLiveWas=false,rcFull=false;
/* дистанционно на цял екран: същият екран като „Цял екран“ (текст, панел за управление, отметки, настройки),
   но позицията следва втория прозорец на компютъра, а бутоните управляват него */
/* Цял екран в мрежа е точно копие на екрана четец: същият размер W×H (със същото пренасяне на редовете), вписан в екрана на устройството,
   и същата ориентация (хоризонтална или вертикална). Ориентацията се заключва през плъгина на Android, а ако не се получи, се върти с CSS. */
function stageXf(){
  const mx=S.mirrorH?-1:1,my=S.mirrorV?-1:1;
  stage.style.transform=fitSc?`translate(-50%,-50%) scale(${fitSc*mx},${fitSc*my})`:`scale(${mx},${my})`;
}
function rcRot(){
  const W=pvDims.W||1280,H=pvDims.H||720;
  const rot=(W>=H)!==(innerWidth>=innerHeight);
  prompter.classList.toggle('rot',rot);
  prompter.style.width=rot?innerHeight+'px':'';prompter.style.height=rot?innerWidth+'px':'';
}
function rcFit(){
  if(reading&&rmFollow&&!VIEWER){
    rcRot();
    const W=pvDims.W||1280,H=pvDims.H||720,aw=prompter.clientWidth,ah=prompter.clientHeight;
    if(!aw||!ah)return;
    fitSc=Math.min(aw/W,ah/H);
    Object.assign(stage.style,{inset:'auto',left:'50%',top:'50%',width:W+'px',height:H+'px'});
    stage.classList.add('fit');
  }else if(fitSc||prompter.classList.contains('rot')){
    fitSc=0;stage.classList.remove('fit');
    Object.assign(stage.style,{inset:'',left:'',top:'',width:'',height:''});
    prompter.classList.remove('rot');prompter.style.width='';prompter.style.height='';
  }
  stageXf();
}
const scrOri=()=>window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.ScreenOrientation;
let rcFlip=false;   /* ръчно завъртане при „Цял екран в мрежа“: устройството е в обратната на компютъра ориентация, а съдържанието се върти с CSS */
async function rcLockOrient(){
  let want=(pvDims.W||1280)>=(pvDims.H||720)?'landscape':'portrait';
  if(rcFlip)want=want==='landscape'?'portrait':'landscape';
  if(rcOrient===want)return;rcOrient=want;
  try{const so=scrOri();if(so&&so.lock){await so.lock({orientation:want});return}}catch(e){oops('rcLockOrient#1',e)}
  try{if(screen.orientation&&screen.orientation.lock)await screen.orientation.lock(want)}catch(e){oops('rcLockOrient#2',e)}
}
/* Android: основният прозорец е само в портрет; свободно се върти само четецът (цял екран на дистанционното следва ориентацията на компютъра, „Покажи на устройството“ се върти свободно) */
const oriCall=(m,a)=>{try{const so=scrOri();if(so&&so[m]){const r=so[m](a);if(r&&r.catch)r.catch(e=>{oops('oriCall#1',e)});return true}}catch(e){oops('oriCall#2',e)}return false};
const oriPortrait=()=>oriCall('lock',{orientation:'portrait'});
const oriFree=()=>oriCall('unlock');
/* телефон = по-късата страна под 600 px; таблетите също се държат като телефон, защото не са тествани */
const isPhone=()=>Math.min(screen.width||innerWidth,screen.height||innerHeight)<600;
const isDroidApp=()=>!IS_TAURI&&!VIEWER&&(document.body.classList.contains('isdroid')||(window.Capacitor&&window.Capacitor.getPlatform&&window.Capacitor.getPlatform()==='android'));
const baseIdle=()=>!reading&&!rvOn&&!rcFull;   /* основният прозорец: няма четец, цял екран и „Покажи на устройството“ */
let oriTimers=[];
/* връща основния прозорец в портрет: веднага и още няколко пъти, защото излизането от цял екран и промяната на размера могат да върнат хоризонталната ориентация след първото заключване */
function basePortrait(){
  oriTimers.forEach(clearTimeout);oriTimers=[];
  const go=()=>{if(baseIdle())oriPortrait()};
  go();
  [150,500,1200,2500].forEach(ms=>oriTimers.push(setTimeout(go,ms)));
}
function rcUnlockOrient(){
  rcOrient='';rcFlip=false;
  /* никога не викаме unlock(): в Android то означава „по сензора“ и основният прозорец остава хоризонтален */
  if(!oriPortrait()){try{if(screen.orientation&&screen.orientation.lock)screen.orientation.lock('portrait').catch(e=>{oops('rcUnlockOrient#1',e)})}catch(e){oops('rcUnlockOrient#2',e)}}
  oriTimers.forEach(clearTimeout);oriTimers=[];
  [150,500,1200,2500].forEach(ms=>oriTimers.push(setTimeout(()=>{if(baseIdle())oriPortrait()},ms)));
}
if(!VIEWER&&!IS_TAURI){oriPortrait();setTimeout(oriPortrait,800);setTimeout(oriPortrait,2500)}   /* приставката може да се зареди с малко закъснение */
/* пазач: щом основният прозорец се окаже хоризонтален на телефон, връщаме портрет */
function oriGuard(){if(isDroidApp()&&isPhone()&&baseIdle()&&innerWidth>innerHeight)basePortrait()}
window.addEventListener('resize',oriGuard);
window.addEventListener('orientationchange',()=>setTimeout(oriGuard,100));
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')oriGuard()});
/* бутон „Завърти“: превключва портрет/пейзаж на устройството (Android) */
async function rotToggle(){
  if(VIEWER)return;
  if(reading&&rmFollow){   /* цял екран в мрежа: размерът следва компютъра, затова се обръща ориентацията спрямо него, а не просто се заключва */
    rcFlip=!rcFlip;rcOrient='';
    await rcLockOrient();
    [150,400,900].forEach(ms=>setTimeout(rcRefit,ms));
    return;
  }
  const want=innerWidth>=innerHeight?'portrait':'landscape';
  try{const so=scrOri();if(so&&so.lock){await so.lock({orientation:want});return}}catch(e){oops('rotToggle#1',e)}
  try{if(screen.orientation&&screen.orientation.lock){await screen.orientation.lock(want);return}}catch(e){oops('rotToggle#2',e)}
  toast(t('Screen rotation is not supported on this device'),true);
}
window.addEventListener('message',e=>{if(!VIEWER&&e.data&&e.data.tpRot&&(rvOn||embBox))rotToggle()});   /* от вградения прозорец при „Покажи на устройството“ */
function rcRefit(){if(!(reading&&rmFollow))return;const f=maxPos?pos/maxPos:0;rcLockOrient();layout();pos=f*maxPos;draw(true)}
function setRcFull(on){
  on=!!on&&rcOn()&&remoteOn();
  if(on===rcFull)return;
  if(on){
    rcFlip=false;rcOrient='';
    rmFollow=true;startReading(true);
    if(!reading){rmFollow=false;return}
    rcFull=true;
    rcLockOrient();
  }else{
    rcFull=false;
    if(reading&&rmFollow){rmFollow=false;stopReading()}
    rmFollow=false;
  }
  setIcon($('#r2Full i'),rcFull?'min':'max');
  const tt=t(rcFull?'Exit full screen':'Network full screen');if($('#r2Full').title!==tt)$('#r2Full').title=tt;
}
const rcEff=()=>(rcv==='pv'&&!remoteOn())?'ed':rcv;   /* без отворен прозорец на компютъра няма превю и показваме редактора */
const rcOn=()=>!VIEWER&&(narrowMQ.matches||rcFull)&&(netOnFlag||remoteOn());   /* докато цял екран е отворен, режимът остава и когато устройството в хоризонтално положение е по-широк от 900 px */
/* докато прозорец за свързване е отворен, интерфейсът зад него не се прекроява (иначе се мести и премигва при всяка промяна на връзката);
   отложеното прекрояване се изпълнява веднага след затварянето му */
let rcDefer=false;
const netDlgOpen=()=>['startModal'].some(id=>{const e=document.getElementById(id);return !!e&&!e.hidden});
function applyRc(){
  if(netDlgOpen()){rcDefer=true;return}
  rcDefer=false;
  const on=rcOn(),live=on&&remoteOn(),b=document.body;
  {const fm=$('#fmt'),card=$('#edCard');   /* на малък екран с дистанционно тулбарът е част от панела „Редактор“ */
   if((on||!VIEWER)&&narrowMQ.matches){if(fm.parentNode!==card)card.insertBefore(fm,card.firstChild)}
   else if(fm.parentNode===card)$('#app').insertBefore(fm,$('.work'))}
  const nt=!on&&narrowMQ.matches&&!VIEWER;
  const changed=on!==rcWas||b.classList.contains('rcLive')!==live||nt!==ntWas;ntWas=nt;
  if(on!==rcWas){
    rcWas=on;
    if(on){rcv='pv';drawer(null)}
  }
  if(rcFull&&!(on&&live))setRcFull(false);
  if(live!==rcLiveWas){rcLiveWas=live;if(live)rcv='pv'}   /* прозорецът на компютъра се отвори: редакторът се затваря */
  b.classList.toggle('rc',on);b.classList.toggle('rcLive',live);b.classList.toggle('nt',nt);
  if(on)b.dataset.rcv=rcEff();else if(nt)b.dataset.rcv=ntv;else b.removeAttribute('data-rcv');
  if(changed){applyView();toolbarEnd()}
}
function toolbarEnd(){const tp=$('.top');if(tp)requestAnimationFrame(()=>{tp.scrollLeft=tp.scrollWidth})}
toolbarEnd();
function setNtv(v){ntv=(ntv===v&&v!=='ed')?'ed':v;applyRc();applyView()}   /* без дистанционно: табът само се избира, не се затваря */
function setRcv(v){rcv=(rcv===v)?'pv':v;applyRc();applyView()}   /* още едно натискане затваря панела */
$('#bCloseBm').addEventListener('click',()=>{if(rcOn()&&(rcv==='bm'||rcv==='sc'))setRcv(rcv)});
['startModal'].forEach(id=>{const e=document.getElementById(id);if(e)new MutationObserver(()=>{if(rcDefer&&!netDlgOpen())applyRc()}).observe(e,{attributes:true,attributeFilter:['hidden']})});
if(narrowMQ.addEventListener)narrowMQ.addEventListener('change',applyRc);
window.addEventListener('resize',applyRc);
applyRc();
/* системният бутон „назад“ (Android) затваря най-горния слой вместо приложението: цял екран, панел */
if(!IS_TAURI&&!VIEWER){
  let guard=false,skip=false;
  const topLayer=()=>{
    if(!$('#helpModal').hidden)return ()=>toggleHelp(false);
    if(settings.classList.contains('open'))return ()=>toggleSettings(false);
    if(rcFull)return ()=>setRcFull(false);
    if(embBox)return ()=>closePopup();
    if(rvOn)return ()=>NETC.stopRv(true);
    if(reading)return ()=>stopReading();
    if(document.body.classList.contains('drawer'))return ()=>drawer(null);
    if(rcOn()&&rcv!=='pv')return ()=>{rcv='pv';applyRc();applyView()};
    return null;
  };
  const syncNav=()=>{
    const open=!!topLayer();
    if(open&&!guard){try{history.pushState({tp:1},'')}catch(e){oops('syncNav#1',e)}guard=true}
    else if(!open&&guard){guard=false;skip=true;try{history.back()}catch(e){skip=false}}
  };
  window.addEventListener('popstate',()=>{
    if(skip){skip=false;return}
    guard=false;
    const f=topLayer();if(f)f();
    setTimeout(syncNav,30);
  });
  setInterval(syncNav,150);
  /* Android приложение: изричен слушател за бутона „назад“ (@capacitor/app). Той заменя стандартното поведение,
     затова сами затваряме най-горния слой, а приложението излиза само когато няма нищо отворено. */
  try{
    const CA=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.App;
    if(CA&&CA.addListener){
      CA.addListener('backButton',()=>{
        const f=topLayer();
        if(f){f();setTimeout(syncNav,30)}
        else if(CA.exitApp)CA.exitApp();
      });
    }
  }catch(e){oops('syncNav#2',e)}
}
applyView();
$('#rPlay').addEventListener('click',remotePlay);
$('#r2Play').addEventListener('click',remotePlay);
$('#r2Home').addEventListener('click',()=>post({type:'cmd',cmd:'home'}));
$('#r2SpdDn').addEventListener('click',()=>bump('speed',-5));
$('#r2SpdUp').addEventListener('click',()=>bump('speed',5));
$('#r2FsDn').addEventListener('click',()=>bump('fs',-1));
$('#r2FsUp').addEventListener('click',()=>bump('fs',1));
{
  /* прогрес: клик и влачене, както в панела при цял екран */
  /* лентата и превюто се местят веднага под пръста; към другия екран позицията отива плавно (със скорост), не на подскоци */
  const pr=$('#r2Prog');let dragging=false,lastF=0,sT=0;
  const prMv=moveSender((v,at)=>post({type:'cmd',cmd:'seek',arg:lastF,v,at}));
  const seekR=(e,fin)=>{
    if(e){const r=pr.getBoundingClientRect();const f=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));prMv.add(f-lastF);lastF=f}
    pvEase=false;pvBase={frac:lastF,fr:pvBase.fr,ts:Date.now()};pvDisp=lastF;predHold=performance.now()+600;pvKick();pvPaintBar();
    const now=performance.now();if(fin||now-sT>45){sT=now;prMv.send(fin)}
  };
  pr.addEventListener('pointerdown',e=>{dragging=true;prMv.reset();lastF=pvDisp;try{pr.setPointerCapture(e.pointerId)}catch(e){oops('seekR#1',e)}seekR(e)});
  pr.addEventListener('pointermove',e=>{if(dragging)seekR(e)});
  pr.addEventListener('pointerup',e=>{if(!dragging)return;dragging=false;seekR(e,true)});
  pr.addEventListener('pointercancel',()=>{if(!dragging)return;dragging=false;seekR(null,true)});
}
{
  /* същото поведение като във втория прозорец: клик по средата = старт/пауза; горен/долен ръб = забавя/ускорява при двоен клик */
  let tapT=0,tapZone=0,tapTimer=0;
  pv.style.cursor='pointer';
  /* колелото на мишката върху превюто скролва текста във втория прозорец със същата стъпка, както колелото директно в него */
  let wheelAcc=0,wheelRaf=0,wheelDirect=false;
  const sMv=moveSender((v,at)=>{const a=wheelAcc;wheelAcc=0;post({type:'cmd',cmd:'scroll',arg:a,v,at})});
  const queueScroll=(d,direct)=>{
    /* превюто се мести веднага (без да чака втория прозорец), а към него се праща само сумата за кадъра */
    wheelAcc+=d;if(direct){wheelDirect=true;sMv.add(d)}
    /* плъзгане с пръст: превюто следва пръста точно (без изглаждане, което изостава и „плува“) */
    if(direct&&pvMax>0){
      pvEase=false;
      const nf=Math.min(1,Math.max(0,pvDisp+d/pvMax));
      pvBase={frac:nf,fr:pvBase.fr,ts:Date.now()};predHold=performance.now()+600;
      pvDisp=nf;pvKick();
    }
    /* свързано с компютъра (устройството показва свой текст там): превюто се мести веднага, без да чака отговора на компютъра */
    else if(popupWin&&popupWin.net&&pvMax>0){
      const cur=Math.min(1,Math.max(0,pvBase.frac+pvBase.fr*Math.max(0,Date.now()-pvBase.ts)/1000));
      pvEase=false;pvBase={frac:Math.min(1,Math.max(0,cur+d/pvMax)),fr:pvBase.fr,ts:Date.now()};
      predHold=performance.now()+600;pvKick();
    }
    if(!wheelRaf)wheelRaf=requestAnimationFrame(()=>{wheelRaf=0;if(!wheelAcc){wheelDirect=false;return}
      if(wheelDirect){wheelDirect=false;sMv.send(false);return}   /* пръст: с текущата скорост, за да върви вторият прозорец плавно */
      const a=wheelAcc;wheelAcc=0;post({type:'cmd',cmd:'scroll',arg:a})});
  };
  pv.addEventListener('wheel',e=>{
    if(VIEWER||!popupOpen())return;
    e.preventDefault();
    if(pvFl){pvFl();pvFl=null}
    let d=e.deltaY;if(e.deltaMode===1)d*=40;else if(e.deltaMode===2)d*=600;
    queueScroll(d);
  },{passive:false});
  /* плъзгане с пръст или мишка върху превюто: текстът във втория прозорец следва пръста; кратко докосване остава за старт/пауза */
  let drag=null,skipClick=false,pvFl=null;const pvVel=velTrack();
  pv.style.touchAction='none';
  pv.addEventListener('pointerdown',e=>{
    if(VIEWER||!popupOpen()||(e.pointerType==='mouse'&&e.button!==0))return;
    const wasFl=!!pvFl;if(pvFl){pvFl();pvFl=null}   /* докосване по време на инерцията само я спира */
    pvVel.reset();
    drag={id:e.pointerId,y:e.clientY,moved:false,stopped:wasFl};
  });
  pv.addEventListener('pointermove',e=>{
    if(!drag||e.pointerId!==drag.id)return;
    const dy=e.clientY-drag.y;
    if(!drag.moved){if(Math.abs(dy)<6)return;drag.moved=true;try{pv.setPointerCapture(e.pointerId)}catch(e){oops('queueScroll#1',e)}}
    drag.y=e.clientY;
    const d=-dy/((pv.getBoundingClientRect().width/(pvDims.W||1))||1);
    pvVel.add(d);queueScroll(d,true);
  });
  const dragEnd=e=>{
    if(!drag||e.pointerId!==drag.id)return;
    if(drag.moved||drag.stopped){skipClick=true;setTimeout(()=>{skipClick=false},300)}
    if(drag.moved&&e.type==='pointerup'){
      const v=pvVel.v();
      if(Math.abs(v)>150)pvFl=flingRun(v,d=>{if(popupOpen())queueScroll(d,true)},()=>{pvFl=null});
    }
    pvVel.reset();drag=null;
  };
  pv.addEventListener('pointerup',dragEnd);pv.addEventListener('pointercancel',dragEnd);
  pv.addEventListener('click',e=>{
    if(skipClick){skipClick=false;return}
    const r=pv.getBoundingClientRect(),y=(e.clientY-r.top)/r.height;
    const zone=y<.18?-1:y>.82?1:0;
    if(!zone){clearTimeout(tapTimer);tapTimer=0;remotePlay();return}
    const now=performance.now();
    if(tapTimer&&tapZone===zone&&now-tapT<350){
      clearTimeout(tapTimer);tapTimer=0;
      bump('speed',(zone<0?(S.invert?1:-1):(S.invert?-1:1))*5);return;
    }
    tapZone=zone;tapT=now;clearTimeout(tapTimer);
    tapTimer=setTimeout(()=>{tapTimer=0;remotePlay()},350);
  });
}
$('#rSpdDn').addEventListener('click',()=>bump('speed',-5));
$('#rSpdUp').addEventListener('click',()=>bump('speed',5));
$('#rFsDn').addEventListener('click',()=>bump('fs',-1));
$('#rFsUp').addEventListener('click',()=>bump('fs',1));
$('#rProg').addEventListener('click',e=>{const r=e.currentTarget.getBoundingClientRect();post({type:'cmd',cmd:'seek',arg:(e.clientX-r.left)/r.width})});
$('#r2Close').addEventListener('click',closePopup);
$('#r2Full').addEventListener('click',()=>setRcFull(!rcFull));
$('#r2Rot').addEventListener('click',()=>post({type:'cmd',cmd:'rot'}));   /* към устройството, което показва текста */
$('#remote').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});
document.addEventListener('pointerdown',e=>{
  if(VIEWER)return;
  if(e.target.closest&&e.target.closest('#remote')){
    if(remoteOn()){const a=document.activeElement;if(a&&a!==document.body&&a.blur)a.blur();setRemoteActive(true)}
  }else setRemoteActive(false);
},true);

window.addEventListener('scroll',()=>{if(window.scrollX||window.scrollY)window.scrollTo(0,0)});
applyStyles();syncUI();applyLang();sizeSel.value=18;fontSel.value=S.font;syncTools();
if(VIEWER)initViewer();