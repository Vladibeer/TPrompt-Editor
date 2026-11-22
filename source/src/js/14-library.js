/* ---------- Библиотека (текстовете) ---------- */
/* запис на списъка с текстове: в голямото хранилище (по ред, без застъпване), иначе в localStorage;
   вторият прозорец научава за промяната от SC_REV */
let scPutQ=Promise.resolve();
function scPersist(){
  if(!scStoreOk){
    if(!scStoreDone){scStoreReady.then(()=>{if(scStoreOk)scPersist()});return}   /* хранилището още се отваря */
    toast(t('Texts cannot be saved on this device.'),true);
    return;
  }
  const snap=SC.map(scRec);
  scPutQ=scPutQ.then(()=>txPut('scripts',snap)).then(()=>{try{localStorage.setItem(SC_REV,String(Date.now()))}catch(e){oops('scPersist#1',e)}})
    .catch(e=>{oops('scPersist#2',e);toast(t('No space to store the text.'),true)});
}
function scIdx(id){return SC.findIndex(x=>x.id===id)}
function scFirstLineOf(html){
  const d=document.createElement('div');d.innerHTML=html||'';
  for(const e of d.querySelectorAll('p,h1,h2,h3,h4,h5,h6,li,div')){
    if(e.querySelector('p,h1,h2,h3,h4,h5,h6,li,div'))continue;
    const x=e.textContent.replace(TILDE,'').trim();if(x)return x.slice(0,40);
  }
  return d.textContent.replace(TILDE,'').trim().slice(0,40);
}
/* втори прозорец: списъкът с текстове и показваният текст идват от записаното от главния прозорец */
async function scReload(){
  try{
    const j=await txGet('scripts');
    if(Array.isArray(j))SC=scClean(j);
    const lv=localStorage.getItem('tp.live');scLive=lv&&SC.some(x=>x.id===lv)?lv:null;
  }catch(e){oops('scReload#1',e)}
  renderScripts();
}
window.addEventListener('storage',e=>{if(VIEWER&&(e.key===SC_KEY||e.key===SC_REV||e.key==='tp.live'))scReload()});
function scNewId(){return 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
function setActiveSc(id){
  scActive=id;
  try{if(id)localStorage.setItem(SC_ACT,id);else localStorage.removeItem(SC_ACT)}catch(e){oops('setActiveSc#1',e)}
  renderScripts();
  try{remUi()}catch(e){oops('setActiveSc#2',e)}
}
function scAutosave(){scAutosave0();try{lfSync()}catch(e){oops('scAutosave#1',e)}try{remSync()}catch(e){oops('scAutosave#2',e)}}
function scAutosave0(){
  if(VIEWER)return;
  if(!scActive){   /* всичко, което се пише, е текст от списъка: създава се автоматично */
    if(!edText().trim())return;
    const n={id:scNewId(),name:scDefaultName(),html:edHtml(),auto:true};
    SC.push(n);scPersist();setActiveSc(n.id);return;
  }
  const i=scIdx(scActive);if(i<0)return;
  const h=edHtml();
  if(SC[i].html!==h){
    SC[i].html=h;
    if(SC[i].auto){const nm=scFirstLine();if(nm&&nm!==SC[i].name){SC[i].name=nm;scPersist();renderScripts();return}}   /* името следва първия ред, докато не е променено ръчно */
    scPersist();
  }
}
function scFlush(){clearTimeout(docT);if(!VIEWER&&scActive&&scIdx(scActive)>=0){scAutosave()}}
function scMakeLive(){   /* текстът от редактора става текст за четене / дистанционно */
  if(VIEWER||liveSync())return;
  scLive=scActive;
  if(remoteOn()){post({type:'content',html:edHtml(),reset:true});if(pvRendered)renderPreview()}
  renderScripts();renderBm();
}
function scFirstLine(){return (edText().split('\n').map(x=>x.replace(TILDE,'').trim()).find(Boolean)||'').slice(0,40)}
function scDefaultName(){return scFirstLine()||(t('Text')+' '+(SC.length+1))}
/* общ изскачащ прозорец (М2): рамка, горен ред с икона, заглавие и „Затвори“, тяло с редове един под друг */
function popShell(icon,title){
  const m=document.createElement('div');m.className='modal scdlg';m.style.zIndex=120;
  const card=document.createElement('div');card.className='modal-card rm-card';
  const h=document.createElement('header'),b=document.createElement('b');
  if(icon){const ic=document.createElement('i');ic.setAttribute('data-ic',icon);ic.innerHTML=svg(icon);b.appendChild(ic)}
  const bt=document.createElement('span');bt.textContent=title;b.appendChild(bt);h.appendChild(b);
  const bx=document.createElement('button');bx.type='button';bx.className='ib';bx.title=t('Close');bx.setAttribute('aria-label',t('Close'));bx.innerHTML='<i data-ic="x">'+svg('x')+'</i>';h.appendChild(bx);
  const body=document.createElement('div');body.className='modal-body opts';
  card.append(h,body);m.appendChild(card);
  return {m,body,bx};
}
/* ред с избор (М3): икона и надпис; cls = 'danger' за червен ред */
function popRow(icon,label,cls){
  const r=document.createElement('button');r.type='button';r.className='opt'+(cls?' '+cls:'');
  r.innerHTML='<i data-ic="'+icon+'">'+svg(icon)+'</i>';
  const tt=document.createElement('span');tt.textContent=label;r.appendChild(tt);
  return r;
}
function dlg(o){
  return new Promise(res=>{
    const {m,body,bx}=popShell(o.icon,o.title);
    let inp=null;
    if(o.text){const p=document.createElement('p');p.className='rm-lead';p.textContent=o.text;body.appendChild(p)}
    if(o.row){const l=document.createElement('div');l.className='bmlist';const r=document.createElement('div');r.className='bmi static';
      const n=document.createElement('span');n.className='n';n.textContent=o.row.n;const tt=document.createElement('span');tt.className='tt';tt.textContent=o.row.name;tt.style.padding='7px 0';
      r.append(n,tt);l.appendChild(r);body.appendChild(l)}
    if(o.input!==undefined){
      const r=document.createElement('div');r.className='row rm-row';
      inp=document.createElement('input');inp.type='text';inp.value=o.input;inp.maxLength=60;inp.spellcheck=false;
      r.appendChild(inp);body.appendChild(r);
    }
    const r2=document.createElement('div');r2.className='row rm-row';
    const bc=document.createElement('button');bc.type='button';bc.className='btn';bc.textContent=t('Cancel');
    const bo=document.createElement('button');bo.type='button';bo.className='btn primary';bo.textContent=o.ok||'OK';
    let ba=null;
    if(o.alt){ba=document.createElement('button');ba.type='button';ba.className='btn';ba.textContent=o.alt}
    if(ba)r2.append(bc,ba,bo);else r2.append(bc,bo);
    body.appendChild(r2);
    const none=inp?null:false;
    const kd=e=>{
      if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(none)}
      else if(e.key==='Enter'&&inp&&e.target===inp){e.preventDefault();e.stopPropagation();bo.click()}
    };
    function done(v){document.removeEventListener('keydown',kd,true);m.remove();res(v)}
    bo.addEventListener('click',()=>done(inp?inp.value.trim():true));
    bc.addEventListener('click',()=>done(none));bx.addEventListener('click',()=>done(none));if(ba)ba.addEventListener('click',()=>done('alt'));
    m.addEventListener('mousedown',e=>{if(e.target===m)done(none)});
    document.addEventListener('keydown',kd,true);
    document.body.appendChild(m);
    if(inp){inp.focus();inp.select()}else bo.focus();
  });
}
/* всеки текст се отваря в началото: курсорът отива в началото (иначе остава на старото място или в края и WebView превърта до него),
   а превъртането се нулира веднага и още веднъж, щом редакторът се покаже (на телефона той може да е скрит зад друг панел) */
let edTopPend=false;
function edTopNow(){editorWrap.scrollTop=0;editorWrap.scrollLeft=0}
function edToTop(){
  try{tt.view.dispatch(tt.state.tr.setSelection(TPEd.TextSelection.atStart(tt.state.doc)))}catch(e){oops('edToTop#1',e)}
  edTopNow();
  edTopPend=!editorWrap.getClientRects().length;   /* скрит редактор: превъртането се нулира при показване */
  requestAnimationFrame(()=>requestAnimationFrame(edTopNow));
  setTimeout(()=>{if(!edTopPend)edTopNow()},350);   /* след анимацията на панела/клавиатурата */
}
if(window.IntersectionObserver)new IntersectionObserver(es=>{for(const e of es)if(e.isIntersecting&&edTopPend){edTopPend=false;edTopNow();requestAnimationFrame(edTopNow)}}).observe(editorWrap);
async function scLoad(i,editOnly,force){
  const s=SC[i];if(!s||VIEWER)return;
  if(!force&&!reading&&!(scActive&&scIdx(scActive)>=0)&&docTouched&&edText().trim()){
    const ok=await dlg({title:t('Replace the text'),icon:'refresh',text:t('The current text is not saved in the Library. Replace it?'),ok:t('Replace')});
    if(!ok)return false;
  }
  scFlush();
  edSet(s.html||'');edToTop();docTouched=true;
  if(s.link&&s.link.wh==null&&typeof LF!=='undefined'&&LF){try{s.link.wh=LF.hash((await lfSerialize(s.link.fmt)).d)}catch(e){oops('scLoad#1',e)}}   /* изходна точка: записва се само при реална промяна */
  syncTools();
  if(!editOnly)scLive=s.id;
  bmEdit=-1;
  setActiveSc(s.id);renderBm();updateFoot();
  if(!editOnly){
    if(reading){buildPrompter();renderBm();layout();pos=0;remain=0;draw(true);showHud()}
    if(remoteOn()){post({type:'content',html:edHtml(),reset:true});if(pvRendered)renderPreview()}
  }
  return true;
}
function scStep(d){
  if(SC.length<2||VIEWER)return;
  let i=scIdx(liveId());if(i<0)i=d>0?-1:SC.length;
  i+=d;
  if(i<0||i>=SC.length)return;
  scLoad(i);
}
function endHint(){}   /* значката „Край. Следващ текст“ е махната */
function scUniqueName(base){
  let n=base,k=2;
  while(SC.some(x=>x.name===n))n=base+' '+(k++);
  return n;
}
async function scAddEmpty(){
  scFlush();
  /* въпрос за име; ако се остави празно, името се взема от първия ред, когато се започне да се пише */
  const v=await dlg({title:t('New text'),icon:'filePlus',input:'',ok:t('Create')});
  if(v===null||v===false)return;
  const nm=(v||'').trim().slice(0,60);
  const s={id:scNewId(),name:nm||scUniqueName(t('New text')),html:'<p><br></p>',auto:!nm};
  SC.push(s);scPersist();renderScripts();
  await scLoad(SC.length-1,remoteOn(),true);
  showEditor();
  if(!rcOn()||rcEff()==='ed'){try{editor.focus()}catch(e){oops('scAddEmpty#1',e)}}
}
function hideEditor(){
  if(rcOn()){rcv='pv';applyRc();applyView()}
  else if(remoteOn()&&VT.ed){VT.ed=false;autoEd=false;saveView();applyView()}
}
async function scEdit(i){
  const s=SC[i];if(!s)return;
  if(scActive===s.id&&editorOpen()){   /* повторно натискане върху вече редактирания текст */
    if(!showingNow())return;   /* нищо не се показва: само се редактира, затова текстът си остава в редактора (не се връща последно показаният) */
    const li=scIdx(liveId());   /* показва се нещо: редакторът се връща към показвания текст или се затваря */
    if(li>=0&&li!==i)await scLoad(li,true,true);
    if(remoteOn())hideEditor();
    return;
  }
  const prevSc=scActive;
  if(scActive!==s.id)await scLoad(i,true);   /* само в редактора: четенето/дистанционното продължават с текущия текст */
  if(scActive===s.id){const top=scActive!==prevSc;showEditor();editor.focus({preventScroll:true});if(top)edTopNow()}
}
/* ▶ върху текст: при свързан втори прозорец той започва да показва този текст, а редакторът остава на текста, който се редактира;
   без втори прозорец има един текст за четене и редактиране, затова редакторът го зарежда */
async function scShow(i){
  const s=SC[i];if(!s||VIEWER)return;
  if(!remoteOn()){if(await scLoad(i)!==false)startRun();return}   /* както при отметките: четенето се пуска по избрания начин */
  scFlush();
  scLive=s.id;
  post({type:'content',html:liveHtml(),reset:true});if(pvRendered)renderPreview();
  renderScripts();renderBm();updateFoot();
}
/* всички текстове в един файл (с отметките, които са част от текстовете, и настройките) */
async function scSaveAll(){
  scFlush();
  if(!SC.length){toast(t('No texts yet.'),true);return}
  const data=JSON.stringify({app:'TPrompt',kind:'texts',version:1,saved:new Date().toISOString(),settings:S,texts:SC.map(x=>({name:x.name,html:x.html}))},null,1);
  await saveFile('TPrompt-texts.json',data);
}
async function scLoadFile(f){
  let j;
  try{j=JSON.parse(await f.text())}catch(e){j=null}
  if(!j||j.kind!=='texts'||!Array.isArray(j.texts)){toast(t('This file is not a TPrompt texts list.'),true);return}
  const items=j.texts.filter(x=>x&&typeof x.html==='string').map((x,k)=>({
    id:scNewId()+k,name:String(x.name||'').slice(0,60)||t('Text')+' '+(k+1),html:sanitize(x.html,{internal:true,noRescale:true})
  }));
  if(!items.length){toast(t('The file contains no texts.'),true);return}
  const r=await dlg({title:t('Load texts'),icon:'folder',text:t('The file contains {n} texts. Replace the current list or add them to it?',{n:items.length}),ok:t('Replace'),alt:t('Add'),danger:true});
  if(!r)return;
  scFlush();
  if(r==='alt'){
    SC.push(...items);scPersist();renderScripts();renderBm();
    toast(t('Texts added: {n}',{n:items.length}));
  }else{
    if(j.settings&&typeof j.settings==='object'){try{for(const k in DEF)if(k in j.settings&&typeof j.settings[k]===typeof DEF[k])S[k]=j.settings[k];saveS();applyStyles();syncUI()}catch(e){oops('scLoadFile#1',e)}}
    SC=items;scLive=null;bmEdit=-1;scPersist();setActiveSc(null);renderBm();
    toast(t('List replaced: {n} texts',{n:items.length}));
  }
}
/* пренос на текст между устройствата. Решението се взема и диалогът се показва на УПРАВЛЯВАЩОТО устройство (където е натиснат бутонът);
   другото само изпълнява, без да пита. Работи и в двете посоки: телефон/таблет → компютър и компютър → телефон/таблет */
const XF={w:{},via:{}};
function xfSend(m){const f=HOSTROLE?XF.via.pc:XF.via.phone;return f?f(m):Promise.resolve(false)}
function xfAsk(m,ms){
  return new Promise(res=>{
    const rid=Math.random().toString(36).slice(2,9);m.rid=rid;
    const to=setTimeout(()=>{delete XF.w[rid];res(null)},ms||8000);
    XF.w[rid]=r=>{clearTimeout(to);delete XF.w[rid];res(r)};
    xfSend(m).then(ok=>{if(!ok){clearTimeout(to);delete XF.w[rid];res(null)}});
  });
}
/* записва текста в списъка: add = нов, rep = заменя текста със същото име, copy = копие с ново име */
function xfStore(how,nm,html){
  scFlush();
  const i=how==='rep'?SC.findIndex(x=>x.name===nm):-1;
  if(i>=0){
    const s0=SC[i];s0.html=html;scPersist();renderScripts();
    if(scActive===s0.id){edSet(html);docTouched=true}
    return nm;
  }
  const n={id:scNewId(),name:how==='copy'?scUniqueName((t('Copy of')+' '+nm).slice(0,56)):nm,html};
  SC.push(n);scPersist();renderScripts();
  return n.name;
}
/* съобщение от другото устройство: или отговор на наша заявка, или заявка, която изпълняваме мълчаливо */
function xfIn(m){
  if(VIEWER||!m||m.type!=='xfer')return;
  if(m.rid&&XF.w[m.rid]&&(m.op==='names'||m.op==='put'||m.op==='none'||m.op==='ack')){XF.w[m.rid](m);return}
  const re=o=>xfSend(Object.assign({type:'xfer',rid:m.rid},o));
  if(m.op==='list')re({op:'names',names:SC.map(x=>x.name)});
  else if(m.op==='del'){   /* другото устройство изтрива текст от този списък (там вече са питали) */
    const nm=typeof m.name==='string'?m.name:'';const k=nm?SC.findIndex(x=>x.name===nm):-1;
    if(k<0){re({op:'ack',ok:false,name:nm});return}
    scFlush();
    scRemove(SC[k]).then(ok=>{re({op:'ack',ok,name:nm});if(ok)toast(t('The other device deleted the text “{n}”.',{n:nm}))}).catch(()=>re({op:'ack',ok:false,name:nm}));
  }
  else if(m.op==='get'){
    let o={op:'none'};
    try{scFlush();const nm=typeof m.name==='string'&&m.name?m.name:null;const i=nm?SC.findIndex(x=>x.name===nm):scIdx(scActive);if(i>=0)o={op:'put',name:SC[i].name,html:SC[i].html}}catch(e){oops('re#1',e)}
    re(o);
  }else if(m.op==='apply'&&typeof m.html==='string'&&['add','rep','copy'].includes(m.mode)){
    let ok=false,nm='';
    try{nm=xfStore(m.mode,String(m.name||'').trim().slice(0,60)||t('Text'),sanitize(m.html,{internal:true,noRescale:true}));ok=true}catch(e){oops('re#2',e)}
    re({op:'ack',ok,name:nm});
    if(ok&&!m.silent)toast(t('Text received: {n}',{n:nm}));
  }
}
/* изпраща отворения тук текст към другото устройство; пита ТУК */
/* избор на текст от списъка на другото устройство; връща името или null */
async function xfPick(title){
  const r=await xfAsk({type:'xfer',op:'list'},12000);
  if(!r||!Array.isArray(r.names)){toast(t('The other device did not respond.'),true);return null}
  if(!r.names.length){toast(t('There are no texts on the other device.'),true);return null}
  XF.names=r.names.slice();   /* редът съвпада със списъка „sc“ в състоянието на компютъра */
  const k=await pickList(title,r.names);
  return k===null?null:r.names[k];
}
/* избор от списък с имена; връща индекса или null */
function pickList(title,names){
  return new Promise(res=>{
    const {m,body:list,bx}=popShell('text',title);
    const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();done(null)}};
    function done(v){document.removeEventListener('keydown',kd,true);m.remove();res(v)}
    names.forEach((nm,k)=>{
      const row=popRow('text',nm);
      row.addEventListener('click',()=>done(k));list.appendChild(row);
    });
    bx.addEventListener('click',()=>done(null));
    m.addEventListener('mousedown',e=>{if(e.target===m)done(null)});
    document.addEventListener('keydown',kd,true);
    document.body.appendChild(m);
    const f=list.querySelector('button');if(f)f.focus();
  });
}
async function xfPush(idx){
  if(VIEWER)return;
  scFlush();
  let i=idx;
  if(typeof i!=='number'){   /* от менюто „Размяна“: избор от списъка с текстове тук */
    if(!SC.length){toast(t('No texts yet.'),true);return}
    i=await pickList(t('Which text to send?'),SC.map(x=>x.name));
    if(i===null)return;
  }
  if(!SC[i]){toast(t('No text is open.'),true);return}
  const nm=SC[i].name,html=SC[i].html;
  const r=await xfAsk({type:'xfer',op:'list'});
  if(!r||!Array.isArray(r.names)){toast(t('The other device did not respond.'),true);return}
  let mode=null;
  if(r.names.includes(nm)){
    const d=await dlg({title:t('Send text'),icon:'upload',text:t('The other device already has a text “{n}”. Replace it, or keep the new one as a copy?',{n:nm}),ok:t('Replace'),alt:t('Keep a copy'),danger:true});
    mode=d===true?'rep':d==='alt'?'copy':null;
  }else{
    const d=await dlg({title:t('Send text'),icon:'upload',text:t('Add the text “{n}” to the other device?',{n:nm}),ok:t('Add')});
    mode=d===true?'add':null;
  }
  if(!mode)return;
  const a=await xfAsk({type:'xfer',op:'apply',mode,name:nm,html},12000);
  if(a&&a.ok)toast(t('Sent to the other device: {n}',{n:a.name||nm}));
  else toast(t('The other device did not confirm.'),true);
}
/* взема отворения на другото устройство текст; пита ТУК */
async function xfPull(){
  if(VIEWER)return;
  const pick=await xfPick(t('Which text to get?'));if(pick===null)return;
  const r=await xfAsk({type:'xfer',op:'get',name:pick},12000);
  if(!r){toast(t('The other device did not respond.'),true);return}
  if(r.op!=='put'||typeof r.html!=='string'){toast(t('No text is open on the other device.'),true);return}
  scFlush();
  const nm=String(r.name||'').trim().slice(0,60)||t('Text');
  let how=null;
  if(SC.some(x=>x.name===nm)){
    const d=await dlg({title:t('Receive text'),icon:'download',text:t('A text “{n}” already exists here. Replace it, or keep the received one as a copy?',{n:nm}),ok:t('Replace'),alt:t('Keep a copy'),danger:true});
    how=d===true?'rep':d==='alt'?'copy':null;
  }else{
    const d=await dlg({title:t('Receive text'),icon:'download',text:t('Add the received text “{n}” here?',{n:nm}),ok:t('Add')});
    how=d===true?'add':null;
  }
  if(!how)return;
  const n=xfStore(how,nm,sanitize(r.html,{internal:true,noRescale:true}));
  toast(t(how==='rep'?'Replaced: {n}':'Added: {n}',{n}));
}
/* изтрива текст от списъка на другото устройство; пита ТУК */
async function xfDel(){
  if(VIEWER)return;
  const nm=await xfPick(t('Which text should be deleted?'));if(nm===null)return;
  const ok=await dlg({title:t('Delete text'),icon:'trash',text:t('Delete the text “{n}” from the other device? This cannot be undone.',{n:nm}),ok:t('Delete'),danger:true});
  if(ok!==true)return;
  const a=await xfAsk({type:'xfer',op:'del',name:nm},12000);
  if(!a){toast(t('The other device did not respond.'),true);return}
  if(!a.ok){toast(t('That text is not on the other device.'),true);return}
  if(REM&&REM.id&&REM.name===nm){REM.id=null;remUi();renderScripts()}   /* копието за редакция остава тук като обикновен текст */
  toast(t('Deleted from the other device: {n}',{n:nm}));
}
/* меню „размяна“ в панела „Библиотека“: взема текст от другото устройство или изпраща отворения */
function xfMenu(){
  const other=peerN('def');
  const {m,body:list,bx}=popShell('swap',t('Exchange texts'));
  const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
  function close(){document.removeEventListener('keydown',kd,true);m.remove()}
  const add=(icon,label,fn,cls)=>{
    const r=popRow(icon,label,cls);
    r.addEventListener('click',()=>{close();fn()});list.appendChild(r);
  };
  add('download',t('Get from {d}…',{d:other}),()=>xfPull());
  add('upload',t('Send to {d}…',{d:other}),()=>xfPush());
  add('trash',t('Delete text from {d}…',{d:other}),()=>xfDel(),'danger');
  bx.addEventListener('click',close);
  m.addEventListener('mousedown',e=>{if(e.target===m)close()});
  document.addEventListener('keydown',kd,true);
  document.body.appendChild(m);
  const f=list.querySelector('button');if(f)f.focus();
}