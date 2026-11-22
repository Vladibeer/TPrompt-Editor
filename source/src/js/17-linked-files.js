/* ---------- Файлове, свързани с локален или мрежов диск (Windows, Android) ----------
   „Отвори“ ползва системния прозорец за файлове с трайно разрешение. За .docx, .odt, .rtf и .txt се пази връзка:
   промените се записват обратно в същия файл, а при връщане в приложението се проверява дали файлът е променен отвън.
   Облачните услуги (Google Drive, OneDrive, Dropbox, pCloud и др.) НЕ се синхронизират: техните файлове се отварят само като копие. */
/* доставчик на файлове: Android - приставка FileSaver (системен прозорец), Windows - команди на Tauri (път до файла) */
var LFT={
  pick:async()=>(await tinvoke('lf_pick'))||{cancelled:true},
  read:o=>tinvoke('lf_read',{path:o.uri}),
  write:o=>tinvoke('lf_write',{path:o.uri,data:o.data,b64:!!o.b64}),   /* без b64 двоичните файлове (.docx, .odt, .rtf) се записват като base64 текст */
  stat:o=>tinvoke('lf_stat',{path:o.uri})
};
var LFP=()=>IS_TAURI?LFT:(window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.FileSaver);
/* облачни услуги (папки на компютъра и доставчици в Android) не се синхронизират; само локални и мрежови дискове */
const LF_CLOUD=/google\s?drive|my\s?drive|onedrive|skydrive|dropbox|pcloud|icloud|nextcloud|owncloud|\bmega\b|box\s?sync|apps\.docs|\.dropbox|\.pcloud/i;
function lfIsCloud(uri){let u=String(uri||'');try{u=decodeURIComponent(u)}catch(e){oops('lfIsCloud#1',e)}return LF_CLOUD.test(u)}
var LF={
  on(){const p=LFP();return !!(p&&p.pick&&p.write&&(IS_TAURI||document.body.classList.contains('isdroid'))&&!VIEWER)},
  hash(x){x=String(x==null?'':x);let h=5381;for(let i=0;i<x.length;i++)h=((h<<5)+h+x.charCodeAt(i))|0;return h+':'+x.length},
  file(b64,name,mime){const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return new File([u],name,{type:mime||''})},
  bytes(b64){const bin=atob(b64),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u},
  /* „суров“ вид на файла за сравнение: текст за .txt, base64 за двоичните формати */
  raw(b64,fmt){return fmt==='txt'?decodeText(LF.bytes(b64).buffer):b64},
  async rawOf(f,fmt){const buf=await f.arrayBuffer();return fmt==='txt'?decodeText(buf):bytesToB64(new Uint8Array(buf))},
  fmt(n){const e=(String(n).split('.').pop()||'').toLowerCase();return (e==='docx'||e==='odt'||e==='rtf'||e==='txt')?e:null}
};
var lfPend={},lfT=0,lfBusy=false;
/* един файл = един свързан текст. Два текста, свързани със същия файл, си пречат: единият записва,
   а другият остава с остарели данни и после или презаписва файла, или не вижда промените отвън. */
function lfKey(uri){let u=String(uri||'');try{u=decodeURIComponent(u)}catch(e){oops('lfKey#1',e)}if(IS_TAURI)u=u.replace(/\//g,'\\').toLowerCase();return u}
function lfFind(uri,exceptId){const k=lfKey(uri);return SC.find(x=>x.link&&x.id!==exceptId&&lfKey(x.link.uri)===k)||null}
/* стари записи с повече от един текст за същия файл: връзката остава само за един (отвореният в редактора или последно синхронизираният), другите стават обикновени копия */
function lfDedupe(){
  const g={},kept=[],cl=[];
  for(const s of SC)if(s.link&&lfIsCloud(s.link.uri)){cl.push(s.name);delete s.link;delete lfPend[s.id]}   /* стари връзки към облак се прекъсват: текстът остава като копие */
  if(cl.length){scPersist();try{renderScripts()}catch(e){oops('lfDedupe#1',e)}setTimeout(()=>toast(t('Cloud services are not synchronized. The link was removed for: {n}. The texts stay as copies.',{n:cl.join(', ')})),1500)}
  for(const s of SC)if(s.link){const k=lfKey(s.link.uri);(g[k]=g[k]||[]).push(s)}
  for(const k in g){
    const a=g[k];if(a.length<2)continue;
    const keep=a.find(x=>x.id===scActive)||a.reduce((m,x)=>((+x.link.mt||0)>(+m.link.mt||0)?x:m));
    for(const s of a)if(s!==keep){delete s.link;delete lfPend[s.id]}
    keep.link.mt=0;   /* при следващата проверка файлът се прочита наново и текстът се обновява, ако е различен */
    kept.push(keep);
  }
  if(kept.length){
    scPersist();try{renderScripts()}catch(e){oops('lfDedupe#2',e)}
    setTimeout(()=>{for(const s of kept)toast(t('The file “{n}” was linked to several texts. Only “{s}” stays linked; the others are now plain copies.',{n:s.link?s.link.name:'',s:s.name}))},1500);
  }
  return kept.length;
}
try{if(!VIEWER)lfDedupe()}catch(e){oops('lfDedupe#3',e)}
/* какво се записва във файла: {d: данни, b64: данните са base64 на двоичен файл} */
async function lfSerialize(fmt){
  if(fmt==='docx')return{d:await buildDocx(),b64:true};
  if(fmt==='odt')return{d:await buildOdt(),b64:true};
  if(fmt==='rtf')return{d:bytesToB64(new TextEncoder().encode(await buildRtf())),b64:true};
  return{d:edText('\n\n').replace(/\n{3,}/g,'\n\n'),b64:false};
}
async function lfParse(raw,fmt){
  if(fmt==='txt')return textToHtml(raw);
  const u=LF.bytes(raw);
  if(fmt==='docx')return sanitize(await docxToHtml(u.buffer),{noRescale:true});
  if(fmt==='odt')return sanitize(await odtToHtml(u.buffer),{noRescale:true});
  return sanitize(rtfToHtml(new TextDecoder('latin1').decode(u)),{noRescale:true});
}
function openDialog(){if(LF.on())lfOpen();else $('#file').click()}
async function lfOpen(){
  let r;
  try{r=await LFP().pick()}catch(e){toast(String((e&&e.message)||e),true);return}
  if(!r||r.cancelled)return;
  const f=LF.file(r.data,r.name||'file',r.mime),fmt=LF.fmt(f.name);
  if(r.uri&&lfIsCloud(r.uri)){   /* Google Drive, OneDrive и др.: само копие, без синхронизация */
    await openFile(f,null);
    toast(t('The file is from a cloud service and was opened as a copy, without synchronization. Synchronization works only for files on a local or network drive.'),true);
    return;
  }
  const ex=r.uri?lfFind(r.uri):null;
  if(ex){   /* файлът вече е свързан с текст: не се прави втори свързан текст */
    const v=await dlg({title:t('File already open'),icon:'link',text:t('The file “{n}” is already linked to the text “{s}”. A file can be linked to only one text, otherwise syncing gets mixed up.',{n:r.name||f.name,s:ex.name}),ok:t('Go to that text'),alt:t('Open as a copy')});
    if(v===false||v===null)return;
    if(v!==true){await openFile(f,null);return}
    const i=scIdx(ex.id);if(i<0)return;
    if(ex.id!==scActive&&await scLoad(i,remoteOn())===false)return;
    showEditor();
    await lfCheck({ids:[ex.id],force:true});   /* веднага се взема последната версия от файла */
    return;
  }
  let linkIt=!!(fmt&&r.writable);
  if(linkIt&&fmt!=='txt'){   /* записът обратно презаписва оригинала и губи това, което редакторът не знае */
    const v=await dlg({title:t('Synchronize'),icon:'link',text:t('If you link the file (local or network drive), changes are saved back into it. Pictures and formatting the editor does not support (tables, headers, notes) are lost on the first save. Open the file as a copy if you do not want that.'),ok:t('Synchronize'),alt:t('Open as a copy')});
    if(v===false||v===null)return;
    linkIt=v===true;
  }
  await openFile(f,linkIt?{uri:r.uri,name:r.name||f.name,fmt,mt:r.mt||0}:null);
  if(fmt&&!r.writable)toast(t('The file is open read-only: changes will not be written to it.'));
}
/* записва се само когато съдържанието наистина се е променило спрямо последния запис/четене */
let lfT0=0,lfSeq=0;
async function lfSyncNow(){
  if(VIEWER||!scActive||!LF.on())return;
  const s=SC[scIdx(scActive)];if(!s||!s.link)return;
  const id=s.id,seq=++lfSeq,ser=await lfSerialize(s.link.fmt),h=LF.hash(ser.d);
  if(seq!==lfSeq)return;   /* междувременно има нова промяна */
  const s2=SC.find(x=>x.id===id);if(!s2||!s2.link)return;
  if(h===s2.link.wh){delete lfPend[id];return}
  lfPend[id]={d:ser.d,b64:ser.b64,h};clearTimeout(lfT);lfT=setTimeout(lfFlush,IS_TAURI?500:1500);   /* на компютъра прозорецът може да се затвори веднага */
}
function lfSync(){
  if(VIEWER||!scActive||!LF.on())return;
  const s=SC[scIdx(scActive)];if(!s||!s.link)return;
  clearTimeout(lfT0);lfT0=setTimeout(lfSyncNow,s.link.fmt==='txt'?0:250);   /* двоичните формати се сглобяват след кратка пауза */
}
async function lfFlush(force){
  clearTimeout(lfT);
  if(lfBusy&&!force)return;   /* тече проверка или диалог за конфликт: нищо не се презаписва, докато не е решено */
  let again=false;
  for(const id of Object.keys(lfPend)){
    const s=SC.find(x=>x.id===id),p=lfPend[id];
    if(!s||!s.link){delete lfPend[id];continue}
    try{
      if(!force){   /* файлът е променен отвън, откакто го знаем: първо се решава конфликтът */
        const st=await LFP().stat({uri:s.link.uri});
        if(st&&(!st.mt||st.mt!==s.link.mt)){const rd=await LFP().read({uri:s.link.uri});if(LF.hash(LF.raw(rd.data,s.link.fmt))!==s.link.rh){again=true;continue}}
      }
      const r=await LFP().write({uri:s.link.uri,data:p.d,b64:!!p.b64});
      s.link.mt=+(r&&r.mt)||0;s.link.rh=p.h;s.link.wh=p.h;   /* без час от системата: следващата проверка сравнява съдържанието */
      if(lfPend[id]===p)delete lfPend[id];
      scPersist();
    }catch(e){toast(t('Could not write to the file: {e}',{e:String((e&&e.message)||e)}),true);delete lfPend[id]}   /* следващата промяна опитва отново */
  }
  if(again)lfCheck();
}
/* o.ids: проверяват се само тези текстове (автоматичната проверка); тя работи и по време на четене */
let lfWarned={};
async function lfCheck(o){
  o=o||{};
  if(lfBusy||!LF.on()||(reading&&!o.ids))return;
  lfBusy=true;
  try{
    for(const s of SC.slice()){
      if(!s.link||(o.ids&&!o.ids.includes(s.id)))continue;
      let st;try{st=await LFP().stat({uri:s.link.uri})}catch(e){continue}
      if(!st)continue;
      if(!o.force&&st.mt&&st.mt===s.link.mt)continue;   /* всяка промяна на часа (и назад) или липсващ час: файлът се прочита и се сравнява съдържанието */
      let rd;try{rd=await LFP().read({uri:s.link.uri})}catch(e){continue}
      const raw=LF.raw(rd.data,s.link.fmt);
      if(LF.hash(raw)===s.link.rh){s.link.mt=rd.mt||st.mt;scPersist();continue}   /* само нов час на промяна, същото съдържание */
      const active=s.id===scActive;
      if(active)scFlush();
      const pend=lfPend[s.id]||(active&&s.link.wh!==LF.hash((await lfSerialize(s.link.fmt)).d));
      if(pend){
        if(reading){   /* по време на четене не се показват въпроси: решава се след спиране */
          if(lfWarned[s.id]!==st.mt){lfWarned[s.id]=st.mt;toast(t('The file “{n}” was changed elsewhere. You will be asked what to keep when you stop reading.',{n:s.link.name}))}
          continue;
        }
        const v=await dlg({title:t('File changed elsewhere'),icon:'refresh',text:t('The file “{n}” was changed elsewhere, and it has unsaved changes here.',{n:s.link.name}),ok:t('Keep my version'),alt:t('Take the file’s version')});
        if(v===false||v===null)continue;   /* отказ: въпросът се задава отново следващия път */
        if(v===true){   /* моята версия презаписва файла */
          s.link.mt=rd.mt||st.mt;s.link.rh=LF.hash(raw);await lfSyncNow();await lfFlush(true);continue;
        }
        /* „Вземи от файла“: моята версия се пази като отделен текст, за да не се губи нищо */
        SC.push({id:scNewId(),name:scUniqueName(t('{n} (my version)',{n:s.name}).slice(0,60)),html:s.html});
        delete lfPend[s.id];
      }
      try{s.html=await lfParse(raw,s.link.fmt)}catch(e){toast(t('The file cannot be read: {e}',{e:String((e&&e.message)||e)}),true);continue}
      s.link.mt=rd.mt||st.mt;s.link.rh=LF.hash(raw);s.link.wh=null;
      scPersist();
      if(active){edSet(s.html);try{s.link.wh=LF.hash((await lfSerialize(s.link.fmt)).d)}catch(e){oops('lfCheck#1',e)}scPersist()}
      if(s.id===liveId()){   /* текстът, който се чете или показва, се обновява на същото място */
        if(reading&&active){const f=maxPos?pos/maxPos:0;buildPrompter();renderBm();layout();pos=f*maxPos;draw(true)}
        if(remoteOn()){post({type:'content',html:liveHtml()});if(pvRendered)renderPreview()}
      }
      renderBm();renderScripts();
      toast(t('Updated from file: {n}',{n:s.link.name}));
    }
  }finally{lfBusy=false}
}
document.addEventListener('visibilitychange',()=>{
  if(!LF.on())return;
  if(document.visibilityState==='hidden'){try{scFlush()}catch(e){oops('lfCheck#2',e)}lfSyncNow().then(()=>lfFlush(),()=>lfFlush())}   /* промените не се губят, когато приложението отиде на заден план */
  else lfCheck();
});
window.addEventListener('focus',()=>{if(LF.on())lfCheck()});
/* „Следи свързания файл“: на всеки 10 с, само ако текстът в редактора или текстът, който се показва, е свързан с файл
   и прозорецът се вижда. Иначе файлът не се докосва. */
const LF_POLL_MS=10000;let lfPollT=0;
function lfPollIds(){const ids=[];for(const id of [scActive,liveId()]){const s=id?SC[scIdx(id)]:null;if(s&&s.link&&!ids.includes(s.id))ids.push(s.id)}return ids}
function lfPoll(){
  clearTimeout(lfPollT);lfPollT=0;
  if(!S.lfPoll||!LF.on()||document.visibilityState!=='visible')return;   /* скрит прозорец: спира, тръгва отново при връщане */
  lfPollT=setTimeout(lfPoll,LF_POLL_MS);
  const ids=lfPollIds();if(ids.length)lfCheck({ids});
}
function lfPollSet(){
  const on=LF.on(),inp=$('#lfPollSec input');if(inp){inp.disabled=!on;inp.closest('.sw2').classList.toggle('off',!on)}
  if(S.lfPoll&&LF.on()&&document.visibilityState==='visible'){if(!lfPollT)lfPollT=setTimeout(lfPoll,LF_POLL_MS)}
  else{clearTimeout(lfPollT);lfPollT=0}
}
document.addEventListener('visibilitychange',lfPollSet);
try{lfPollSet()}catch(e){oops('lfPollSet#1',e)}setTimeout(lfPollSet,1500);   /* Windows: връщане към прозореца */
window.addEventListener('beforeunload',()=>{if(!LF.on())return;try{scFlush()}catch(e){oops('lfPollSet#2',e)}lfSyncNow().then(()=>lfFlush(),()=>lfFlush())});
setTimeout(async()=>{if(!LF.on())return;try{const a=SC[scIdx(scActive)];if(a&&a.link&&a.link.wh==null){a.link.wh=LF.hash((await lfSerialize(a.link.fmt)).d);scPersist()}}catch(e){oops('lfPollSet#3',e)}lfCheck()},1200);
function scUnlink(i){const s=SC[i];if(!s||!s.link)return;delete s.link;delete lfPend[s.id];scPersist();renderScripts();toast(t('Unlinked from file.'))}
$('#miOpen').addEventListener('click',()=>openDialog());
$('#file').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)openFile(f)});
{const ls=$('#langSel');if(ls)ls.addEventListener('change',()=>{S.lang=ls.value;saveS();applyLang()})}
function drawer(which){
  $('#bmRSide').classList.toggle('open',which==='bm');$('#bmSide').classList.toggle('open',which==='sc');
  document.body.classList.toggle('drawer',!!which);
  syncPanelBtns();
}
/* малък екран: бутоните Отметки, Редактор, Настройки избират кой панел е отворен */
function syncPanelBtns(){
  try{
    if(!matchMedia('(max-width:900px)').matches)return;
    const rc=rcOn(),e=rc?rcEff():(document.body.classList.contains('nt')?ntv:'ed');
    const on={sc:e==='sc',bm:e==='bm',set:e==='set',ed:e==='ed'};
    $$('[data-vt]').forEach(b=>{b.setAttribute('aria-pressed',String(on[b.dataset.vt]));b.disabled=false});
  }catch(e){oops('syncPanelBtns#1',e)}
}
$('#scrim').addEventListener('click',()=>drawer(null));
$('#bCloseBm').addEventListener('click',()=>drawer(null));
window.addEventListener('resize',()=>{if(innerWidth>900&&!reading)drawer(null)});
$('#themeSel').addEventListener('change',e=>set('theme',e.target.value));
$('#startSel').addEventListener('change',e=>{S.startMode=e.target.value;saveS();updateOpenLabel()});
$('#cAcc').addEventListener('input',e=>set('accent',e.target.value));
$('#cUiBg').addEventListener('input',e=>set('uiBg',e.target.value));
$('#uiReset').addEventListener('click',()=>{S.accent='';S.uiBg='';saveS();applyStyles();syncUI()});
const topBar=$('.top');
const setTbh=()=>document.documentElement.style.setProperty('--tbh',(topBar.offsetHeight||63)+'px');
/* Android/WebView при селекция може да превърти „скритите“ контейнери и лентата излиза от екрана – връщаме ги на мястото */
(function(){const sel='#app,.work,#edCard,.stagewrap,.top';
  addEventListener('scroll',e=>{const t=e.target;
    if(t===document||t===document.documentElement||t===document.body){if(scrollY||scrollX)scrollTo(0,0);return}
    if(t&&t.nodeType===1&&t.matches&&t.matches(sel)){if(t.scrollTop)t.scrollTop=0;if(t.scrollLeft&&!t.matches('.top'))t.scrollLeft=0}
  },true)})();
(function(){const vv=window.visualViewport,app=document.getElementById('app');if(!vv||!app)return;
  const fit=()=>{const y=Math.round(vv.offsetTop||0);app.style.transform=y>0?'translateY('+y+'px)':''};
  vv.addEventListener('scroll',fit);vv.addEventListener('resize',fit)})();
setTbh();window.addEventListener('resize',setTbh);if(window.ResizeObserver)new ResizeObserver(setTbh).observe(topBar);
let kbdLast=false;   /* последното действие е от клавиатурата: само тогава фокусът се връща на бутона след затваряне на прозорец */
addEventListener('keydown',()=>{kbdLast=true},true);addEventListener('pointerdown',()=>{kbdLast=false},true);
let helpFocus=null;
function toggleHelp(force){
  const m=$('#helpModal'),on=force!==undefined?force:m.hidden;
  if(on){helpFocus=document.activeElement;m.hidden=false;$('#helpBody').scrollTop=0;$('#helpClose').focus()}
  else{m.hidden=true;try{if(kbdLast&&helpFocus&&helpFocus.focus)helpFocus.focus()}catch(e){oops('toggleHelp#1',e)}}
}
$('#bHelp').addEventListener('click',()=>toggleHelp(true));
$('#helpClose').addEventListener('click',()=>toggleHelp(false));
$('#helpModal').addEventListener('mousedown',e=>{if(e.target===e.currentTarget)toggleHelp(false)});
/* Настройки: прозорец като „Помощ“; работи и докато се чете (цял екран, втори прозорец, Android) */
let setFocus=null;
function toggleSettings(force){
  const was=settings.classList.contains('open'),on=force!==undefined?!!force:!was;
  if(on===was)return;
  if(on){
    setFocus=reading?null:document.activeElement;
    try{closePal()}catch(e){oops('toggleSettings#1',e)}
    if(reading){if(bmPanel.classList.contains('open'))toggleBm(false);hudYield()}
    settings.classList.add('open');
    const b=$('#setBody');if(b)b.scrollTop=0;try{setTab(b.dataset.tab)}catch(e){oops('toggleSettings#2',e)}
    if(!reading){try{$('#bCloseSet').focus({preventScroll:true})}catch(e){oops('toggleSettings#3',e)}}   /* при четене фокусът не се отнема от клавишите за управление */
  }else{
    settings.classList.remove('open');
    try{if(kbdLast&&setFocus&&setFocus.focus&&document.contains(setFocus))setFocus.focus({preventScroll:true})}catch(e){oops('toggleSettings#4',e)}
    setFocus=null;
  }
  const hs=$('#hSet');if(hs)hs.setAttribute('aria-pressed',String(on));
  document.body.classList.toggle('setopen',on);
  if(reading){if(!on)hudRestore();showHud()}
}
/* категории в настройките: помни се последният избран раздел */
function setTab(k,save){
  const bd=$('#setBody');if(!bd)return;
  if(!$('#setTabs [data-tab="'+k+'"]'))k='read';
  const prev=bd.dataset.tab;
  if(prev&&prev!==k){
    const bs=$$('#setTabs [data-tab]').map(b=>b.dataset.tab),dir=bs.indexOf(k)>bs.indexOf(prev)?'tab-fwd':'tab-back';
    bd.classList.remove('tab-fwd','tab-back');void bd.offsetWidth;bd.classList.add(dir);
  }
  bd.dataset.tab=k;
  $$('#setTabs [data-tab]').forEach(b=>{const on=b.dataset.tab===k;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1});
  let first=true;
  bd.querySelectorAll(':scope>section').forEach(sc=>{
    const vis=!sc.hidden&&(sc.dataset.cat===k||sc.dataset.cat==='all');
    sc.classList.toggle('nb',vis&&first);if(vis)first=false;
  });
  bd.scrollTop=0;
  if(save){try{localStorage.setItem('tp.setTab',k)}catch(e){oops('setTab#1',e)}}
}
$$('#setTabs [data-tab]').forEach(b=>b.addEventListener('click',()=>setTab(b.dataset.tab,true)));
$('#setBody').addEventListener('animationend',e=>{if(e.target.parentNode===e.currentTarget)e.currentTarget.classList.remove('tab-fwd','tab-back')});
$('#setTabs').addEventListener('keydown',e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
  const bs=$$('#setTabs [data-tab]'),i=bs.findIndex(b=>b.getAttribute('aria-selected')==='true'),n=bs[(i+(e.key==='ArrowRight'?1:bs.length-1))%bs.length];
  e.preventDefault();setTab(n.dataset.tab,true);n.focus();
});
try{setTab(localStorage.getItem('tp.setTab')||'read')}catch(e){setTab('read')}
$('#bSet').addEventListener('click',()=>toggleSettings());
$('#bCloseSet').addEventListener('click',()=>toggleSettings(false));

function docTitle(){const x=(typeof SC!=='undefined')?SC[scIdx(scActive)]:null;if(x&&x.name){const n=x.name.replace(/[\\/:*?"<>|]+/g,'').trim().slice(0,40);if(n)return n}const l=(edText().trim().split('\n')[0]||'').replace(/[\\/:*?"<>|]+/g,'').trim().slice(0,40);return l||'tprompt'}
/* b64=true: data е base64 на двоичен файл (.docx) */
const saveMime=name=>name.endsWith('.html')?'text/html':name.endsWith('.json')?'application/json':name.endsWith('.rtf')?'application/rtf':name.endsWith('.docx')?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':name.endsWith('.odt')?'application/vnd.oasis.opendocument.text':'text/plain';
async function saveFile(name,data,b64){
  try{
    if(!b64&&window.claude&&window.claude.use){
      const d=await window.claude.use('downloads');
      if(d){await d.save({filename:name,data});toast(t('File saved: {n}',{n:name}));return}
    }
  }catch(err){if(err&&err.code==='declined')return}
  if(IS_TAURI){
    try{const r=await tinvoke('save_file',{name,data,b64:!!b64});if(r)toast(t('File saved: {n}',{n:name}))}
    catch(e){toast(t('Saving did not work in this window.')+' '+String(e),true)}
    return;
  }
  /* Android: WebView не сваля файлове през <a download>; ползва се системният прозорец „Запази като“ (приставка FileSaver) */
  if(document.body.classList.contains('isdroid')){
    const FS=window.Capacitor&&window.Capacitor.Plugins&&window.Capacitor.Plugins.FileSaver;
    if(!FS){toast(t('Saving is not available in this version of the app.'),true);return}
    try{
      const r=await FS.save({name,mime:saveMime(name),data,b64:!!b64});
      if(r&&!r.cancelled)toast(t('File saved: {n}',{n:name}));
    }catch(e){toast(t('Saving did not work in this window.')+' '+String((e&&e.message)||e),true)}
    return;
  }
  try{
    const blob=b64?new Blob([Uint8Array.from(atob(data),c=>c.charCodeAt(0))],{type:saveMime(name)}):new Blob([data],{type:saveMime(name)+';charset=utf-8'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;
    document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),2000);
    toast(t('File saved: {n}',{n:name}));
  }catch(e){toast(t('Saving did not work in this window.'),true)}
}