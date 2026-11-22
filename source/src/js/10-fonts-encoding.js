/* ---------- Собствени шрифтове (импорт) и кодиране на стари .txt файлове ----------
   Шрифтовете се пазят в IndexedDB на устройството (до няколко десетки MB) и се зареждат с FontFace при всяко стартиране.
   Вторият прозорец има същата база и ги зарежда сам; другите устройства си добавят шрифтовете отделно. */
const ENCS=[['windows-1251','Cyrillic (Windows-1251)'],['koi8-r','Cyrillic (KOI8-R)'],['windows-1250','Central European (Windows-1250)'],['iso-8859-2','Central European (ISO-8859-2)'],['windows-1252','Western European (Windows-1252)'],['windows-1253','Greek (Windows-1253)'],['windows-1254','Turkish (Windows-1254)'],['windows-1255','Hebrew (Windows-1255)'],['windows-1256','Arabic (Windows-1256)'],['windows-1257','Baltic (Windows-1257)'],['windows-1258','Vietnamese (Windows-1258)'],['windows-874','Thai (Windows-874)'],['shift_jis','Japanese (Shift_JIS)'],['euc-jp','Japanese (EUC-JP)'],['euc-kr','Korean (EUC-KR)'],['gbk','Chinese Simplified (GBK)'],['gb18030','Chinese (GB18030)'],['big5','Chinese Traditional (Big5)']];
{const es=$('#encSel');if(es){ENCS.forEach(([v,n])=>{const o=document.createElement('option');o.value=v;o.textContent=n;es.appendChild(o)});es.value=S.txtEnc}}
const UF={names:[],faces:new Map(),db:null,rev:'tp.fonts.rev'};
function ufDb(){
  if(!UF.db)UF.db=new Promise((res,rej)=>{
    let r;try{r=indexedDB.open('tprompt-fonts',1)}catch(e){rej(e);return}
    r.onupgradeneeded=()=>{r.result.createObjectStore('fonts',{keyPath:'name'})};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  });
  return UF.db;
}
async function ufTx(mode,fn){
  const db=await ufDb();
  return new Promise((res,rej)=>{
    const tx=db.transaction('fonts',mode);let rq;
    try{rq=fn(tx.objectStore('fonts'))}catch(e){rej(e);return}
    tx.oncomplete=()=>res(rq&&rq.result);tx.onerror=tx.onabort=()=>rej(tx.error||new Error('tx'));
  });
}
const ufClean=n=>String(n||'').replace(/[^\p{L}\p{N} _.\-]/gu,'').replace(/\s+/g,' ').trim().slice(0,40);
/* списъците „Шрифт“ в Настройки и в лентата на редактора се изграждат наново от FONTS */
function fillFontSelects(){
  fsel.innerHTML='';fontSel.innerHTML='';
  FONTS.forEach(([n])=>{
    const o=document.createElement('option');o.value=n;o.textContent=n;fsel.appendChild(o);
    const o2=document.createElement('option');o2.value=n;o2.textContent=n;o2.style.fontFamily=fam(n);fontSel.appendChild(o2);
  });
  fsel.value=S.font;
  try{syncTools()}catch(e){oops('fillFontSelects#1',e)}
}
function ufRefresh(){
  fillFontSelects();
  try{syncUI();applyStyles();if(reading)layout()}catch(e){oops('ufRefresh#1',e)}
}
function ufBump(){try{localStorage.setItem(UF.rev,String(Date.now()))}catch(e){oops('ufBump#1',e)}}
function ufDrop(name){   /* маха шрифта от паметта и от списъците (не от базата) */
  const ff=UF.faces.get(name);if(ff){try{document.fonts.delete(ff)}catch(e){oops('ufDrop#1',e)}}
  UF.faces.delete(name);UF.names=UF.names.filter(n=>n!==name);
  const i=FONTS.findIndex(x=>x[0]===name);if(i>=0)FONTS.splice(i,1);
}
async function ufAttach(name,data,kind,pre){
  const ff=pre||new FontFace(name,data);if(!pre)await ff.load();document.fonts.add(ff);
  UF.faces.set(name,ff);FONTS.push([name,kind||fontKind(name)]);UF.names.push(name);
}
/* всички промени по шрифтовете минават през една опашка, за да не се застъпват (старт, импорт, събитие от друг прозорец) */
let ufQ=Promise.resolve();
function ufLock(fn){const r=ufQ.then(fn,fn);ufQ=r.catch(e=>{oops('ufLock#1',e)});return r}
function ufLoad(){return ufLock(ufLoad0)}   /* при старт и когато друг прозорец е променил шрифтовете */
async function ufLoad0(){
  let rows;try{rows=await ufTx('readonly',st=>st.getAll())||[]}catch(e){return}
  const have=new Set(rows.map(r=>r.name));let changed=false;
  for(const n of UF.names.slice())if(!have.has(n)){ufDrop(n);changed=true}
  for(const r of rows){
    if(UF.faces.has(r.name)||FONTS.some(x=>x[0]===r.name))continue;
    try{await ufAttach(r.name,r.data,r.kind);changed=true}catch(e){oops('ufLoad0#1',e)}
  }
  if(changed)ufRefresh();
}
async function ufImport(files){
  let last=null;
  for(const f of files){
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    if(!['ttf','otf','woff','woff2'].includes(ext)){toast(t('The font must be .ttf, .otf, .woff or .woff2.'),true);continue}
    if(f.size>40*1048576){toast(t('The file is too large (40 MB at most).'),true);continue}
    const data=await f.arrayBuffer();
    const base=ufClean(f.name.replace(/\.[^.]+$/,'').replace(/[-_]+/g,' ').replace(/\s+(regular|normal)$/i,''))||'Font';
    let nm=base;
    if(FONTS.some(x=>x[0]===nm)&&!UF.names.includes(nm))nm+=' 2';   /* името на вграден шрифт е заето */
    const r=await ufLock(async()=>{
      let ff;try{ff=new FontFace(nm,data);await ff.load()}catch(e){return {err:'This file is not a valid font.'}}   /* първо проверка: стар шрифт със същото име не се пипа при грешен файл */
      const replaced=UF.names.includes(nm);
      if(replaced)ufDrop(nm);
      await ufAttach(nm,data,null,ff);
      try{await ufTx('readwrite',st=>st.put({name:nm,kind:fontKind(nm),data,file:f.name}))}
      catch(e){ufDrop(nm);return {err:'Not enough storage for the font.'}}
      return {replaced};
    });
    if(r.err){toast(t(r.err),true);continue}
    last=nm;ufRefresh();ufBump();
    toast(t(r.replaced?'Font replaced: {n}':'Font added: {n}',{n:nm}));
  }
  if(last)set('font',last);   /* добавеният шрифт се ползва веднага */
}
async function ufRemove(name){
  await ufLock(async()=>{try{await ufTx('readwrite',st=>st.delete(name))}catch(e){oops('ufRemove#1',e)}ufDrop(name)});
  if(S.font===name)set('font',DEF.font);
  ufRefresh();ufBump();
  toast(t('Font removed: {n}',{n:name}));
}
let ufInp=null;
function ufPick(){
  if(!ufInp){
    ufInp=document.createElement('input');ufInp.type='file';ufInp.multiple=true;ufInp.accept='.ttf,.otf,.woff,.woff2,font/*,application/octet-stream';ufInp.style.display='none';
    ufInp.addEventListener('change',()=>{const fs=[...ufInp.files];ufInp.value='';if(fs.length)ufImport(fs)});
    document.body.appendChild(ufInp);
  }
  ufInp.click();
}
function fontMenu(){
  const {m,body:list,bx}=popShell('type',t('Your fonts'));
  const kd=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}};
  function close(){document.removeEventListener('keydown',kd,true);m.remove()}
  const add=(icon,label,fn,cls)=>{
    const r=popRow(icon,label,cls);
    r.addEventListener('click',()=>{close();fn()});list.appendChild(r);
  };
  add('upload',t('Add a font from a file…'),()=>ufPick());
  UF.names.forEach(n=>add('trash',t('Remove')+' „'+n+'“',async()=>{
    const ok=await dlg({title:t('Remove font'),icon:'trash',text:t('Remove the font “{n}”?',{n}),ok:t('Remove'),danger:true});
    if(ok===true)ufRemove(n);
  },'danger'));
  bx.addEventListener('click',close);
  m.addEventListener('mousedown',e=>{if(e.target===m)close()});
  document.addEventListener('keydown',kd,true);
  document.body.appendChild(m);
  const f=list.querySelector('button');if(f)f.focus();
}
{
  const fi=$('#fontImp');
  if(fi){
    if(typeof indexedDB==='undefined'||typeof FontFace==='undefined')fi.closest('.row').hidden=true;
    else {
      fi.addEventListener('click',ufPick);
      fi.addEventListener('contextmenu',e=>{if(UF.names.length){e.preventDefault();fontMenu()}});
    }
  }
  window.addEventListener('storage',e=>{if(e.key===UF.rev)ufLoad()});
  if(typeof indexedDB!=='undefined'&&typeof FontFace!=='undefined')ufLoad();
}
/* размерът се записва в px (1 пт = 4/3 px) като атрибут на маркираното – върху няколко реда с получер и обикновен текст е еднакъв навсякъде */
function applySize(pt){
  if(!(pt>0))return;
  const px=Math.round(pt*4/3*100)/100;
  tt.chain().focus().setFontSizePx(px).run();
  /* празен ред няма текст, на който да остане знакът за размер – размерът се пази на самия ред */
  const st=tt.state,sel=st.selection,tr=st.tr;let ch=false;
  const setB=(n,pos)=>{if(n.childCount===0&&n.attrs.blockSize!==px){tr.setNodeMarkup(pos,undefined,Object.assign({},n.attrs,{blockSize:px}));ch=true}};
  if(sel.empty){const $f=sel.$from;if($f.depth>=1)setB($f.parent,$f.before())}
  else st.doc.nodesBetween(sel.from,sel.to,(n,pos)=>{if(n.isTextblock){if(sel.to>pos+1)setB(n,pos);return false}});
  if(ch)tt.view.dispatch(tr);
}
const edColor=c=>tt.chain().focus().setColor(c).run();
const edHi=c=>{const ch=tt.chain().focus();(c==='transparent'?ch.unsetBackgroundColor():ch.setBackgroundColor(c)).run()};

function editorEmpty(){
  const d=tt.state.doc;if(d.textContent.replace(/[\s ]/g,'')!=='')return false;
  let img=false;d.descendants(n=>{if(n.type.name==='image')img=true;return !img});return !img;
}
/* какво е форматирането на маркираното (или на курсора): стойност само ако е еднаква навсякъде, иначе null (както във Word) */
const HFAC={1:1.6,2:1.4,3:1.2,4:1.05,5:1.05,6:1.05};
function selInfo(){
  const st=tt.state,sel=st.selection,sz=new Set(),ff=new Set(),cl=new Set(),bg=new Set(),bk=new Set();
  const base=b=>(b&&b.attrs&&b.attrs.blockSize)||BASE*(b&&b.type.name==='heading'?HFAC[b.attrs.level]||1:1);   /* размер на реда: от самия ред (напр. празен ред от Word), иначе по тип */
  const blk=b=>bk.add(b.type.name==='heading'&&b.attrs.level<=3?'h'+b.attrs.level:'p');
  const take=(marks,parent)=>{
    const m=marks.find(x=>x.type.name==='textStyle'),a=m?m.attrs:{};
    sz.add(a.fontSize||base(parent));ff.add(a.fontFamily||'');cl.add(a.color||'');bg.add(a.backgroundColor||'');
  };
  if(sel.empty||sel.node){take(sel.empty?(st.storedMarks||sel.$from.marks()):(sel.node.marks||[]),sel.$from.parent);blk(sel.$from.parent)}
  else st.doc.nodesBetween(sel.from,sel.to,(n,pos,parent)=>{
    if(n.isTextblock){
      if(sel.to<=pos+1)return false;   /* маркирането само докосва началото на реда – той не е вътре */
      blk(n);
      if(n.childCount===0)sz.add(base(n));   /* празен ред: има размер, макар и без текст */
      return true;
    }
    if(n.isText&&n.text.length)take(n.marks,parent);
  });
  const one=x=>x.size===1?[...x][0]:null;
  return {size:one(sz),font:one(ff),color:one(cl),bg:one(bg),block:one(bk)};
}
/* бутоните „Отмяна“ и „Повтори“ се търсят при всяко извикване: функцията се вика и при първото зареждане на текста, преди тази част да е изпълнена */
function histBtns(){const u=$('#fmt [data-act="undo"]'),r=$('#fmt [data-act="redo"]');if(u)u.disabled=!tt.can().undo();if(r)r.disabled=!tt.can().redo()}
function blankTools(){sizeSel.selectedIndex=-1;fontSel.selectedIndex=-1;blockSel.selectedIndex=-1;syncSz()}
function updateFmt(){
  const on=(c,v)=>{const b=$(`[data-cmd="${c}"]`);if(b)b.classList.toggle('on',!!v)};
  const sel=tt.state.selection,bl=sel.$from.parent,al=(bl.attrs&&bl.attrs.textAlign)||'left';
  on('bold',tt.isActive('bold'));on('italic',tt.isActive('italic'));on('underline',tt.isActive('underline'));on('strike',tt.isActive('strike'));on('note',tt.isActive('note'));on('caps',tt.isActive('textStyle',{textTransform:'uppercase'}));
  on('ul',tt.isActive('bulletList'));on('ol',tt.isActive('orderedList'));
  on('justifyLeft',al==='left');on('justifyCenter',al==='center');on('justifyRight',al==='right');
  {const b=$('[data-act="bm"]'),isb=bl.isTextblock&&/^[\s ]*~/.test(bl.textContent);b.classList.toggle('on',isb);b.title=isb?t('Remove bookmark from line (~)'):t('Add a bookmark to this line (Alt+~)')}
  if(editorEmpty()){fmtSel={c:null,b:null};blankTools();return}
  const si=selInfo();
  fmtSel={c:si.color,b:si.bg};   /* цветът на маркираното се показва в палитрата; лентичката под бутона остава последно избрания цвят */
  if(si.block==null)blockSel.selectedIndex=-1;else blockSel.value=si.block;   /* различни типове редове в маркираното */
  sizeSel.querySelectorAll('option[data-tmp]').forEach(o=>o.remove());
  if(si.size==null)sizeSel.selectedIndex=-1;   /* различни размери в маркираното */
  else{
    const pt=Math.round(si.size*0.75*2)/2;
    if(![...sizeSel.options].some(o=>+o.value===pt)){   /* размер извън списъка (напр. от поставен текст) се показва точно */
      const o=document.createElement('option');o.value=pt;o.textContent=pt;o.dataset.tmp='1';
      const nx=[...sizeSel.options].find(x=>+x.value>pt);sizeSel.insertBefore(o,nx||null);
    }
    sizeSel.value=pt;
  }
  syncSz();
  if(si.font===null&&tt.state.selection.empty===false)fontSel.selectedIndex=-1;
  else{const f=(si.font||'').split(',')[0].replace(/["']/g,'').trim();fontSel.value=FONTS.some(x=>x[0]===f)?f:S.font}
}
/* празен редактор → инструментите за текст нямат стойност; със заредения текст се връщат към основните */
function syncTools(){updateFmt();try{histBtns()}catch(e){oops('syncTools#1',e)}}
let fmtRaf=0;
tt.on('transaction',()=>{if(fmtRaf)return;fmtRaf=requestAnimationFrame(()=>{fmtRaf=0;updateFmt();histBtns();syncImg()})});

/* отметка на реда: слага или маха ~ в началото на реда, където е курсорът (същото като да се напише ръчно) */
function markLine(){
  const st=tt.state,$f=st.selection.$from;
  if(!$f.parent.isTextblock){tt.commands.focus();toast(t('Place the cursor on the line for the bookmark.'));return}
  const start=$f.start(),txt=$f.parent.textContent,m=TILDE.exec(txt);
  const tr=st.tr;
  if(/^[\s ]*~/.test(txt)&&m)tr.delete(start,start+m[0].length);
  else tr.insertText('~',start);
  tt.view.dispatch(tr);tt.view.focus();
}


/* Бележка за четящия: [пауза], [аплодисменти]… Скобите и цветът се слагат сами. Без маркиране вмъква [] с курсор вътре,
   с маркиране обгражда маркирания текст, а върху вече поставена бележка я маха (заедно със скобите).
   Цветът е общ (Настройки на лентата) и важи за всички бележки, затова смяната му ги оцветява наново. */
function noteRanges(parent,start){
  const nt=tt.state.schema.marks.note,rs=[];
  parent.forEach((n,o)=>{
    const a=start+o,b=a+n.nodeSize;
    if(n.isText&&n.marks.some(m=>m.type===nt)){const l=rs[rs.length-1];if(l&&l.to===a)l.to=b;else rs.push({from:a,to:b})}
  });
  return rs;
}
function noteToggle(){
  if(typeof reading!=='undefined'&&reading)return;
  const st=tt.state,nt=st.schema.marks.note,sel=st.selection,$f=sel.$from;
  if(!nt)return;
  if(!$f.parent.isTextblock){tt.commands.focus();toast(t('Place the cursor in the text.'));return}
  const hit=noteRanges($f.parent,$f.start()).find(r=>sel.empty?(sel.from>r.from&&sel.from<r.to):(r.from<=sel.to&&r.to>=sel.from));
  const tr=st.tr;let a,b;
  if(hit){
    const txt=st.doc.textBetween(hit.from,hit.to);
    tr.removeMark(hit.from,hit.to,nt);
    if(txt.endsWith(']'))tr.delete(hit.to-1,hit.to);
    if(txt.startsWith('['))tr.delete(hit.from,hit.from+1);
    a=b=null;
  }else if(sel.empty){
    tr.insertText('[]',sel.from);tr.addMark(sel.from,sel.from+2,nt.create());
    a=b=sel.from+1;
  }else{
    const f=sel.from,e=sel.to;
    tr.insertText(']',e);tr.insertText('[',f);tr.addMark(f,e+2,nt.create());
    a=f+1;b=e+1;
  }
  tt.view.dispatch(tr);
  if(a!=null)tt.commands.setTextSelection({from:a,to:b});
  tt.view.focus();
}
/* Ctrl+~ (клавишът под Esc, на всяка подредба) */
document.addEventListener('keydown',e=>{
  const ed=document.activeElement&&document.activeElement.closest&&document.activeElement.closest('#editor');
  if(!ed||e.isComposing)return;
  if((e.ctrlKey||e.metaKey)&&!e.altKey&&e.code==='Backquote'){e.preventDefault();e.stopPropagation();noteToggle()}
  /* Alt+~ слага или маха отметка на реда с курсора; Shift+~ и буквите (напр. Ч) пишат нормално */
  else if(e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&e.code==='Backquote'){e.preventDefault();e.stopPropagation();markLine()}
},true);

/* Изчистване на форматирането: засегнатите редове (маркираните, а без маркиране - редът с курсора) стават обикновени параграфи
   без удебеляване, курсив, цветове, размери, шрифтове и подравняване. Текстът и знакът ~ на отметките остават. */
function clearFormat(){
  const sel=tt.state.selection;let off=-1;
  const ch=tt.chain().focus();
  if(sel.empty){const $f=sel.$from;off=$f.parentOffset;ch.setTextSelection({from:$f.start(),to:$f.end()===$f.start()?$f.start():$f.end()})}
  ch.unsetAllMarks().clearNodes().unsetTextAlign().resetAttributes('paragraph','blockSize').run();
  if(off>=0)tt.commands.setTextSelection(Math.min(tt.state.selection.from+off,tt.state.doc.content.size));
}
