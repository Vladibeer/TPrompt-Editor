/* ---------- Редактор ---------- */

const SAMPLE_BG=`<h2 style="text-align:center">Добре дошли в TPrompt</h2>
<p style="text-align:center"><span style="color:#8fd6ff">Това е примерен текст за бърз старт. Прочетете го, за да видите как работи програмата, после го изтрийте и поставете свой сценарий.</span></p>
<p><b>~Бързо начало</b></p>
<p>Напишете или поставете текста си в редактора. Можете да отворите и файл: .docx, .odt, .rtf или .txt. Форматирането се запазва.</p>
<p>Натиснете <b>Пусни</b> и изберете <b>Цял екран</b>, или натиснете Ctrl+Enter. Space пуска и спира движението. Стрелките нагоре и надолу променят скоростта, а плюс и минус променят размера на буквите. Esc ви връща в редактора.</p>
<p><b>~Форматиране</b></p>
<p>Можете да <b>удебелявате</b>, да <span style="color:#ffe66d">оцветявате</span> и да <span style="font-size:36px">уголемявате</span> части от текста. Поставеният текст от Word, Google Docs или уеб страница запазва форматирането си.</p>
<p style="text-align:right">Подравняването вдясно е ето така.</p>
<p><b>~Отметки</b></p>
<p>Ред, който започва със знака ~, е отметка, както тази част. Списъкът с отметки се показва вляво с бутона Отметки най-горе. Докато четете, цифрите от 1 до 9 водят към отметка с този номер, а знаците по-голямо и по-малко към следващата и предишната отметка. Клавишът B показва списъка с отметки.</p>
<p><b>~Маркер и огледало</b></p>
<p>Маркерът подчертава реда за четене и затъмнява останалото. Включва се с клавиша M, а позицията и височината му се нагласят от Настройки. Ако ползвате стъклен телепромптър, включете огледалото: H обръща текста хоризонтално, а V вертикално.</p>
<p><b>~Библиотека</b></p>
<p>Всеки текст е отделен запис в „Библиотека“ вляво. Нов текст се добавя с бутона „Нов текст“. При четене N и P сменят текста със следващия и предишния. Всичко, което пишете, се запазва автоматично.</p>
<p><b>~Втори екран и мрежа</b></p>
<p>Пусни, после В прозорец отваря четенето на втори монитор. Бутонът Мрежа показва QR код. С него телефон или таблет в същата Wi-Fi мрежа може да показва или да управлява текста.</p>
<p><b>~Кликър</b></p>
<p>В Настройки включете Управление с кликър. Тогава бутоните на презентера пускат и спират текста и променят скоростта. Двойно натискане на бутона за старт сменя режима: скорост, отметки, текстове и размер.</p>
<p><b>~Помощ и копия</b></p>
<p>Натиснете F1 за пълната помощ с всички функции и клавишни комбинации. Правете копия на важните текстове с бутона „Експортирай“.</p>
<p><br></p><p style="text-align:center"><b>Край на примера.</b></p>`;
const SAMPLE_EN=`<h2 style="text-align:center">Welcome to TPrompt</h2>
<p style="text-align:center"><span style="color:#8fd6ff">This is a quick-start sample text. Read it to see how the program works, then delete it and paste your own script.</span></p>
<p><b>~Quick start</b></p>
<p>Type or paste your text in the editor. You can also open a file: .docx, .odt, .rtf or .txt. Formatting is kept.</p>
<p>Press <b>Start</b> and choose <b>Full screen</b>, or press Ctrl+Enter. Space plays and pauses. The up and down arrows change the speed, and plus and minus change the letter size. Esc takes you back to the editor.</p>
<p><b>~Formatting</b></p>
<p>You can make parts of the text <b>bold</b>, <span style="color:#ffe66d">colored</span> or <span style="font-size:36px">larger</span>. Text pasted from Word, Google Docs or a web page keeps its formatting.</p>
<p style="text-align:right">Right alignment looks like this.</p>
<p><b>~Bookmarks</b></p>
<p>A line that starts with the ~ sign is a bookmark, like this section. The list of bookmarks is shown on the left with the Bookmarks button at the very top. While reading, the digits 1 to 9 go to the bookmark with that number, and the greater-than and less-than signs go to the next and previous bookmark. The B key shows the list of bookmarks.</p>
<p><b>~Marker and mirror</b></p>
<p>The marker underlines the reading line and dims the rest. It is turned on with the M key, and its position and height are set in Settings. If you use a beam-splitter teleprompter, turn on the mirror: H flips the text horizontally and V flips it vertically.</p>
<p><b>~Library</b></p>
<p>Each text is a separate entry in the Library on the left. A new text is added with the New text button. While reading, N and P switch to the next and previous text. Everything you type is saved automatically.</p>
<p><b>~Second display and network</b></p>
<p>Start, then In a window opens the reading on a second monitor. The Network button shows a QR code. With it, a phone or tablet on the same Wi-Fi network can show or control the text.</p>
<p><b>~Clicker</b></p>
<p>In Settings turn on Presenter clicker control. Then the presenter buttons play and pause the text and change the speed. Double-pressing the start button changes the mode: speed, bookmarks, texts and size.</p>
<p><b>~Help and backups</b></p>
<p>Press F1 for the full help with all functions and keyboard shortcuts. Make copies of important texts with the Export button.</p>
<p><br></p><p style="text-align:center"><b>End of the sample.</b></p>`;
const sample=()=>S.lang==='en'?SAMPLE_EN:SAMPLE_BG;
/* текстът в редактора не се пази отделно: при стартиране идва от „Библиотека“ в голямото хранилище (виж scStoreReady).
   Копието от по-стари версии (tp.doc.v1) се прибира веднъж в списъка и се изтрива. */
let docTouched=false;
let legacyDoc=null;try{legacyDoc=localStorage.getItem('tp.doc.v1')}catch(e){oops('legacyDoc#1',e)}
edSet('');

let docT=0;
/* ----- редакторът е Tiptap/ProseMirror: документът е модел, а не DOM, затова няма стара API на браузъра ----- */
function edHtml(){return TPEd.html(tt)}
function edText(sep){return tt.getText({blockSeparator:sep===undefined?'\n':sep})}
function edClone(){const d=document.createElement('div');d.innerHTML=edHtml();return d}
function edSet(h){TPEd.setHtml(tt,h);TPEd.resetHistory(tt);try{histBtns()}catch(e){oops('edSet#1',e)}}
/* библиотека със текстове: списък от {id,name,html}; активният се записва автоматично при промяна */
const SC_KEY='tp.scripts.v1',SC_ACT='tp.scripts.active';
/* запис от паметта; връзката с файла (синхронизацията) се пази и след рестарт */
function scRec(x){
  const r={id:x.id,name:String(x.name||'').slice(0,60)||'—',html:x.html,auto:!!x.auto};
  const l=x.link;
  if(l&&typeof l.uri==='string'&&l.uri&&['docx','odt','rtf','txt'].includes(l.fmt))
    r.link={uri:l.uri,name:String(l.name||''),fmt:l.fmt,mt:+l.mt||0,rh:typeof l.rh==='string'?l.rh:null,wh:typeof l.wh==='string'?l.wh:null};
  return r;
}
/* голямо хранилище за текстовете (IndexedDB): побира много повече от localStorage, който е около 5 MB за всичко.
   Списъкът с текстове е там под ключ 'scripts'; в localStorage остават само малките настройки. */
const SC_IDB='tp.scripts.idb',SC_REV='tp.scripts.rev';
let txDbP=null;
function txDb(){
  if(!txDbP)txDbP=new Promise((res,rej)=>{
    if(typeof indexedDB==='undefined'){rej(new Error('IndexedDB missing'));return}
    let r;try{r=indexedDB.open('tprompt-texts',1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{r.result.createObjectStore('kv')};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
  return txDbP;
}
async function txGet(k){const db=await txDb();return new Promise((res,rej)=>{const q=db.transaction('kv','readonly').objectStore('kv').get(k);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
async function txPut(k,v){const db=await txDb();return new Promise((res,rej)=>{const tx=db.transaction('kv','readwrite');tx.objectStore('kv').put(v,k);tx.oncomplete=()=>res();tx.onerror=tx.onabort=()=>rej(tx.error||new Error('write failed'))})}
function scInIdb(){try{return localStorage.getItem(SC_IDB)==='1'}catch(e){return false}}
function scClean(j){return Array.isArray(j)?j.filter(x=>x&&typeof x.id==='string'&&typeof x.html==='string').map(scRec):[]}
let SC=[],scActive=null;
const scWasIdb=scInIdb();
try{
  if(!scWasIdb)SC=scClean(JSON.parse(localStorage.getItem(SC_KEY)||'[]'));   /* списък от по-стара версия: премества се в голямото хранилище */
  scActive=localStorage.getItem(SC_ACT)||null;
}catch(e){oops('scRec#1',e)}
if(!scWasIdb&&!SC.some(x=>x.id===scActive))scActive=null;
/* първо стартиране: примерният текст е в списъка и е отворен в редактора */
/* щом в редактора е примерният текст (няма запазен текст) и списъкът е празен, примерът влиза и в списъка – и когато браузърът не позволява запис (тогава само в паметта) */
{
  if(!legacyDoc&&!SC.length&&!VIEWER&&!scWasIdb){
    const demoId='s'+Date.now().toString(36)+'demo';
    SC.push({id:demoId,name:S.lang==='en'?'Welcome to TPrompt':'Добре дошли в TPrompt',html:sample(),auto:false});
    scActive=demoId;
    try{localStorage.setItem(SC_ACT,demoId)}catch(e){oops('scRec#3',e)}
  }
  docTouched=true;   /* редакторът никога не се подменя с примерния текст – съдържанието му идва от списъка */
  try{localStorage.setItem('tp.seeded','1')}catch(e){oops('scRec#4',e)}
}
/* scActive = текстът в редактора; scLive = текстът, който се чете/праща към дистанционното (може да е друг, докато се редактира) */
let scLive=scActive;
/* зареждане от голямото хранилище; при първо стартиране след обновяването текстовете се преместват там от localStorage.
   Ако голямото хранилище не работи, всичко остава в localStorage както досега. */
let scStoreOk=false,scStoreDone=false;
if(!VIEWER){try{tt.setEditable(false,false)}catch(e){oops('scStore#3',e)}}   /* докато голямото хранилище се отвори (част от секундата), в редактора не се пише */
const scStoreReady=(async()=>{
  try{
    const v=await txGet('scripts');
    if(Array.isArray(v)){
      SC=scClean(v);
    }else if(VIEWER)return;
    if(!VIEWER){
      /* текст от редактора на по-стара версия, който не е в списъка: влиза в списъка, за да не се изгуби */
      const ld=legacyDoc;
      if(ld&&ld.replace(/<[^>]*>/g,'').trim()&&!SC.some(x=>x.html===ld)){
        const cur=SC[scIdx(scActive)];
        /* никога не презаписва текст от списъка (копието може да е по-старо): ако се различава, влиза като отделен текст */
        const n={id:scNewId(),name:scUniqueName((scFirstLineOf(ld)||scDefaultName()).slice(0,56)),html:ld,auto:false};
        SC.push(n);if(!cur)scActive=n.id;
      }
      if(!SC.some(x=>x.id===scActive))scActive=null;
      await txPut('scripts',SC.map(scRec));
    }
    if(!SC.some(x=>x.id===scActive))scActive=null;
    if(scLive&&!SC.some(x=>x.id===scLive))scLive=scActive;
    scStoreOk=true;
    if(!VIEWER){
      try{localStorage.setItem(SC_IDB,'1');localStorage.removeItem(SC_KEY);localStorage.removeItem('tp.doc.v1')}catch(e){oops('scStore#2',e)}
      legacyDoc=null;
      const cur=SC[scIdx(scActive)];
      edSet(cur?cur.html||'':'');edToTop();docTouched=true;
      setActiveSc(scActive);
      if(!scLive)scLive=scActive;
      syncTools();updateFoot();
      if(remoteOn()&&liveSync()){post({type:'content',html:edHtml(),reset:true});if(pvRendered)renderPreview()}
    }
    renderScripts();renderBm();
  }catch(e){
    oops('scStore#1',e);
    if(!VIEWER){   /* без голямото хранилище текстовете не се записват: казваме го ясно; старите данни в малкото хранилище не се пипат */
      const cur=SC[scIdx(scActive)];
      edSet(cur?cur.html||'':(legacyDoc||''));docTouched=true;
      toast(t('Texts cannot be saved on this device.'),true);
    }
  }finally{
    scStoreDone=true;
    if(!VIEWER){try{tt.setEditable(true,false)}catch(e){oops('scStore#4',e)}}
  }
})();
function liveSync(){return !scLive||scActive===scLive}
function liveHtml(){if(liveSync())return edHtml();const x=SC[scIdx(scLive)];return x?x.html:edHtml()}
function liveId(){return scLive||scActive}
function onInput(){
  docTouched=true;
  clearTimeout(docT);docT=setTimeout(()=>{renderBm();if(remoteOn()&&liveSync()){post({type:'content',html:edHtml()});if(pvRendered)renderPreview()}scAutosave();saveSt='saved';paintSave()},400);
  saveSt='saving';paintSave();updateFoot();syncTools();
}
tt.on('update',onInput);
function liveName(){const x=SC[scIdx(liveId())];return x?x.name:''}
/* името над отметките: на показвания текст, а когато нищо не се показва (нито на цял екран, нито в прозорец или на устройство) – на текста в редактора */
function ownerInfo(){
  if(bmEd()){const x=SC[scIdx(scActive)];return {name:x?x.name:'',live:showingNow()}}
  return {name:liveName(),live:true};
}
let saveSt='saved';
function paintSave(){
  const f=$('#foot');if(!f)return;
  if(VIEWER||!scActive){f.innerHTML='';return}
  f.innerHTML='';
  const w=document.createElement('span');w.className='sv';
  if(saveSt==='saved'){const ic=document.createElement('i');ic.innerHTML=svg('check');w.appendChild(ic)}
  w.appendChild(document.createTextNode(saveSt==='saved'?t('Saved'):t('Saving…')));
  f.appendChild(w);
}
function updateFoot(){   /* името на показвания текст над списъка с отметките и състоянието на запазването */
  paintSave();
  const o=$('#bmOwner');if(!o)return;
  const {name,live}=ownerInfo();o.hidden=!name;o.innerHTML='';o.classList.toggle('ed',!live);
  if(!name)return;
  const ic=document.createElement('i');ic.className='live';ic.innerHTML=svg(live?'play':'edit');
  const tx=document.createElement('span');tx.textContent=name;o.title=name;o.append(ic,tx);
}