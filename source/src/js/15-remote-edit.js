/* ----- редактиране на текст на другото устройство: взема се копие, промените се връщат там автоматично ----- */
var REM={id:null,name:'',last:'',t:0,busy:false,st:''};
var REMHOOK={can:()=>false,go:()=>{},stop:()=>{},conn:()=>false};
function xfBtnUi(){const b=document.getElementById('miXfer');if(!b)return;b.classList.toggle('off',!REMHOOK.conn())}   /* бутонът за размяна на текстове е винаги видим: иконата е като на „Мрежа“ и показва състоянието на връзката */   /* „Редактор“ върху показван чужд текст: редактира го, вместо да скрива редактора */
function remUi(){
  const b=document.getElementById('remBar');if(!b||!REM)return;
  const on=!!REM.id&&REM.id===scActive&&!VIEWER;
  b.hidden=!on;if(!on)return;
  b.className=REM.st||'';
  document.getElementById('remBarT').textContent=t('Editing “{n}” on the other device',{n:REM.name});
  document.getElementById('remBarS').textContent=REM.st==='err'?t('Not saved'):REM.st==='busy'?t('Saving…\u200b'):t('Saved\u200b');
}
async function xfEdit(name){
  if(VIEWER)return;
  if(REM.id&&scIdx(REM.id)>=0){   /* вече се редактира един текст: връщаме се към него */
    const k=scIdx(REM.id);await scLoad(k,true,true);showEditor();remUi();return;
  }
  if(typeof name!=='string'||!name){name=await xfPick(t('Which text to edit?'));if(name===null)return}
  const r=await xfAsk({type:'xfer',op:'get',name},12000);
  if(!r){toast(t('The other device did not respond.'),true);return}
  if(r.op!=='put'||typeof r.html!=='string'){toast(t('That text is not on the other device.'),true);return}
  scFlush();
  const rn=String(r.name||'').trim().slice(0,60)||t('Text');
  const html=sanitize(r.html,{internal:true,noRescale:true});
  const n={id:scNewId(),name:scUniqueName((rn+' ('+t('from {d}',{d:peerN('def')})+')').slice(0,60)),html};
  SC.push(n);scPersist();
  REM.id=n.id;REM.name=rn;REM.last=html;REM.st='ok';
  await scLoad(SC.length-1,true,true);
  showEditor();remUi();
  toast(t('You are editing a copy. Changes are saved to the other device automatically.'));
}
function remSync(){
  if(!REM||!REM.id||REM.id!==scActive)return;
  const i=scIdx(REM.id);if(i<0){REM.id=null;remUi();return}
  if(SC[i].html===REM.last)return;
  clearTimeout(REM.t);REM.t=setTimeout(remPush,1200);
}
async function remPush(){
  clearTimeout(REM.t);
  while(REM.busy)await new Promise(r=>setTimeout(r,100));
  const i=scIdx(REM.id);if(i<0)return false;
  const html=SC[i].html;if(html===REM.last)return true;
  REM.busy=true;REM.st='busy';remUi();
  const a=await xfAsk({type:'xfer',op:'apply',mode:'rep',name:REM.name,html,silent:true},12000);
  REM.busy=false;
  const ok=!!(a&&a.ok);
  if(ok)REM.last=html;
  REM.st=ok?'ok':'err';remUi();
  if(!ok)toast(t('Not saved to the other device. I will try again on the next change.'),true);
  const j=scIdx(REM.id);if(ok&&j>=0&&SC[j].html!==REM.last)REM.t=setTimeout(remPush,1200);   /* междувременно има нова промяна */
  return ok;
}
async function remEnd(){
  const id=REM.id;if(!id)return;
  scFlush();clearTimeout(REM.t);
  let i=scIdx(id);
  if(i>=0&&SC[i].html!==REM.last){
    await remPush();
    i=scIdx(id);
    if(i>=0&&SC[i].html!==REM.last){   /* не е записано: копието остава, за да не се загубят промените */
      REM.id=null;remUi();renderScripts();
      toast(t('No connection. The copy stays in the Library.'),true);return;
    }
  }
  REM.id=null;
  const k=scIdx(id);
  if(k>=0){
    const wasLive=id===liveId(),wasActive=id===scActive;
    SC.splice(k,1);scPersist();
    if(id===scLive)scLive=null;
    if(wasActive){
      if(SC.length)await scLoad(Math.min(k,SC.length-1),!wasLive,true);
      else{edSet('');syncTools();setActiveSc(null)}
    }else renderScripts();
    renderBm();
  }
  remUi();
  toast(t('Done. The changes are on the other device.'));
}
document.getElementById('remDone').addEventListener('click',remEnd);
function scDup(i){
  const s=SC[i];if(!s)return;
  scFlush();
  const n={id:scNewId(),name:scUniqueName((t('Copy of')+' '+s.name).slice(0,56)),html:s.html};
  SC.splice(i+1,0,n);scPersist();renderScripts();
  toast(t('Duplicated: {n}',{n:n.name}));
}
function scActions(i){
  const s=SC[i];if(!s)return;
  const {m,body:list,bx}=popShell('text',s.name);
  const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
  function close(){document.removeEventListener('keydown',kd,true);m.remove()}
  const add=(icon,label,fn,dis,cls)=>{
    const r=popRow(icon,t(label),cls);r.disabled=!!dis;
    r.addEventListener('click',()=>{close();fn()});list.appendChild(r);
  };
  if(s.link)add('link','Unlink from file',()=>scUnlink(i));
  add('type','Rename',()=>scRename(i));
  add('copy','Duplicate',()=>scDup(i));
  add('chevU','Move up',()=>scMove(i,-1),i===0);
  add('chev','Move down',()=>scMove(i,1),i===SC.length-1);
  if(REMHOOK.conn())add('upload',t('Send to {d}',{d:peerN('def')}),()=>xfPush(i));
  add('trash','Delete',()=>scDelete(i),false,'danger');
  bx.addEventListener('click',close);
  m.addEventListener('mousedown',e=>{if(e.target===m)close()});
  document.addEventListener('keydown',kd,true);
  document.body.appendChild(m);
  const f=list.querySelector('button:not(:disabled)');if(f)f.focus();
}
async function scRename(i){
  const s=SC[i];if(!s)return;
  const v=await dlg({title:t('Text name'),icon:'type',text:t('Leave empty to follow the first line.'),input:s.name,ok:t('Save')});
  if(v===null||v===false)return;
  if(!v){s.auto=true;s.name=scFirstLineOf(s.html)||scUniqueName(t('New text'))}
  else{s.name=v.slice(0,60);s.auto=false}
  scPersist();renderScripts();
}
function scMove(i,d){
  const j=i+d;if(j<0||j>=SC.length)return;
  const x=SC[i];SC[i]=SC[j];SC[j]=x;scPersist();renderScripts();
}
async function scDelete(i){
  const s=SC[i];if(!s)return;
  const ok=await dlg({title:t('Delete text'),icon:'trash',text:t('Delete the text “{n}”?',{n:s.name}),ok:t('Delete'),danger:true});
  if(!ok)return;
  if(await scRemove(s))toast(t('Text deleted.'));
}
/* маха текста от списъка без въпрос (използва се и когато другото устройство поиска изтриване) */
async function scRemove(s){
  const k=scIdx(s.id);if(k<0)return false;
  SC.splice(k,1);scPersist();
  const wasLive=s.id===liveId(),wasActive=s.id===scActive;
  if(s.id===scLive)scLive=null;
  if(wasActive){
    if(SC.length)await scLoad(Math.min(k,SC.length-1),!wasLive,true);   /* съседният текст отива в редактора */
    else{edSet('');syncTools();setActiveSc(null)}
  }else renderScripts();
  renderBm();
  return true;
}
let scWasShown=null;
function renderScripts(){
  updateFoot();
  if(!VIEWER){try{localStorage.setItem('tp.live',liveId()||'')}catch(e){oops('renderScripts#1',e)}}
  const box=$('#scList');if(!box)return;
  box.innerHTML='';
  if(!SC.length){
    const d=document.createElement('div');d.className='bmempty';
    d.textContent=t('No texts yet. Tap “+” for a new text, or open the Editor and type: the text is saved automatically.');
    box.appendChild(d);
  }
  const shown=showingNow();scWasShown=shown;
  SC.forEach((s,i)=>{
    const row=document.createElement('div');row.className='bmi'+(shown&&s.id===liveId()?' cur':'')+(editorOpen()&&s.id===scActive?' editing':'');   /* зелено = показван текст, само докато нещо се показва */
    const n=document.createElement('span');n.className='n';n.textContent=i+1;
    /* името отваря действията (преименуване, дублиране, местене, изтриване); ✎ редактира; ▶ показва */
    const tt=document.createElement('button');tt.type='button';tt.className='tt';tt.textContent=s.name;tt.title=s.name+' — '+t('Play text');
    tt.addEventListener('click',e=>{e.stopPropagation();scShow(i)});
    row.append(n,tt);
    if(s.link){const lk=document.createElement('i');lk.className='lnk';lk.title=t('Linked to local file: {n}',{n:s.link.name});lk.innerHTML=svg('link');row.appendChild(lk)}
    row.append(
      actBtn('e','edit',t('Edit text'),()=>scEdit(i)),
      actBtn('m','more',t('Text actions'),()=>scActions(i)));
    box.appendChild(row);
  });
  const rb=$('#scListRead');rb.innerHTML='';$('#scReadSec').hidden=!SC.length;
  SC.forEach((s,i)=>{
    const row=document.createElement('div');row.className='bmi'+(s.id===liveId()?' cur':'');
    const n=document.createElement('span');n.className='n';n.textContent=i+1;
    const b=document.createElement('button');b.type='button';b.className='tt';b.textContent=s.name;b.title=s.name;
    row.append(n,b);
    if(s.link){const lk=document.createElement('i');lk.className='lnk';lk.title=t('Linked to local file: {n}',{n:s.link.name});lk.innerHTML=svg('link');row.appendChild(lk)}   /* синхронизиран файл: и в панела на цял екран */
    if(s.id===liveId()){const lv=document.createElement('i');lv.className='live';lv.title=t('Shown text');lv.innerHTML=svg('play');row.appendChild(lv)}
    row.addEventListener('click',()=>{if(VIEWER)post({type:'scsel',sid:s.id});else scLoad(i);toggleBm(false)});
    rb.appendChild(row);
  });
}
if(!VIEWER){
  $('#miXfer').addEventListener('click',()=>{if(REMHOOK.conn())xfMenu();else openRemote(true)});   /* без връзка отваря „Управление в мрежа“, за да се свърже */
try{xfBtnUi()}catch(e){oops('#miXfer click#1',e)}
$('#miScNew').addEventListener('click',()=>scAddEmpty());
}
