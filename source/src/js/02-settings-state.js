/* ---------- Настройки ---------- */
const FONTS=[['Open Sans','sans-serif'],['Roboto','sans-serif'],['PT Sans','sans-serif'],['Manrope','sans-serif'],['Arial','sans-serif'],['Verdana','sans-serif'],['Tahoma','sans-serif'],['PT Serif','serif'],['Georgia','serif'],['Times New Roman','serif'],['Courier New','monospace']];
const DEF={speed:15,fs:64,lh:1.35,pgap:0.6,width:82,font:'Open Sans',color:'#ffffff',bg:'#000000',mirrorH:false,mirrorV:false,marker:false,markerY:42,markerH:140,markerColor:'#ffb547',noteColor:'#4dd6ff',dim:55,invert:false,clicker:true,progress:true,theme:'dark',accent:'',uiBg:'',lang:'en',spell:true,startMode:'ask',lfPoll:false,txtEnc:'windows-1251'};
/* .docx библиотеката се зарежда само при нужда: първо локално (vendor/), после от мрежата. Така не блокира стартирането. */
let mammothP=null;
function loadMammoth(){
  if(window.mammoth)return Promise.resolve(true);
  if(mammothP)return mammothP;
  const load=src=>new Promise(res=>{const el=document.createElement('script');el.src=src;el.onload=()=>res(!!window.mammoth);el.onerror=()=>{el.remove();res(false)};setTimeout(()=>res(!!window.mammoth),15000);document.head.appendChild(el)});
  mammothP=load('vendor/mammoth.browser.min.js').then(ok=>ok||load('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js')).then(ok=>{if(!ok)mammothP=null;return ok});
  return mammothP;
}
const hexRGB=h=>{h=(h||'#000').replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');const n=parseInt(h,16)||0;return[(n>>16)&255,(n>>8)&255,n&255]};
const okHex=h=>/^#[0-9a-f]{6}$/i.test(h||'');
const LIM={speed:[1,100],fs:[20,240],lh:[1,2.4],pgap:[0,1.5],width:[30,100],markerY:[10,90],markerH:[40,800],dim:[0,90]};
const PRESETS=[['#ffffff','#000000','Classic'],['#ffe66d','#000000','Yellow on black'],['#111111','#f4f0e4','Paper'],['#ffffff','#0b1b45','Night blue'],['#7dffb2','#04140c','Green'],['#ffd9a8','#1a1209','Warm']];
let S={...DEF};S.lang=/^bg/i.test(navigator.language||'')?'bg':'en';if(innerWidth<640){S.fs=40;S.width=92}
try{const j=JSON.parse(localStorage.getItem('tp.settings.v1')||'null');if(j&&typeof j==='object')for(const k in DEF)if(k in j&&typeof j[k]===typeof DEF[k])S[k]=j[k]}catch(e){oops('okHex#1',e)}
if(S.startMode==='net'||S.startMode==='remote')S.startMode='ask';   /* „Мрежа“ вече не е начин на стартиране: има свой раздел в Настройки */
if(S.theme!=='light'&&S.theme!=='dark')S.theme=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';
let chan=null;try{chan=new BroadcastChannel('tprompt')}catch(e){oops('okHex#2',e)}
let fromRemote=false;
const VIEWER=location.hash==='#view'||window.__TP_VIEWER===true;
const tauriInvoke=()=>(window.__TAURI__&&window.__TAURI__.core&&window.__TAURI__.core.invoke)||(window.__TAURI_INTERNALS__&&window.__TAURI_INTERNALS__.invoke)||null;
const IS_TAURI=!!tauriInvoke();
/* Роля в мрежата (независима от платформата): „домакин“ показва QR код, чете текста и се управлява от другото устройство;
   „клиент“ сканира QR код и управлява. По подразбиране: Windows = домакин, Android и браузър = клиент.
   Сменя се от Настройки → Връзка (запомня се в tp.role, без презареждане). */
let HOSTROLE=(()=>{let r=null;try{r=localStorage.getItem('tp.role')}catch(e){oops('HOSTROLE#1',e)}return r==='host'?true:r==='client'?false:IS_TAURI})();
