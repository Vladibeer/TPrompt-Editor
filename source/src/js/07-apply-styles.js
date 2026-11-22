/* ---------- Прилагане на стилове ---------- */
function applyStyles(){
  const frac=reading&&maxPos>0?pos/maxPos:0;
  const r=document.documentElement.style;
  const P=S,fnt=fam(S.font);
  r.setProperty('--pfs',P.fs+'px');r.setProperty('--plh',P.lh);r.setProperty('--ppg',(P.pgap!=null?P.pgap:.6)+'em');r.setProperty('--pw',P.width+'%');
  r.setProperty('--pcolor',P.color);r.setProperty('--pbg',P.bg);r.setProperty('--pfont',fnt);
  r.setProperty('--note',P.noteColor||'#4dd6ff');{const nc=document.getElementById('noteChip');if(nc)nc.style.background=P.noteColor||'#4dd6ff'}r.setProperty('--mk',P.markerColor);r.setProperty('--mkY',P.markerY+'%');r.setProperty('--mkH',P.markerH+'px');
  const [R,G,B]=hexRGB(P.bg);r.setProperty('--dim',`rgba(${R},${G},${B},${P.dim/100})`);
  stageXf();
  prompter.classList.toggle('mk',!!P.marker);
  editor.spellcheck=!!S.spell;
  hud.classList.toggle('noprog',!S.progress);$('#rBar2').classList.toggle('noprog',!S.progress);document.body.classList.toggle('noprog',!S.progress);
  applyTheme();
  try{if(pvRendered)layoutPreview()}catch(e){oops('applyStyles#1',e)}
  if(reading){layout();pos=frac*maxPos;draw(true)}
}
const paintR=el=>{const mn=+el.min||0,mx=+el.max||100;el.style.setProperty('--p',Math.max(0,Math.min(100,(+el.value-mn)/(mx-mn)*100))+'%')};
document.addEventListener('input',e=>{if(e.target&&e.target.type==='range')paintR(e.target)},true);
function syncUI(){
  $$('[data-key]').forEach(el=>{
    const k=el.dataset.key;
    if(el.type==='checkbox')el.checked=!!S[k];
    else if(!(el===document.activeElement&&el.type==='number'))el.value=S[k];
  });
  $$('[data-out]').forEach(el=>{const k=el.dataset.out;el.textContent=k==='lh'?S.lh.toFixed(2):k==='markerH'?S.markerH+' px':S[k]+'%'});
  $$('[data-toggle]').forEach(b=>b.setAttribute('aria-pressed',String(!!S[b.dataset.toggle])));
  { const ts=$('#themeSel'); if(ts) ts.value=S.theme; const ss=$('#startSel'); if(ss) ss.value=S.startMode; }
  $('#cAcc').value=okHex(S.accent)?S.accent:'#6f5dff';
  $('#cUiBg').value=okHex(S.uiBg)?S.uiBg:(S.theme==='light'?'#eceefb':'#111214');
  $('#hMH').classList.toggle('on',S.mirrorH);$('#hMV').classList.toggle('on',S.mirrorV);$('#hMk').classList.toggle('on',S.marker);
  $('#hSpd').textContent=S.speed;$('#hFs').textContent=S.fs;
  try{updateRemote()}catch(e){oops('syncUI#1',e)}
  try{clWatch()}catch(e){oops('syncUI#2',e)}
  $$('input[type=range]').forEach(paintR);
  $('#mkgroup').classList.toggle('off',!S.marker);
  $('#tapHint').textContent=t(S.invert?'Double-tap the top edge: faster, the bottom edge: slower.':'Double-tap the top edge: slower, the bottom edge: faster.');
  $('#arrowHint').textContent=t(S.invert?'↑ speeds up, ↓ slows down. Step 5, with Shift 1.':'↑ slows down, ↓ speeds up. Step 5, with Shift 1.');
}
function set(k,v){if(k==='theme')S.uiBg='';S[k]=typeof v==='number'?clamp(k,v):v;saveS();applyStyles();syncUI();if(k==='lfPoll'){try{lfPollSet();if(v)lfPoll()}catch(e){oops('set#1',e)}}}
const bump=(k,d)=>{set(k,Math.round((S[k]+d)*100)/100)};

/* Контроли в страничната лента */
const fsel=$('#fontG');FONTS.forEach(([n])=>{const o=document.createElement('option');o.value=n;o.textContent=n;fsel.appendChild(o)});
$$('[data-key]').forEach(el=>{
  const k=el.dataset.key;
  const read=()=>el.type==='checkbox'?el.checked:(el.type==='number'||el.type==='range')?parseFloat(el.value):el.value;
  el.addEventListener('input',()=>{const v=read();if(typeof v==='number'&&isNaN(v))return;set(k,v)});
  el.addEventListener('change',()=>{const v=read();if(typeof v==='number'&&isNaN(v))return;set(k,v);if(el.type!=='checkbox')el.value=S[k];if(el.type==='range'||el.tagName==='SELECT'||el.type==='color')el.blur()});
  if(el.type==='number')el.addEventListener('keydown',e=>{if(e.key==='Enter')el.blur()});
});
$$('[data-bump]').forEach(b=>b.addEventListener('click',()=>bump(b.dataset.bump,parseFloat(b.dataset.d))));
$$('[data-toggle]').forEach(b=>b.addEventListener('click',()=>set(b.dataset.toggle,!S[b.dataset.toggle])));
