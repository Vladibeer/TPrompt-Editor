/* ---------- Почистване на поставен текст ---------- */
const BLOCK=new Set(['P','DIV','H1','H2','H3','H4','H5','H6','LI','UL','OL','BLOCKQUOTE','TABLE','TR','TD','TH','TBODY','THEAD','SECTION','ARTICLE','PRE']);
const IMG_OK=/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+\/=]+$/i,IMG_MAXLEN=6e6;
const SKIP=new Set(['SCRIPT','STYLE','META','LINK','TITLE','HEAD','SVG','IFRAME','OBJECT','NOSCRIPT','XML','CANVAS','VIDEO','AUDIO']);
const probe=document.createElement('span');probe.style.display='none';
function toRGBA(str){
  if(!str)return null;probe.style.color='';probe.style.color=str;if(!probe.style.color)return null;
  document.body.appendChild(probe);const c=getComputedStyle(probe).color;probe.remove();
  const m=c.match(/[\d.]+/g);return m?m.map(Number):null;
}
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)};return .2126*f(r)+.7152*f(g)+.0722*f(b)};
const contrast=(a,b)=>{const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
function parsePx(v){if(!v)return 0;const m=String(v).match(/^([\d.]+)(px|pt)?$/);if(!m)return 0;return parseFloat(m[1])*(m[2]==='pt'?4/3:1)}
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const textToHtml=t=>t.split(/\r?\n/).map(l=>`<p>${l.trim()?esc(l):'<br>'}</p>`).join('');

function sanitize(html,opt){
  opt=opt||{};const internal=!!opt.internal;
  const doc=new DOMParser().parseFromString(html,'text/html');
  const bgRGB=hexRGB(S.bg);
  const out=document.createElement('div');
  const SIZEMAP={1:60,2:80,3:100,4:125,5:150,6:200,7:300};

  function styleFor(n){
    const s=n.style,tag=n.tagName,css=[];
    let col=(s&&s.color)||(tag==='FONT'?n.getAttribute('color'):'');
    /* изрично зададен цвят се пази точно; само почти черно и почти бяло (какъвто е „автоматичният“ цвят в документите) се пропуска, когато не се чете на фона на приложението */
    if(col){const c=toRGBA(col);if(c&&c[3]!==0){const auto=Math.max(c[0],c[1],c[2])<=50||Math.min(c[0],c[1],c[2])>=205;if(internal||!auto||contrast(c,bgRGB)>=2.5)css.push('color:'+col)}}
    const bg=s&&s.backgroundColor;
    if(bg){const c=toRGBA(bg);if(c&&c[3]!==0&&(internal||lum(c)<.92))css.push('background-color:'+bg)}
    let ff=(s&&s.fontFamily)||(tag==='FONT'?n.getAttribute('face'):'');
    if(ff){
      const first=ff.split(',')[0].replace(/["']/g,'').trim();
      if(first&&/^[\p{L}\p{N} _.\-]{1,40}$/u.test(first)&&first.toLowerCase()!==String(S.font).toLowerCase()&&!/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|inherit|initial)$/i.test(first))css.push(`font-family:${fam(first)}`.replace(/"/g,"'"));
    }
    let px=parsePx(s&&s.fontSize);
    if(!px&&tag==='FONT'&&n.getAttribute('size'))px=BASE*(SIZEMAP[n.getAttribute('size')]||100)/100;
    if(px){
      px=Math.round(px*100)/100;
      if(px>=8&&Math.abs(px-BASE)>.3)css.push('font-size:'+px+'px');
    }
    if(s&&s.textTransform==='uppercase')css.push('text-transform:uppercase');
    return css.join(';');
  }
  function align(n){
    let a=(n.style&&n.style.textAlign)||n.getAttribute('align')||'';a=a.toLowerCase();
    return ['left','center','right','justify'].includes(a)?a:'';
  }
  function wrapFmt(n,el){
    let t=el;const s=n.style||{};
    const bold=/^(bold|[6-9]00)$/.test(s.fontWeight||'');
    const ital=s.fontStyle==='italic';
    const td=s.textDecorationLine||s.textDecoration||'';
    const mk=tag=>{const e=document.createElement(tag);t.appendChild(e);t=e};
    if(bold)mk('b');if(ital)mk('i');if(/underline/.test(td))mk('u');if(/line-through/.test(td))mk('s');
    return t;
  }
  function walk(src,dst){
    src.childNodes.forEach(n=>{
      if(n.nodeType===3){
        const t=n.textContent.replace(/[\s\u00a0]+/g,' ');
        if(!t.trim()&&(dst===out||/^(UL|OL)$/.test(dst.tagName)))return;
        dst.appendChild(document.createTextNode(t));return;
      }
      if(n.nodeType!==1)return;
      const tag=n.tagName;
      if(SKIP.has(tag)||tag.includes(':'))return;
      if(tag==='BR'){dst.appendChild(document.createElement('br'));return}
      if(tag==='IMG'){   /* само вградени картинки (data:), с ширина в % от колоната */
        const src=n.getAttribute('src')||'';
        if(src.length>IMG_MAXLEN||!IMG_OK.test(src))return;
        const im=document.createElement('img');im.setAttribute('src',src);
        const m=/^([\d.]+)%$/.exec((n.style&&n.style.width)||'');
        im.style.width=(m?Math.min(100,Math.max(5,parseFloat(m[1]))):60)+'%';
        let holder=dst;
        if(dst===out||/^(UL|OL)$/.test(dst.tagName)){holder=document.createElement('p');holder.setAttribute('style','text-align:center');dst.appendChild(holder)}
        holder.appendChild(im);return;
      }
      if(n.hasAttribute('data-tp')||/^(TABLE|TBODY|THEAD|TR|SECTION|ARTICLE)$/.test(tag)){walk(n,dst);return}
      if(tag==='DIV'&&[...n.children].some(c=>BLOCK.has(c.tagName))){walk(n,dst);return}
      if(tag==='UL'||tag==='OL'){const e=document.createElement(tag.toLowerCase());walk(n,e);if(e.childNodes.length)dst.appendChild(e);return}
      if(/^(P|DIV|H[1-6]|LI|BLOCKQUOTE|PRE|TD|TH)$/.test(tag)){
        const nt=/^H[1-6]$/.test(tag)?tag.toLowerCase():tag==='LI'?'li':'p';
        const e=document.createElement(nt);
        const st=styleFor(n);const al=align(n);
        const css=[];if(al)css.push('text-align:'+al);if(st)css.push(st);
        if(css.length)e.setAttribute('style',css.join(';'));
        walk(n,wrapFmt(n,e));
        if(!e.textContent.trim()&&!e.querySelector('br,img'))e.innerHTML='<br>';
        dst.appendChild(e);return;
      }
      const map={B:'b',STRONG:'b',I:'i',EM:'i',U:'u',S:'s',STRIKE:'s',DEL:'s',SUB:'sub',SUP:'sup'};
      if(map[tag]){const e=document.createElement(map[tag]);walk(n,e);dst.appendChild(e);return}
      if(n.hasAttribute('data-note')){const e=document.createElement('span');e.setAttribute('data-note','1');walk(n,e);dst.appendChild(e);return}
      const st=styleFor(n);
      const hasFmt=st||(n.style&&(/^(bold|[6-9]00)$/.test(n.style.fontWeight||'')||n.style.fontStyle==='italic'||/underline|line-through/.test(n.style.textDecorationLine||n.style.textDecoration||'')));
      if(!hasFmt){walk(n,dst);return}
      const e=document.createElement('span');if(st)e.setAttribute('style',st);
      walk(n,wrapFmt(n,e));dst.appendChild(e);
    });
  }
  walk(doc.body,out);
  return out.innerHTML.trim();
}

/* Поставяне: копирането и изрязването са на ProseMirror; външният HTML (Word, Google Docs, сайтове) минава през sanitize() */
TPEd.hooks.transformHTML=html=>{
  if(/data-pm-slice/.test(html))return html;   /* копирано от самия редактор – вече е чисто */
  return sanitize(html,{internal:html.includes('data-tp="1"')})||html;
};
TPEd.hooks.paste=e=>{
  const cd=e.clipboardData;if(!cd)return false;
  const f=cd.files&&cd.files[0];
  if(f&&/^image\//.test(f.type)){e.preventDefault();insertImageFile(f);return true}
  if(f&&/\.(docx|doc|odt|txt|rtf)$/i.test(f.name)){e.preventDefault();openFile(f);return true}
  const html=cd.getData('text/html'),txt=cd.getData('text/plain');
  if(html&&(/data-pm-slice/.test(html)||sanitize(html,{internal:html.includes('data-tp="1"')})))return false;
  /* HTML няма или нищо не е останало след почистването – поставя се обикновеният текст */
  e.preventDefault();
  if(!txt)return true;
  if(!/\n/.test(txt.replace(/\r?\n$/,'')))tt.view.dispatch(tt.state.tr.insertText(txt));
  else TPEd.insertHtml(tt,textToHtml(txt));
  return true;
};
['dragover','drop'].forEach(ev=>document.addEventListener(ev,e=>{
  if(reading)return;
  if(e.dataTransfer&&[...e.dataTransfer.types].includes('Files')){
    e.preventDefault();
    const f=ev==='drop'?e.dataTransfer.files[0]:null;
    if(!f)return;
    if(/^image\//.test(f.type)){
      if(e.target.closest&&e.target.closest('#editor')){const p=tt.view.posAtCoords({left:e.clientX,top:e.clientY});if(p)tt.commands.setTextSelection(p.pos)}
      insertImageFile(f);
    }else openFile(f);
  }
}));
