/* ----- устройство / таблет (Android приложение, браузър) ----- */
const NETC=(()=>{
  if(VIEWER)return {ui(){},stopScan(){},open(){},startRv(){},stopRv(){},fromViewer(){},scan(){},disc(){}};
  const NET={on:false,ok:false,live:false,base:'',tok:'',seq:-1,wseq:null,skew:0,q:[],sending:false,fails:0,busy:false,timer:0,resend:false,flushT:0,peerT:0};
  const SKIP=['lang','theme','accent','uiBg'];   /* интерфейсни настройки не се пращат към компютъра */
  const cleanS=S0=>{const o=Object.assign({},S0);SKIP.forEach(k=>delete o[k]);return o};
  function parseTarget(txt){
    txt=String(txt||'').trim();if(!txt)return null;
    if(!/^https?:\/\//i.test(txt))txt='http://'+txt;
    let u;try{u=new URL(txt)}catch(e){return null}
    const tk=u.searchParams.get('t');
    if(!tk||!/^[A-Za-z0-9_-]{6,64}$/.test(tk)||!u.hostname)return null;
    return {base:u.origin,tok:tk};
  }
  async function jreq(method,path,body,extra){
    const url=NET.base+path+'?t='+encodeURIComponent(NET.tok)+(extra||'');
    const opt={method,cache:'no-store'};
    if(body!==undefined){opt.body=body;opt.headers={'Content-Type':'text/plain;charset=UTF-8'}}
    const res=await Promise.race([fetch(url,opt),new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),4000))]);
    if(!res.ok){const e=new Error('http '+res.status);e.status=res.status;throw e}
    return res.json();
  }
  /* казваме на другата страна какво устройство сме (компютър/телефон/таблет); тя отговаря със своя вид по опашката, която четем */
  function sendPeer(){jreq('POST','/api/rx/send',JSON.stringify([{type:'peer',kind:MYKIND}])).catch(e=>{oops('sendPeer#1',e)})}
  /* опашка към компютъра: съобщенията се групират и се пращат наведнъж */
  function coalesce(list){
    const out=[];let lastC=-1,lastS=-1;const lastV=[-1,-1];
    list.forEach(m=>{
      if(m.type==='vmsg'&&m.m&&(m.m.type==='state'||m.m.type==='hb')){const k=m.m.type==='state'?0:1;if(lastV[k]>=0)out[lastV[k]]=null;lastV[k]=out.length}
      const pl=out.length?out[out.length-1]:null;
      if(m.type==='cmd'&&m.cmd==='scroll'&&pl&&pl.type==='cmd'&&pl.cmd==='scroll'&&('v' in m)===('v' in pl)){pl.arg=(Number(pl.arg)||0)+(Number(m.arg)||0);if('v' in m){pl.v=m.v;pl.at=m.at}return}
      if(m.type==='cmd'&&m.cmd==='seek'&&('v' in m)&&pl&&pl.type==='cmd'&&pl.cmd==='seek'&&('v' in pl)){out[out.length-1]=m;return}   /* при плъзгане важи само последната позиция */
      if(m.type==='content'){if(lastC>=0)out[lastC]=null;lastC=out.length}
      if(m.type==='settings'){if(lastS>=0){out[lastS].S=Object.assign({},out[lastS].S,m.S);return}lastS=out.length}
      out.push(m);
    });
    return out.filter(Boolean);
  }
  async function flush(){
    NET.flushT=0;
    if(NET.sending||!NET.q.length||!NET.on)return;
    NET.sending=true;
    const batch=coalesce(NET.q.splice(0));
    try{await jreq('POST','/api/rx/send',JSON.stringify(batch))}
    catch(e){NET.q=coalesce(batch.concat(NET.q)).slice(-60);NET.resend=NET.live}
    NET.sending=false;
    if(NET.q.length&&!NET.flushT)NET.flushT=setTimeout(flush,NET.ok?40:600);
  }
  netSend=m=>{
    if(!NET.on)return;
    if(m.type==='hello'||m.type==='state'||m.type==='bye')return;
    if(!NET.live&&!(m.type==='cmd'&&m.cmd==='close'))return;
    const c=Object.assign({},m);delete c.id;
    if(c.S)c.S=cleanS(c.S);
    if(typeof c.at==='number')c.at+=NET.skew;   /* моментът по часовника на компютъра */
    NET.q.push(c);
    if(!NET.flushT)NET.flushT=setTimeout(flush,30);
  };
  function sendContent(){post({type:'content',html:liveHtml(),S:{...S}})}
  function open(){
    if(!NET.on)return;
    NET.live=true;
    if(!popupWin||popupWin.closed)popupWin={closed:false,net:true,focus(){},close(){}};
    remoteClosedAt=-1e9;
    sendContent();
    toast(t('Sending to {d}…',{d:peerN('def')}));
    updateOpenLabel();applyRc();
  }
  netOpen=open;
  netStop=()=>{if(NET.live){netSend({type:'cmd',cmd:'close'});NET.live=false;popupWin=null;onMsg({type:'bye'});updateOpenLabel()}};
  async function poll(){
    if(NET.busy||!NET.on)return;NET.busy=true;
    const t0=Date.now();
    try{
      const r=await jreq('GET','/api/rx/state',undefined,'&tx=1');const t1=Date.now();
      NET.fails=0;
      if(!NET.ok){NET.ok=true;ui();sendPeer();if(NET.live&&NET.resend){NET.resend=false;sendContent()}}
      NET.skew=(r.now||t1)-(t0+t1)/2;
      let peerDisconnected=false;
      if(Array.isArray(r.tx))for(const m of r.tx){
        if(m&&m.type==='session_disconnect'){disconnect(false);peerDisconnected=true;break}
        if(m&&m.type==='peer')setPeerKind(m.kind);else if(m&&m.type==='xfer')xfIn(m);else if(RV.on)fromPc(m);
      }
      if(peerDisconnected||!NET.on){NET.busy=false;return}
      if(Date.now()-NET.peerT>(PEERKIND?30000:2500)){NET.peerT=Date.now();sendPeer()}   /* още не знаем какво е другото устройство: питаме пак (старите версии не отговарят, тогава остава „устройството“); иначе само опресняваме на 30 s */
      /* компютърът поиска четене на този екран (бутон „Покажи на устройството“). Първата стойност само се запомня, за да не се изпълни стара заявка. */
      if(typeof r.wseq==='number'){
        if(NET.wseq===null)NET.wseq=r.wseq;
        else if(r.wseq!==NET.wseq){NET.wseq=r.wseq;if(r.want==='view'&&!RV.on&&!rvOn){toast(t('{n} is showing the text on this screen.',{n:peerN('nom')}));startRv()}}
      }
      const s=r.st;
      if(s&&s.seq!==NET.seq&&!RV.on){
        NET.seq=s.seq;
        if(s.st){onMsg(Object.assign({},s.st,{type:'state',ts:(s.st.ts||r.now)-NET.skew}))}
        else{const was=NET.live;NET.live=false;popupWin=null;onMsg({type:'bye'});updateOpenLabel();if(was)toast(t('{n} took control back from {d}.',{n:peerN('nom'),d:ownN('own')}))}
      }
    }catch(e){
      if(e&&e.status===403){disconnect();toast(t('The code is no longer valid. Scan a new QR code.'),true)}
      else if(++NET.fails>=8&&NET.ok){NET.ok=false;NET.resend=NET.live;ui()}
    }
    NET.busy=false;
  }
  function disconnect(notifyPeer=true){
    if(notifyPeer&&NET.on){
      jreq('POST','/api/rx/send',JSON.stringify([{type:'session_disconnect'}])).catch(e=>{oops('disconnect#1',e)});
    }
    stopRv(false);
    clearInterval(NET.timer);NET.timer=0;
    NET.on=false;NET.ok=false;NET.live=false;NET.q=[];netOnFlag=false;
    if(popupWin&&popupWin.net)popupWin=null;
    onMsg({type:'bye'});
    if(!reading&&!rvOn)oriPortrait();
    if(NET.base&&NET.tok)netSavedAddr=NET.base+'/?t='+NET.tok;   /* адресът се пази: следващото свързване е с един клик */
    ui();
  }
  async function connect(tg,user){
    const old={base:NET.base,tok:NET.tok};
    NET.base=tg.base;NET.tok=tg.tok;
    try{await jreq('GET','/api/rx/state')}
    catch(e){
      NET.base=old.base;NET.tok=old.tok;
      if(user)toast(e&&e.status===403?t('Invalid code. Scan the QR code on the other device’s screen.'):t('Could not reach the other device. Check that both are on the same Wi‑Fi network and that Network is turned on.'),true);
      return false;
    }
    clearInterval(NET.timer);
    NET.on=true;NET.ok=true;NET.seq=-1;NET.wseq=null;NET.fails=0;NET.q=[];NET.live=false;netOnFlag=true;
    try{localStorage.setItem('tp.net',JSON.stringify({base:NET.base,tok:NET.tok}))}catch(e){oops('connect#1',e)}
    netSavedAddr=NET.base+'/?t='+NET.tok;const cliAddr=$('#netCliAddr');if(cliAddr)cliAddr.value=NET.base+'/?t='+NET.tok;   /* последният адрес остава в полето и след прекъсване */
    NET.timer=setInterval(poll,150);
    PEERKIND='';NET.peerT=Date.now();sendPeer();   /* ново свързване: старият вид не важи */
    ui();
    if(user)toast(t('Connected. Choose what to do.'))
    return true;
  }
  function ui(){
    $('#bRemote').classList.toggle('link',NET.on&&NET.ok);
    try{xfBtnUi()}catch(e){oops('ui#1',e)}
    if(NET.on)stopScan();
    updateOpenLabel();applyRc();
    const addr=$('#netCliAddr');
    const current=(NET.base&&NET.tok)?(NET.base+'/?t='+NET.tok):(netSavedAddr||'');
    if(addr&&current&&!addr.dataset.edited){addr.value=current;addr.dataset.initialized='1'}
    const state=$('#netCliSt');if(state){state.textContent=NET.on?(NET.ok?t('Connected'):t('Connection lost, retrying…')):t('Not connected');state.className='sub net-state '+(NET.on?(NET.ok?'ok':'warn'):'')}
    {/* „Свържи“ и „Прекъсни“ са отделни бутони; всеки е недостъпен, когато не може да се използва */const go=$('#netCliGo'),off=$('#netCliOff');if(go)go.disabled=!!(NET.on&&NET.ok);if(off)off.disabled=!NET.on;const nb=$('#netCliBody');if(nb)nb.classList.toggle('linked',!!NET.on)}
    const scan=$('#netCliScan');if(scan)scan.hidden=NET.on;
    renderNetworkSettings();
  }
  /* QR сканиране */
  let stream=null,scanTimer=0;
  function stopScan(){
    clearInterval(scanTimer);scanTimer=0;
    if(stream){stream.getTracks().forEach(x=>x.stop());stream=null}
    const ncCam=$('#netCliCam');if(ncCam)ncCam.hidden=true;
  }
  function loadJsQR(){
    return new Promise((res,rej)=>{
      if(window.jsQR)return res();
      const s0=document.createElement('script');s0.src='vendor/jsQR.js';s0.onload=()=>res();s0.onerror=()=>rej(new Error('jsQR'));document.head.appendChild(s0);
    });
  }
  async function startScan(videoSel='#netCliVideo',camSel='#netCliCam'){
    stopScan();
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){toast(t('The camera is not available here. Type the address instead.'),true);return}
    let det=null;
    try{if(window.BarcodeDetector)det=new BarcodeDetector({formats:['qr_code']})}catch(e){det=null}
    if(!det){try{await loadJsQR()}catch(e){oops('startScan#1',e)}}
    if(!det&&!window.jsQR){toast(t('No QR scanner available. Type the address instead.'),true);return}
    try{stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false})}
    catch(e){toast(t('No camera access. Allow it, or type the address instead.'),true);return}
    const v=$(videoSel),cam=$(camSel);v.srcObject=stream;cam.hidden=false;try{await v.play()}catch(e){oops('startScan#2',e)}
    const cv=document.createElement('canvas'),cx=cv.getContext('2d',{willReadFrequently:true});
    let busy=false;
    scanTimer=setInterval(async()=>{
      if(busy||!v.videoWidth)return;busy=true;
      try{
        let txt='';
        if(det){const r=await det.detect(v);if(r&&r[0])txt=r[0].rawValue}
        else{
          const w=Math.min(640,v.videoWidth),h=Math.round(w*v.videoHeight/v.videoWidth);
          cv.width=w;cv.height=h;cx.drawImage(v,0,0,w,h);
          const im=cx.getImageData(0,0,w,h),r=window.jsQR(im.data,w,h,{inversionAttempts:'dontInvert'});
          if(r)txt=r.data;
        }
        if(txt){const tg=parseTarget(txt);if(tg){stopScan();await connect(tg,true)}}
      }catch(e){oops('startScan#3',e)}
      busy=false;
    },220);
  }
  const ncScan=$('#netCliScan');if(ncScan)ncScan.addEventListener('click',()=>startScan('#netCliVideo','#netCliCam'));
  const ncCamClose=$('#netCliCamClose');if(ncCamClose)ncCamClose.addEventListener('click',()=>{stopScan();$('#netCliCam').hidden=true});
  const ncGo=$('#netCliGo');
  if(ncGo)ncGo.addEventListener('click',()=>{if(NET.on&&NET.ok)return;const val=($('#netCliAddr')&&$('#netCliAddr').value.trim())||'';const tg=parseTarget(val);if(!tg){toast(t('Address not recognised. Copy the whole address from the other device.'),true);return}netSavedAddr=val;stopScan();connect(tg,true)});
  const ncOff=$('#netCliOff');if(ncOff)ncOff.addEventListener('click',()=>{if(!NET.on)return;disconnect();toast(t('Disconnected.'))});
  const ncA=$('#netCliAddr');if(ncA)ncA.addEventListener('keydown',e=>{if(e.key==='Enter'&&ncGo)ncGo.click()});
  const ncCopy=$('#netCliCopy');if(ncCopy)ncCopy.addEventListener('click',()=>{const u=($('#netCliAddr')&&$('#netCliAddr').value.trim())||'';if(!u){toast(t('No address entered.'),true);return}navigator.clipboard.writeText(u).then(()=>toast(t('Address copied.'))).catch(()=>toast(t('Could not copy.'),true))});
  if(ncA)ncA.addEventListener('input',()=>{ncA.dataset.edited='1'});
  let saved=null;try{saved=JSON.parse(localStorage.getItem('tp.net')||'null')}catch(e){oops('startScan#4',e)}
  if(saved&&saved.base&&saved.tok){
    netSavedAddr=saved.base+'/?t='+saved.tok;
    if(!HOSTROLE)connect(saved,false);
  }
  ui();
  const roleSeg=$('#netRoleSeg');
  if(roleSeg)roleSeg.addEventListener('click',e=>{const tab=e.target.closest('[data-role-tab]');if(tab)setNetRoleTab(tab.dataset.roleTab)});
  if(roleSeg)roleSeg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();const next=currentNetRoleTab==='host'?'cli':'host';pickNetRole(next);$('#netTab'+(next==='host'?'Host':'Cli')).focus()}});
  const hostActivate=$('#netHostActivate');if(hostActivate)hostActivate.addEventListener('click',()=>switchRole('host','show'));
  const hostOff=$('#netHostOff');if(hostOff)hostOff.addEventListener('click',()=>hostApi().disconnect());
  /* ----- устройството чете на цял екран, а компютърът управлява ----- */
  const RV={on:false,bak:null,box:null,hb:0};
  function rvSend(m){
    if(!NET.on)return;
    NET.q.push({type:'vmsg',m});
    if(!NET.flushT)NET.flushT=setTimeout(flush,30);
  }
  function fromPc(m){
    if(!m||typeof m!=='object'||!m.type)return;
    if(m.type==='cmd'&&m.cmd==='close'){stopRv(true);return}
    if(m.type==='cmd'&&m.cmd==='rot'){rotToggle();return}   /* „Завърти“ от компютъра */
    if(typeof m.at==='number')m=Object.assign({},m,{at:m.at-NET.skew});   /* часовникът на компютъра -> часовника на устройството */
    post(m);   /* вграденият прозорец за четене получава същото, което получава вторият прозорец на компютъра */
  }
  function fromViewer(m){
    const c=Object.assign({},m);delete c.id;
    if(c.type==='bye'){stopRv(true);return}
    if(c.type==='state')c.ts=(c.ts||Date.now())+NET.skew;   /* часовникът на компютъра, не на устройството */
    if(c.S)c.S=cleanS(c.S);
    rvSend(c);
  }
  XF.via.phone=async m=>{
    if(!NET.on||!NET.ok){toast(t('Connect to the other device first.'),true);return false}
    try{await jreq('POST','/api/rx/send',JSON.stringify([m]));return true}catch(e){return false}
  };
  const hooks=()=>{REMHOOK.can=()=>false;REMHOOK.go=()=>{};REMHOOK.conn=()=>NET.on&&NET.ok;REMHOOK.stop=()=>{}};
  if(!HOSTROLE)hooks();   /* размяната на текстове с компютъра е достъпна, докато има връзка */
  function startRv(){
    if(RV.on)return;
    if(!NET.on||!NET.ok){toast(t('Connect to the other device first.'),true);openRemote(true);return}
    if(NET.live){netSend({type:'cmd',cmd:'close'});NET.live=false;popupWin=null;onMsg({type:'bye'});updateOpenLabel()}
    try{RV.bak=localStorage.getItem('tp.settings.v1')}catch(e){RV.bak=null}
    RV.on=true;rvOn=true;oriFree();
    const box=document.createElement('div');box.id='rvBox';
    const fr=document.createElement('iframe');
    fr.src=location.href.split('#')[0]+'#view';fr.title='TPrompt';fr.setAttribute('allowfullscreen','');
    box.appendChild(fr);document.body.appendChild(box);RV.box=box;
    clearInterval(RV.hb);RV.hb=setInterval(()=>rvSend({type:'hb'}),1000);
    rvSend({type:'hb'});
  }
  function stopRv(notify){
    if(!RV.on)return;
    RV.on=false;rvOn=false;clearInterval(RV.hb);
    if(RV.box){RV.box.remove();RV.box=null}
    try{if(RV.bak==null)localStorage.removeItem('tp.settings.v1');else localStorage.setItem('tp.settings.v1',RV.bak)}catch(e){oops('stopRv#1',e)}
    if(notify)rvSend({type:'bye'});
    oriPortrait();
    updateOpenLabel();applyRc();
  }
  return {ui,stopScan,open,connect,parseTarget,startRv,stopRv,fromViewer,hooks,scan:()=>startScan(),disc:()=>{disconnect();toast(t('Disconnected.'))},state:()=>NET};
})();
netApi=NETC;
})();
/* инициализацията свърши: показваме готовия интерфейс след първото пренареждане */
requestAnimationFrame(function(){requestAnimationFrame(function(){document.documentElement.classList.remove('boot');window.__tpReady=true})});