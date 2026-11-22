/* ----- компютър (Windows) ----- */
const HOST=(()=>{
  if(VIEWER||!canHost())return {enter(){},status(){},linked:()=>false,connected:()=>false,viewing:()=>false,showOnPhone(){},isOn:()=>false,stop:async()=>{},hooks(){}};   /* модулът се създава на всяко устройство със сървър, за да може ролята да се сменя без презареждане */
  let on=false,timer=0,ctTimer=0,rxTimer=0,busy=false,rxBusy=false,info=null,rx={rxAgo:null,webAgo:null};
  const trim=(s,n)=>{s=(s||'').trim();return s.length>n?s.slice(0,n-1)+'…':s};
  function state(){
    let mode='edit',pl=false,frac=0,time='',fr=0,W=pvDims.W||1280,H=pvDims.H||720;
    if(reading){
      mode='read';pl=playing;frac=maxPos?pos/maxPos:0;time=$('#hTime').textContent;
      fr=playing&&maxPos?pxps()/maxPos:0;W=innerWidth;H=innerHeight;
    }else if(remoteOn()){
      mode='win';pl=!!remoteSt.playing;frac=remoteSt.frac||0;time=remoteSt.time||'';
      fr=pl&&remoteSt.max?(remoteSt.rate||0)/remoteSt.max:0;W=remoteSt.W||W;H=remoteSt.H||H;
    }
    const bi=reading?curBm:(mode==='win'&&typeof remoteSt.bm==='number'?remoteSt.bm:-1);
    return {mode,playing:pl,frac:Math.round(frac*100000)/100000,fr:Math.round(fr*1e6)/1e6,time,speed:S.speed,fs:S.fs,
      bm:bmTitles.map(x=>trim(x,40)),bmIdx:bi,sc:SC.map(x=>trim(x.name,40)),scIdx:scIdx(liveId()),title:trim(docTitle().replace(/^~+\s*/,''),40),rev:ctRev,W,H,ts:Date.now()};   /* ts: момент на снимката, за да може устройството да върви плавно между отговорите */
  }
  /* текст и стил за уеб дистанционното: пращат се само при промяна */
  let ctRev=0,ctSig='',ctDirty=true;
  new MutationObserver(()=>{ctDirty=true}).observe(editor,{subtree:true,childList:true,characterData:true,attributes:true});
  const styleSig=()=>[S.fs,S.lh,S.pgap,S.width,S.color,S.bg,S.font,S.marker,S.markerY,S.markerH,S.markerColor,S.noteColor,S.dim].join('|');
  async function pushContent(){
    const sig=styleSig();
    if(!ctDirty&&sig===ctSig)return;
    ctDirty=false;ctSig=sig;const rev=++ctRev;
    const c={rev,html:previewHtml(),css:{fs:S.fs,lh:S.lh,pgap:S.pgap,dim:S.dim,width:S.width,color:S.color,bg:S.bg,font:fam(S.font),
      marker:!!S.marker,markerY:S.markerY,markerH:S.markerH,markerColor:S.markerColor,noteColor:S.noteColor}};
    try{await tinvoke('remote_set_content',{contentJson:JSON.stringify(c)})}catch(e){ctDirty=true}
  }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  function run(raw){
    let c;try{c=JSON.parse(raw)}catch(e){return}
    if(!c||typeof c.cmd!=='string')return;
    const n=Number(c.arg),win=!reading&&remoteOn(),pc=x=>post({type:'cmd',cmd:x}),hv=typeof c.v==='number'&&isFinite(c.v);
    switch(c.cmd){
      case 'start':if(!reading&&!win){if(hasSecond())openPopup();else startReading(false)}else if(win)remotePlay();break;
      case 'play':{
        /* с явна стойност командата е идемпотентна (устройството може да я повтори); без стойност сменя състоянието както преди */
        const has=typeof c.arg==='boolean';
        if(reading){if(!has||c.arg!==playing)togglePlay(true)}
        else if(win){if(!has||c.arg!==!!remoteSt.playing)remotePlay()}
        break;
      }
      case 'scroll':if(isFinite(n)&&(n||hv)){if(reading){if(hv)rdSet(false,n,c.v,c.at);else addScroll(n)}else if(win)post(hv?{type:'cmd',cmd:'scroll',arg:n,v:c.v,at:c.at}:{type:'cmd',cmd:'scroll',arg:n})}break;
      case 'page':if(isFinite(n)&&n){if(reading)addScroll(n*viewport.clientHeight*.8);else if(win)post({type:'cmd',cmd:'page',arg:n})}break;
      case 'end':if(reading){pos=maxPos;remain=0;draw(true)}else if(win)pc('end');break;
      case 'speed':if(isFinite(n))bump('speed',clamp(n,-10,10));break;
      case 'fs':if(isFinite(n))bump('fs',clamp(n,-8,8));break;
      case 'home':if(reading){pos=0;remain=0;draw(true)}else if(win)pc('home');break;
      case 'prev':if(reading)gotoPrevBm();else if(win)pc('prev');break;
      case 'next':if(reading)gotoBm(curBm+1);else if(win)pc('next');break;
      case 'bm':{const i=Math.floor(n);if(isFinite(i)&&i>=0&&i<bmTitles.length){if(reading)gotoBm(i);else if(win)remoteBm(i);else startReading(false,i)}break}
      case 'seek':if(isFinite(n)){const f=clamp(n,0,1);if(reading){if(hv)rdSet(true,f*maxPos,c.v*maxPos,c.at);else{rd=null;pos=f*maxPos;remain=0;draw(true)}}else if(win)post(hv?{type:'cmd',cmd:'seek',arg:f,v:c.v,at:c.at}:{type:'cmd',cmd:'seek',arg:f})}break;
      case 'stop':if(reading)stopReading();else if(win)closePopup();break;
      case 'script':{const i=Math.floor(n);if(isFinite(i)&&i>=0&&i<SC.length)scShow(i).then(()=>{ctDirty=true}).catch(e=>{oops('run#1',e)})}break;   /* устройството избира текст */
    }
  }
  async function pump(){
    if(busy)return;busy=true;
    try{const cmds=await tinvoke('remote_sync',{stateJson:JSON.stringify(state())});(cmds||[]).forEach(run)}catch(e){oops('pump#1',e)}
    busy=false;
  }
  /* съобщения от приложението на устройството -> втория прозорец */
  /* устройството чете (цял екран), компютърът управлява: компютърът се държи, все едно има втори прозорец */
  let netView=false,netViewT=0,netViewClosed=-1e9;
  const hide=['lang','theme','accent','uiBg'];
  function txOut(m){
    if(!netView||!(m.type==='content'||m.type==='settings'||m.type==='cmd'))return;
    const c=Object.assign({},m);delete c.id;
    if(c.S){c.S=Object.assign({},c.S);hide.forEach(k=>delete c.S[k])}
    tinvoke('tx_push',{msgJson:JSON.stringify(c)}).catch(e=>{oops('txOut#1',e)});
    if(m.type==='cmd'&&m.cmd==='close'){netView=false;document.body.classList.remove('devView');netViewClosed=performance.now()}
  }
  function fromPhoneViewer(x){
    if(!x||typeof x!=='object'||typeof x.type!=='string')return;
    delete x.id;
    if(x.type==='bye'){netView=false;document.body.classList.remove('devView');onMsg(x);return}
    /* след „затвори“ устройството още малко праща сигнали: не ги приемаме за ново начало, иначе се губи командата за затваряне */
    if(!netView&&performance.now()-netViewClosed<4000)return;
    if(!netView){
      document.body.classList.add('devView');
      if(popupWin&&!popupWin.closed)closePopup();   /* четене на устройството и във втори прозорец едновременно не се поддържа */
      netView=true;txHook=txOut;tinvoke('tx_clear').catch(e=>{oops('fromPhoneViewer#1',e)});
      netCtl=false;lastNet=null;   /* устройството чете: отговаряме с текста на компютъра, не със стар текст от устройството */
    }
    netViewT=performance.now();
    if(x.type==='hb')return;
    onMsg(x);
  }
  let sessionEndedAt=-1e9;
  function clearSession(){
    sessionEndedAt=performance.now();
    netView=false;netViewT=0;netViewClosed=sessionEndedAt;document.body.classList.remove('devView');
    netCtl=false;lastNet=null;
    try{if(popupWin&&!popupWin.closed)closePopup()}catch(e){oops('clearSession#1',e)}
    try{tinvoke('tx_clear').catch(e=>{oops('clearSession#2',e)})}catch(e){oops('clearSession#3',e)}
    onMsg({type:'bye'});
    PEERKIND='';setPeerKind('dev');
    status();
  }
  async function disconnectPeer(){
    if(!on)return;
    try{
      await tinvoke('tx_clear');
      await tinvoke('tx_push',{msgJson:JSON.stringify({type:'session_disconnect'})});
    }catch(e){oops('disconnectPeer#1',e)}
    clearSession();
    toast(t('Disconnected.'));
  }
  function relay(m){
    if(!m||typeof m!=='object')return;
    if(m.type==='session_disconnect'){clearSession();return}
    if(m.type==='peer'){sessionEndedAt=-1e9;setPeerKind(m.kind);XF.via.pc({type:'peer',kind:MYKIND}).catch(e=>{oops('relay#1',e)});return}   /* устройството казва какво е; отговаряме какво сме ние */
    if(m.type==='xfer'){xfIn(m);return}
    if(m.type==='vmsg'){fromPhoneViewer(m.m);return}
    if(performance.now()<takeUntil&&(m.type==='content'||m.type==='settings'||(m.type==='cmd'&&m.cmd!=='close')))return;   /* закъснели съобщения след „Край“ */
    if(m.type==='content'&&typeof m.html==='string'){
      delete m.id;lastNet=m;netCtl=true;
      if(popupWin&&!popupWin.closed)post(Object.assign({},m));else openPopup();
    }else if(m.type==='settings'&&m.S&&typeof m.S==='object'){
      if(lastNet)lastNet.S=Object.assign({},lastNet.S,m.S);
      post({type:'settings',S:m.S});
    }else if(m.type==='cmd'&&typeof m.cmd==='string'){
      if(m.cmd==='close'){closePopup();netCtl=false;lastNet=null}   /* устройството затвори: старият му текст не се пази */
      else{const c={type:'cmd',cmd:m.cmd,arg:m.arg};if(typeof m.v==='number'){c.v=m.v;c.at=m.at}post(c)}
    }
  }
  async function rxPump(){
    if(rxBusy)return;rxBusy=true;
    try{
      const arg=netDirty?JSON.stringify({seq:netSeq,st:netSt}):'';
      netDirty=false;
      const r=await tinvoke('rx_pump',{rxState:arg});
      rx=r||rx;
      if(netView&&performance.now()-netViewT>12000){netView=false;document.body.classList.remove('devView');tinvoke('tx_clear').catch(e=>{oops('rxPump#1',e)})}
      (rx.msgs||[]).forEach(txt=>{let o;try{o=JSON.parse(txt)}catch(e){return}(Array.isArray(o)?o:[o]).forEach(relay)});
      status();
    }catch(e){oops('rxPump#2',e)}
    rxBusy=false;
  }
  const appAlive=()=>on&&performance.now()-sessionEndedAt>4000&&rx.rxAgo!=null&&rx.rxAgo<4000;
  const webAlive=()=>on&&rx.webAgo!=null&&rx.webAgo<3000;
  let nsKey='';
  function status(){
    {const k=(on?1:0)+'|'+(appAlive()?1:0)+'|'+(webAlive()?1:0)+'|'+(info&&info.url||'');if(k!==nsKey){nsKey=k;try{renderNetworkSettings()}catch(e){oops('status#1',e)}}}
    try{xfBtnUi()}catch(e){oops('status#2',e)}
    if(on&&info){const hu=$('#netHostUrl');if(hu&&hu.textContent!==info.url){hu.textContent=info.url;const hq=$('#netHostQr');if(hq)QR.draw(hq,info.url,4)}}
    $('#bRemote').classList.toggle('link',appAlive()||webAlive());
    if(PEERKIND&&PEERKIND!=='dev'&&!appAlive()&&(rx.rxAgo==null||rx.rxAgo>20000))setPeerKind('dev');   /* връзката е прекъсната отдавна: видът на предишното устройство вече не важи */
  }
  function show(){
    try{renderNetworkSettings()}catch(e){oops('show#1',e)}
    if(!(on&&info))return;
    {const hu=$('#netHostUrl');if(hu&&hu.textContent!==info.url){hu.textContent=info.url;const hq=$('#netHostQr');if(hq)QR.draw(hq,info.url,4)}}
    status();
  }
  /* Android: докато чака връзка, екранът остава светнат (иначе системата спира страницата и сървърът престава да отговаря) */
  let hostWl=null;
  async function hostAwake(v){
    if(IS_TAURI)return;
    try{
      if(v){if('wakeLock' in navigator&&!hostWl){hostWl=await navigator.wakeLock.request('screen');hostWl.addEventListener('release',()=>{hostWl=null})}}
      else if(hostWl){const w=hostWl;hostWl=null;await w.release()}
    }catch(e){oops('hostAwake#1',e)}
  }
  document.addEventListener('visibilitychange',()=>{if(on&&document.visibilityState==='visible')hostAwake(true)});
  async function setOn(v){
    try{
      if(v){
        let tk0=null;try{tk0=localStorage.getItem('tp.tok')}catch(e){oops('setOn#1',e)}
        info=await tinvoke('remote_start',{token:tk0});on=true;ctDirty=true;
        try{localStorage.setItem('tp.tok',info.token)}catch(e){oops('setOn#2',e)}
        clearInterval(timer);clearInterval(ctTimer);clearInterval(rxTimer);
        if(/\/\/127\./.test(info.url||''))toast(t('No Wi‑Fi network. Turn on Wi‑Fi or a hotspot.'),true);
        const k=IS_TAURI?1:2;   /* през моста на Android всяко запитване е по-скъпо */
        hostAwake(true);
        timer=setInterval(pump,50*k);ctTimer=setInterval(pushContent,400);rxTimer=setInterval(rxPump,40*k);   /* често: плъзгането от устройството пристига на по-малки и равни порции */pushContent();
      }else{
        await tinvoke('remote_stop');on=false;info=null;rx={rxAgo:null,webAgo:null};
        clearInterval(timer);clearInterval(ctTimer);clearInterval(rxTimer);hostAwake(false);
      }
      try{localStorage.setItem('tp.phone',on?'1':'0')}catch(e){oops('setOn#3',e)}
    }catch(e){toast(String(e),true);on=false;info=null;clearInterval(timer);clearInterval(ctTimer);clearInterval(rxTimer)}
    show();status();
  }
  $('#rmShow').addEventListener('click',()=>{openRemote(false);remoteGo()});   /* в двете роли: показва текста на това устройство на свързаното */
  /* към устройството: по опашката, която то чете; старите заявки не се пазят, за да не се изпълнят по-късно */
  XF.via.pc=async m=>{try{if(!netView&&(m.op==='list'||m.op==='get'||m.op==='apply'||m.op==='del'))await tinvoke('tx_clear');await tinvoke('tx_push',{msgJson:JSON.stringify(m)});return true}catch(e){return false}};
  const hooks=()=>{REMHOOK.can=()=>netCtl&&appAlive();REMHOOK.go=()=>xfEdit();REMHOOK.conn=()=>appAlive()};
  if(HOSTROLE)hooks();   /* „Редактор“, докато в прозореца се показва текст от устройството */
  /* „Нов код“: сменя токена, старият адрес става невалиден; Rust командата remote_new_token връща новия адрес */
  const nhNew=$('#netHostNew');if(nhNew)nhNew.addEventListener('click',async()=>{
    if(!on)return;
    try{
      info=await tinvoke('remote_new_token');
      try{localStorage.setItem('tp.tok',info.token)}catch(e){oops('hooks#1',e)}
      show();
      toast(t('QR code changed.'));
    }catch(e){toast(String(e),true)}
  });
  const nhCopy=$('#netHostCopy');if(nhCopy)nhCopy.addEventListener('click',()=>{if(info)navigator.clipboard.writeText(info.url).then(()=>toast(t('Address copied.'))).catch(()=>toast(t('Could not copy.'),true))});
  let was=null;try{was=localStorage.getItem('tp.phone')}catch(e){oops('hooks#2',e)}
  if(HOSTROLE&&was!=='0')setOn(true);   /* при първо стартиране (няма запис) Мониторът се включва сам; не се включва само ако потребителят изрично го е изключил */
  /* компютърът казва на приложението на устройството да започне да чете (устройството пита за това със своята заявка за състояние) */
  let wantT=0;
  function showOnPhone(){
    if(!appAlive())return;
    if(popupWin&&!popupWin.closed)closePopup();
    tinvoke('remote_want',{view:true}).catch(e=>{oops('showOnPhone#1',e)});
    toast(t('Sending to {d}…',{d:peerN('def')}));
    clearTimeout(wantT);
    wantT=setTimeout(()=>{if(!netView&&on)toast(t('{n} did not respond. Open TPrompt on {d} and try again.',{n:peerN('nom'),d:peerN('def')}),true)},7000);
    updateOpenLabel();
  }
  return {async enter(){if(!on)await setOn(true);else show()},status,state:()=>({on,info}),isOn:()=>on,linked:appAlive,connected:()=>appAlive()||webAlive(),viewing:()=>netView,showOnPhone,disconnect:disconnectPeer,stop:()=>setOn(false),hooks};
})();
