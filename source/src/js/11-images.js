/* ---------- Картинки ---------- */
const readDataURL=f=>new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(f)});
const loadImage=src=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src});
async function insertImageFile(f){
  if(!/^image\/(png|jpeg|gif|webp)$/.test(f.type)){toast(t('Supported: .png, .jpg, .gif and .webp.'),true);return}
  if(f.size>12*1024*1024){toast(t('The picture is too large.'),true);return}
  try{
    let src=await readDataURL(f);
    const im=await loadImage(src),MAXW=1600;
    if(im.naturalWidth>MAXW&&f.type!=='image/gif'){   /* много големите картинки се намаляват, за да не препълнят записа */
      const c=document.createElement('canvas');c.width=MAXW;c.height=Math.round(im.naturalHeight*MAXW/im.naturalWidth);
      c.getContext('2d').drawImage(im,0,0,c.width,c.height);
      src=c.toDataURL(f.type==='image/jpeg'?'image/jpeg':'image/png',.9);
    }
    if(src.length>IMG_MAXLEN){toast(t('The picture is too large.'),true);return}
    TPEd.insertImage(tt,src);
    syncImg();
  }catch(e){toast(t('The picture cannot be read.'),true)}
}
/* избрана картинка: рамка, лента с размери/подравняване и ъгъл за влачене (картинката е избран възел в ProseMirror) */
let selImg=null,selImgPos=-1;
const imgTool=document.createElement('div');imgTool.id='imgTool';
imgTool.innerHTML='<div id="imgBar"></div><div id="imgGrip"></div>';
document.body.appendChild(imgTool);
const imgBar=imgTool.firstChild,imgGrip=imgTool.lastChild;
[['w','25','25%'],['w','50','50%'],['w','75','75%'],['w','100','100%'],['sep'],['a','left','alL','Align left'],['a','center','alC','Center'],['a','right','alR','Align right'],['sep'],['del','','trash','Delete picture']].forEach(([k,v,x,ti])=>{
  if(k==='sep'){const s=document.createElement('span');s.className='sep';imgBar.appendChild(s);return}
  const b=document.createElement('button');b.type='button';b.className='ib';b.dataset.k=k;b.dataset.v=v;
  b._tt=()=>k==='w'?t('Width {n}',{n:x}):t(ti);   /* подсказката се превежда наново при смяна на езика */
  if(k==='w')b.textContent=x;
  else{const i=document.createElement('i');i.dataset.ic=x;i.innerHTML=svg(x);b.appendChild(i)}
  b.title=b._tt();
  imgBar.appendChild(b);
});
function syncImg(){
  const s=tt.state.selection;
  if(s instanceof TPEd.NodeSelection&&s.node.type.name==='image'){selImgPos=s.from;selImg=tt.view.nodeDOM(s.from)}
  else{selImg=null;selImgPos=-1}
  posImgTool();
}
function posImgTool(){
  if(!selImg||!selImg.isConnected||!editor.contains(selImg)){imgTool.classList.remove('on');selImg=null;return}
  if(reading||!editor.offsetParent){imgTool.classList.remove('on');selImg=null;return}   /* на цял екран и когато редакторът е скрит рамката не се показва */
  const r=selImg.getBoundingClientRect(),er=editorWrap.getBoundingClientRect();
  if(r.bottom<er.top+10||r.top>er.bottom-10){imgTool.classList.remove('on');return}
  Object.assign(imgTool.style,{left:r.left-2+'px',top:r.top-2+'px',width:r.width+4+'px',height:r.height+4+'px'});
  imgTool.classList.toggle('below',r.top<er.top+60);
  imgTool.classList.add('on');
}
function imgWidth(w){
  const n=selImgPos>=0&&tt.state.doc.nodeAt(selImgPos);if(!n||n.type.name!=='image')return;
  const tr=tt.state.tr.setNodeMarkup(selImgPos,undefined,{...n.attrs,width:w});
  tr.setSelection(TPEd.NodeSelection.create(tr.doc,selImgPos));tt.view.dispatch(tr);
}
imgBar.addEventListener('mousedown',e=>e.preventDefault());
imgBar.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b||!selImg)return;
  if(b.dataset.k==='w')imgWidth(b.dataset.v+'%');
  else if(b.dataset.k==='a')tt.chain().focus().setTextAlign(b.dataset.v).run();
  else if(b.dataset.k==='del'){tt.chain().focus().deleteSelection().run();selImg=null}
  syncImg();
});
let gripD=null;
imgGrip.addEventListener('pointerdown',e=>{
  if(!selImg)return;e.preventDefault();imgGrip.setPointerCapture(e.pointerId);
  gripD={x:e.clientX,w:selImg.getBoundingClientRect().width,pw:Math.max(1,(selImg.parentElement||editor).clientWidth),pct:null};
});
imgGrip.addEventListener('pointermove',e=>{
  if(!gripD||!selImg)return;
  const pct=Math.min(100,Math.max(5,(gripD.w+e.clientX-gripD.x)/gripD.pw*100));
  gripD.pct=pct.toFixed(1)+'%';selImg.style.width=gripD.pct;posImgTool();
});
const gripEnd=()=>{if(!gripD)return;const p=gripD.pct;gripD=null;if(p)imgWidth(p);syncImg()};
imgGrip.addEventListener('pointerup',gripEnd);imgGrip.addEventListener('pointercancel',gripEnd);
editorWrap.addEventListener('scroll',posImgTool);
window.addEventListener('resize',posImgTool);
$('#imgFile').addEventListener('change',e=>{const f=e.target.files[0];e.target.value='';if(f)insertImageFile(f)});

histBtns();
const FMT_CMD={bold:c=>c.toggleBold(),italic:c=>c.toggleItalic(),underline:c=>c.toggleUnderline(),strike:c=>c.toggleStrike(),caps:c=>c.toggleCaps(),
  ul:c=>c.toggleBulletList(),ol:c=>c.toggleOrderedList(),
  justifyLeft:c=>c.setTextAlign('left'),justifyCenter:c=>c.setTextAlign('center'),justifyRight:c=>c.setTextAlign('right')};
$('#fmt').addEventListener('mousedown',e=>{if(e.target.closest('button'))e.preventDefault()});
$('#fmt').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.cmd&&FMT_CMD[b.dataset.cmd])FMT_CMD[b.dataset.cmd](tt.chain().focus()).run();
  else if(b.dataset.act==='undo')tt.chain().focus().undo().run();
  else if(b.dataset.act==='redo')tt.chain().focus().redo().run();
  else if(b.dataset.act==='bm')markLine();
      else if(b.dataset.act==='note')noteToggle();
  else if(b.dataset.act==='clear')clearFormat();
  else if(b.dataset.act==='img')$('#imgFile').click();
  updateFmt();histBtns();
});

/* Палитра за цветове */
const SW=['#ffffff','#ffe66d','#ffb547','#ff7a59','#ff5c7e','#c58bff','#7c9cff','#4fd1ff','#14eac1','#8be28b','#b8b8b8','#000000'];
const pal=$('#pal');let palCb=null;
function normHex(v){v=String(v||'').trim().replace(/^#/,'');if(/^[0-9a-f]{3}$/i.test(v))v=v.replace(/./g,'$&$&');return /^[0-9a-f]{6}$/i.test(v)?'#'+v.toLowerCase():null}
function toHex(c){const m=String(c).match(/[\d.]+/g);if(!m||m.length<3)return null;return '#'+m.slice(0,3).map(x=>Math.round(+x).toString(16).padStart(2,'0')).join('')}
var fmtSel=fmtSel||{c:null,b:null};
/* съвременен избор на цвят: квадрат за наситеност и яркост, лента за нюанс, шестнадесетичен код (единствената показвана стойност), пипета и готови цветове.
   live: цветът се прилага докато се влачи (настройките); иначе – при „OK“, шестнадесетичен код с Enter или щракване върху готов цвят (лентата на редактора) */
let palDragT=0,palAnchor=null;
const hex2hsv=hx=>{const [r,g,b]=hexRGB(hx).map(x=>x/255),mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d+6)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}return{h,s:mx?d/mx:0,v:mx}};
const hsv2hex=({h,s,v})=>{const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return '#'+[f(5),f(3),f(1)].map(x=>Math.round(x*255).toString(16).padStart(2,'0')).join('')};
function openPal(anchor,cb,allowNone,cur,sel,live){
  if(!pal.hidden&&palAnchor===anchor){closePal();return}   /* повторно натискане на същия шеврон/бутон затваря палитрата */
  palAnchor=anchor;palCb=cb;
  const hx6=v=>normHex(v)||(v?toHex(v):null),selH=hx6(sel);if(selH)cur=selH;
  const h0=hx6(cur);   /* цветът при отваряне: в прегледа е лявата половина */
  let hsv=hex2hsv(h0||'#ffffff'),now=h0||'#ffffff',raf=0;
  pal.innerHTML='<div class="cp-sv" tabindex="0" role="slider" aria-label="'+t('Saturation and brightness')+'"><i class="cp-knob"></i></div>'
    +'<div class="cp-hue" tabindex="0" role="slider" aria-label="'+t('Hue')+'" aria-valuemin="0" aria-valuemax="360"><i class="cp-ht"></i></div>'
    +'<div class="cp-row"><i class="cp-prev"></i>'
    +'<input type="text" class="hex" maxlength="7" placeholder="#RRGGBB" autocapitalize="off" autocomplete="off" spellcheck="false" aria-label="'+t('Color (#RRGGBB)')+'">'
    +(window.EyeDropper?'<button type="button" class="cp-eye" title="'+t('Eyedropper')+'" aria-label="'+t('Eyedropper')+'">'+svg('pipette')+'</button>':'')+'</div>'
    +'<div class="sw"></div>';
  const sv=pal.querySelector('.cp-sv'),knob=sv.firstChild,hue=pal.querySelector('.cp-hue'),ht=hue.firstChild,prev=pal.querySelector('.cp-prev'),hx=pal.querySelector('.hex');
  const send=()=>{raf=0;if(live&&palCb===cb)cb(now)};   /* закъснял кадър от предишна палитра не вика новата функция */
  const paint=(fromHex,init)=>{
    now=init&&h0?h0:hsv2hex(hsv);   /* при отваряне цветът остава точно какъвто е (без закръгляне) */
    sv.style.backgroundColor=hsv2hex({h:hsv.h,s:1,v:1});
    knob.style.left=hsv.s*100+'%';knob.style.top=(1-hsv.v)*100+'%';knob.style.background=now;
    ht.style.left=hsv.h/360*100+'%';ht.style.background=hsv2hex({h:hsv.h,s:1,v:1});
    hue.setAttribute('aria-valuenow',Math.round(hsv.h));
    prev.style.background=h0?'linear-gradient(90deg,'+h0+' 50%,'+now+' 50%)':now;
    if(!fromHex){hx.value=now.toUpperCase();hx.classList.remove('bad')}
    g.querySelectorAll('button').forEach(b=>b.classList.toggle('cur',b.dataset.c===now));
    if(live&&!init&&!raf)raf=requestAnimationFrame(send);
  };
  const drag=(el,fn)=>{
    el.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();el.focus({preventScroll:true});el.setPointerCapture(e.pointerId);
      const mv=ev=>{const r=el.getBoundingClientRect();fn(Math.min(1,Math.max(0,(ev.clientX-r.left)/r.width)),Math.min(1,Math.max(0,(ev.clientY-r.top)/r.height)))};
      const up=()=>{el.removeEventListener('pointermove',mv);el.removeEventListener('pointerup',up);el.removeEventListener('pointercancel',up);palDragT=Date.now()};
      el.addEventListener('pointermove',mv);el.addEventListener('pointerup',up);el.addEventListener('pointercancel',up);mv(e);
    });
  };
  drag(sv,(x,y)=>{hsv.s=x;hsv.v=1-y;paint()});
  drag(hue,x=>{hsv.h=x*360;if(hsv.h>=360)hsv.h=359.99;paint()});
  /* клавиатура: стрелките местят с малка стъпка, със Shift – с голяма */
  sv.addEventListener('keydown',e=>{const d=e.shiftKey?.1:.02;let ok=true;
    if(e.key==='ArrowLeft')hsv.s=Math.max(0,hsv.s-d);else if(e.key==='ArrowRight')hsv.s=Math.min(1,hsv.s+d);
    else if(e.key==='ArrowUp')hsv.v=Math.min(1,hsv.v+d);else if(e.key==='ArrowDown')hsv.v=Math.max(0,hsv.v-d);else ok=false;
    if(ok){e.preventDefault();paint()}});
  hue.addEventListener('keydown',e=>{const d=e.shiftKey?10:2;let ok=true;
    if(e.key==='ArrowLeft'||e.key==='ArrowDown')hsv.h=Math.max(0,hsv.h-d);else if(e.key==='ArrowRight'||e.key==='ArrowUp')hsv.h=Math.min(359.99,hsv.h+d);else ok=false;
    if(ok){e.preventDefault();paint()}});
  /* шестнадесетичният код: валиден код сменя цвета веднага; Enter го потвърждава */
  const fromHexStr=v=>{const n=normHex(v);if(!n)return false;const k=hex2hsv(n);if(k.s===0||k.v===0)k.h=hsv.h;hsv=k;paint(true);return true};
  hx.addEventListener('input',()=>{const v=hx.value.trim();hx.classList.toggle('bad',!!v&&!fromHexStr(v)&&v.replace('#','').length>=6)});
  const done=()=>{if(palCb===cb)cb(now);closePal()};
  hx.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();if(normHex(hx.value)){fromHexStr(hx.value);done()}else hx.classList.add('bad')}});
  const eye=pal.querySelector('.cp-eye');
  if(eye)eye.addEventListener('click',()=>{try{new EyeDropper().open().then(r=>{fromHexStr(r.sRGBHex)}).catch(e=>{oops('done#1',e)})}catch(e){oops('done#2',e)}});
  const g=pal.querySelector('.sw');
  SW.forEach(c=>{const b=document.createElement('button');b.type='button';b.style.background=c;b.title=c;b.dataset.c=c;b.addEventListener('click',()=>{palCb(c);closePal()});g.appendChild(b)});
  /* Отказ: затваря, без да приема; ако цветът вече е приложен на живо (Настройки), връща началния */
  const cancel=()=>{if(raf){cancelAnimationFrame(raf);raf=0}if(live&&h0&&palCb===cb&&now!==h0)cb(h0);closePal()};
  const acts=document.createElement('div');acts.className='cp-acts';
  const cn=document.createElement('button');cn.type='button';cn.className='btn cp-cancel';cn.textContent=t('Cancel');cn.addEventListener('click',cancel);
  const ok=document.createElement('button');ok.type='button';ok.className='btn primary cp-ok';ok.textContent='OK';ok.addEventListener('click',done);
  acts.append(ok,cn);pal.appendChild(acts);
  if(allowNone){const n=document.createElement('button');n.type='button';n.className='none';n.textContent=t('No highlight');n.addEventListener('click',()=>{palCb('transparent');closePal()});pal.appendChild(n)}
  paint(false,true);
  const r=anchor.getBoundingClientRect();pal.hidden=false;
  const ph=pal.offsetHeight,pw=pal.offsetWidth;
  pal.style.top=(r.bottom+6+ph>innerHeight?Math.max(8,r.top-ph-6):r.bottom+6)+'px';pal.style.left=Math.max(8,Math.min(r.left,innerWidth-pw-8))+'px';
}
function closePal(){pal.hidden=true;palCb=null;palAnchor=null}
/* бутоните за цвят и фон помнят последния избор: щракване върху бутона го прилага, а шевронът отваря останалите цветове */
const lsGet=(k,d)=>{try{return localStorage.getItem(k)||d}catch(e){return d}},lsSet=(k,v)=>{try{localStorage.setItem(k,v)}catch(e){oops('lsGet#1',e)}};
let curColor=normHex(lsGet('tp.fmtColor',''))||'#ffe66d',curHi=normHex(lsGet('tp.fmtHi',''))||'#ffb547';
$('#colorChip').style.background=curColor;$('#hiChip').style.background=curHi;
const setColor=c=>{const h=normHex(c)||c;curColor=h;$('#colorChip').style.background=h;lsSet('tp.fmtColor',h);edColor(h)};
const setHi=c=>{if(c==='transparent'){edHi(c);return}const h=normHex(c)||c;curHi=h;$('#hiChip').style.background=h;lsSet('tp.fmtHi',h);edHi(h)};   /* „Без фон“ маха фона, но запазва последния цвят */
$('#bColor').addEventListener('click',e=>{e.stopPropagation();closePal();setColor(curColor)});
$('#bColorMore').addEventListener('click',e=>{e.stopPropagation();openPal(e.currentTarget.parentElement,setColor,false,curColor,fmtSel.c)});
$('#bHi').addEventListener('click',e=>{e.stopPropagation();closePal();setHi(curHi)});
$('#bHiMore').addEventListener('click',e=>{e.stopPropagation();openPal(e.currentTarget.parentElement,setHi,true,curHi,fmtSel.b)});
$('#bNoteMore').addEventListener('click',e=>{e.stopPropagation();openPal(e.currentTarget.parentElement,c=>set('noteColor',normHex(c)||c),false,S.noteColor||'#4dd6ff')});
/* настройките с цвят: бутон, който отваря същата палитра като в лентата за форматиране */
function colorButton(inp){
  const proto=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value');
  const btn=document.createElement('button');btn.type='button';btn.className='cbtn';
  const sw=document.createElement('i');btn.append(sw);
  /* името е от изходния (английски) текст на етикета и се превежда при всяка смяна на езика */
  const name=(()=>{const pe=inp.parentElement;if(!pe)return '';let r='';const w=document.createTreeWalker(pe,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode()))r+=n.__src!==undefined?n.__src:n.nodeValue;return r.trim()})()||'Color';
  const cur=()=>proto.get.call(inp);
  /* в панела се вижда само квадратчето; кодът се чете при отворена палитра или от екранния четец */
  const sync=()=>{const v=cur();sw.style.background=v||'transparent';btn.setAttribute('aria-label',v?t(name)+' ('+String(v).toUpperCase()+')':t(name))};btn._sync=sync;
  inp.type='hidden';
  Object.defineProperty(inp,'value',{get(){return proto.get.call(inp)},set(v){proto.set.call(inp,v);sync()},configurable:true});   /* настройките се попълват програмно */
  if(inp.id){btn.id=inp.id+'Btn';const l=document.querySelector('label[for="'+inp.id+'"]');if(l)l.setAttribute('for',btn.id)}
  btn.addEventListener('click',e=>{
    e.stopPropagation();
    openPal(btn,c=>{
      const v=normHex(c);if(!v)return;
      if(v!==cur()){proto.set.call(inp,v);inp.dispatchEvent(new Event('input',{bubbles:true}));inp.dispatchEvent(new Event('change',{bubbles:true}))}
      sync();
    },false,cur(),null,true);
  });
  inp.after(btn);sync();
}
$$('input[type=color]').forEach(colorButton);
/* Настройки → Връзка: размерът на QR кода (Монитор) и на четеца (Дистанционно) е 80% от свободната височина между описанието и адреса;
   останалите 20% са поравно отгоре и отдолу. Ако свободното място е твърде малко (напр. телефон в пейзаж), размерът е най-малкият четим – 120. */
{const body=$('#setBody'),st=$('#settings');let busy=false;
 const fit=()=>{if(busy)return;busy=true;try{
   if(body.dataset.tab!=='conn'||!st.classList.contains('open')){return}
   const host=!!$('#netHostSec').offsetParent;
   const sec=host?$('#netHostSec'):$('#netCliSec');
   const desc=host?($('#netHostDesc').hidden?$('#netHostNoSupport'):$('#netHostDesc')):$('#netCliDesc');
   const sqEl=host?sec.querySelector('.rm-qrwrap'):($('#netCliCam').hidden?sec.querySelector('.net-cli-ph-cam'):$('#netCliCam'));if(!desc||!sqEl||!sqEl.offsetParent)return;
   const br=body.getBoundingClientRect(),pb=parseFloat(getComputedStyle(body).paddingBottom)||0,sr=sec.getBoundingClientRect();
   const free=(br.bottom-pb)-sr.top-(sr.height-sqEl.getBoundingClientRect().height);   /* видимата височина минус всичко друго в раздела */
   const w=sec.clientWidth;let sq=Math.floor(Math.min(free*0.8,w)/8)*8;   /* на стъпки от 8, за да не трепти с 1–2 точки при всяко отваряне */
   if(!(sq>=120))sq=Math.min(120,w);   /* под 120 кодът се чете трудно: остава 120, а разделът се превърта */
   st.style.setProperty('--net-sq',sq+'px');
 }finally{busy=false}};
 const run=()=>requestAnimationFrame(fit);
 new ResizeObserver(run).observe(body);
 new MutationObserver(run).observe(st,{attributes:true,subtree:true,attributeFilter:['class','hidden','style','data-tab']});
 addEventListener('resize',run)}
/* Настройки, „+“ и „−“: след щракване бутонът се връща без фон; фонът при посочване се появява пак, когато мишката излезе и влезе отново */
$$('#settings .step .ib').forEach(b=>{b.addEventListener('click',()=>b.classList.add('noh'));b.addEventListener('pointerleave',()=>b.classList.remove('noh'))});
document.addEventListener('click',e=>{if(!pal.hidden&&!pal.contains(e.target)&&Date.now()-palDragT>300)closePal();if(!e.target.closest('.menuwrap'))$$('.menuwrap .menu').forEach(m=>m.hidden=true)});
