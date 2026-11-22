/* ---- Вид на устройството: компютър / телефон / таблет. Не зависи от ролята в мрежата (кой показва QR кода и кой го сканира):
   всяка от страните казва на другата какво е, а надписите използват този вид. Докато видът не е известен (по-стара версия
   отсреща или още няма отговор), се казва неутрално „устройството“, а не се гадае по ролята. ---- */
const MYKIND=(()=>{
  try{
    if(IS_TAURI)return 'pc';
    const ua=navigator.userAgent||'',cap=(window.Capacitor&&window.Capacitor.getPlatform)?window.Capacitor.getPlatform():'';
    const mac=/Macintosh/.test(ua)&&navigator.maxTouchPoints>1;   /* iPad с режим „сайт за компютър“ */
    const mob=/Android|iPhone|iPad|iPod/i.test(ua)||cap==='android'||cap==='ios'||mac;
    if(!mob)return 'pc';
    if(/iPad/i.test(ua)||mac)return 'tablet';
    if(/iPhone|iPod/i.test(ua))return 'phone';
    const sw=Math.min(screen.width||0,screen.height||0);
    if(!/Mobile/i.test(ua)||sw>=600)return 'tablet';   /* телефоните на Android имат „Mobile“ в името; таблетите – не */
    return 'phone';
  }catch(e){return 'dev'}
})();
let PEERKIND='';
const KIND_NAMES={
  bg:{pc:{def:'компютъра',nom:'Компютърът',own:'този компютър'},phone:{def:'телефона',nom:'Телефонът',own:'този телефон'},
      tablet:{def:'таблета',nom:'Таблетът',own:'този таблет'},dev:{def:'устройството',nom:'Устройството',own:'това устройство'}},
  en:{pc:{def:'the computer',nom:'The computer',own:'this computer'},phone:{def:'the phone',nom:'The phone',own:'this phone'},
      tablet:{def:'the tablet',nom:'The tablet',own:'this tablet'},dev:{def:'the device',nom:'The device',own:'this device'}}
};
const kindName=(k,f)=>{let en=false;try{en=S.lang==='en'}catch(e){oops('kindName#1',e)}const L=KIND_NAMES[en?'en':'bg'];return (L[k]||L.dev)[f]};
/* вградения прозорец на устройството (четене от компютъра) няма собствена връзка: питаме главната страница */
window.tpPeerKind=()=>PEERKIND;
const peerKind=()=>{if(PEERKIND)return PEERKIND;try{if(window.parent!==window&&window.parent.tpPeerKind)return window.parent.tpPeerKind()||''}catch(e){oops('peerKind#1',e)}return ''};
const peerN=f=>kindName(peerKind()||'dev',f);   /* другата страна: def = „компютъра“ (на/от/с …), nom = „Компютърът“ */
const ownN=f=>kindName(MYKIND,f);               /* тази страна: own = „този компютър“ */
function setPeerKind(k){
  k=(k==='pc'||k==='phone'||k==='tablet')?k:'dev';
  if(PEERKIND===k)return;
  PEERKIND=k;
  try{updateOpenLabel()}catch(e){oops('setPeerKind#1',e)}
}
const droidPlugin=()=>(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.TPServer)||null;
const canHost=()=>IS_TAURI||!!droidPlugin();   /* има ли това устройство сървър (Windows или Android приложение) */
let fitSc=0,rcOrient='';   /* цял екран на дистанционното: мащаб на екрана четец (0 = не е вписан) и заключена ориентация */
if(IS_TAURI)document.body.classList.add('tauri');
/* Windows: командите отиват към Rust (Tauri). Android: същите команди отиват към приставката TPServer (малък HTTP сървър), така че
   кодът на домакина е един и същ и на двете платформи. */
const tinvoke=(c,a)=>{
  if(IS_TAURI)return tauriInvoke()(c,a||{});
  const P=droidPlugin();
  if(!P||typeof P[c]!=='function')return Promise.reject(new Error('The connection server is not available in this version of the app.'));
  return P[c](a||{}).then(r=>c==='remote_sync'?((r&&r.v)||[]):r);
};
let netSend=null,txHook=null,rvOn=false;
/* „Покажи от компютъра“: устройството показва в същото вградено дистанционно текста и състоянието на компютъра; командите отиват към него */
let lsStateAt=0;
const post=m=>{
  m.id=Math.random().toString(36).slice(2)+Date.now().toString(36);
  let viaChan=false;
  try{if(chan){chan.postMessage(m);viaChan=true}}catch(e){oops('post#1',e)}
  /* localStorage е резервен път. Записът е синхронен и събуди всички прозорци със storage събитие,
     затова текущото състояние (4 пъти в секунда) минава по него най-много веднъж в секунда, и то само като резерва. */
  let viaLs=true;
  if(viaChan&&(m.type==='state'||m.type==='hb')){const n=performance.now();if(n-lsStateAt<1000)viaLs=false;else lsStateAt=n}
  if(viaLs&&m.type==='cmd'&&m.cmd==='scroll'&&popupWin&&popupWin.net)viaLs=false;   /* към компютъра няма локален втори прозорец: синхронният запис на всеки кадър само пречи */
  if(viaLs){try{localStorage.setItem('tp.msg',JSON.stringify(m))}catch(e){oops('post#2',e)}}
  if(netSend)netSend(m);
  if(txHook)txHook(m);
};
const saveS=()=>{try{localStorage.setItem('tp.settings.v1',JSON.stringify(S))}catch(e){oops('saveS#1',e)}if(!fromRemote)post({type:'settings',S:{...S}})};
function applyTheme(){
  const d=document.documentElement,r=d.style;
  d.setAttribute('data-theme',S.theme==='light'?'light':'dark');
  const L=h=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};const[a,b,c]=hexRGB(h);return .2126*f(a)+.7152*f(b)+.0722*f(c)};
  const mix=(a,b,p)=>{const B=hexRGB(b);return '#'+hexRGB(a).map((v,i)=>Math.round(v+(B[i]-v)*p).toString(16).padStart(2,'0')).join('')};
  ['--bg','--panel','--panel2','--line','--ink','--mute','--hover','--acc','--onacc','color-scheme'].forEach(v=>r.removeProperty(v));
  if(okHex(S.uiBg)){
    const bg=S.uiBg,dark=L(bg)<.35;
    r.setProperty('--bg',bg);
    r.setProperty('--panel',dark?mix(bg,'#ffffff',.06):mix(bg,'#ffffff',.6));
    r.setProperty('--panel2',dark?mix(bg,'#ffffff',.11):mix(bg,'#ffffff',.35));
    r.setProperty('--line',dark?mix(bg,'#ffffff',.2):mix(bg,'#000000',.12));
    r.setProperty('--hover',dark?mix(bg,'#ffffff',.16):mix(bg,'#000000',.07));
    r.setProperty('--ink',dark?'#ececf0':'#161a3a');
    r.setProperty('--mute',dark?'#9b9da7':'#5b629a');
    r.setProperty('color-scheme',dark?'dark':'light');
  }
  if(okHex(S.accent)){r.setProperty('--acc',S.accent);r.setProperty('--onacc',L(S.accent)>.5?'#101020':'#ffffff')}
}
applyTheme();
const clamp=(k,v)=>LIM[k]?Math.min(LIM[k][1],Math.max(LIM[k][0],v)):v;
const fontKind=n=>{const f=FONTS.find(x=>x[0]===n);if(f)return f[1];const l=n.toLowerCase();
  if(/mono|courier|consolas|menlo|lucida console|typewriter/.test(l))return 'monospace';
  if(/times|georgia|cambria|garamond|palatino|book|serif|minion|constantia|century|baskerville|didot|bodoni|caslon/.test(l)&&!/sans/.test(l))return 'serif';
  return 'sans-serif'};
/* шрифтът от документа, а ако го няма на устройството - вграденият Open Sans и общо семейство */
const fam=n=>{const k=fontKind(n);return FONTS.some(x=>x[0]===n)?`"${n}", ${k}`:`"${n}", "${k==='serif'?'PT Serif':'Open Sans'}", ${k}`};
