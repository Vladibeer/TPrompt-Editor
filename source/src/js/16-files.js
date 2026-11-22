/* ---------- Файлове ---------- */
function rtfToText(s){
  let out='',i=0,depth=0,skip=-1;const bytes=[];
  const flush=()=>{if(bytes.length){out+=new TextDecoder('windows-1251').decode(new Uint8Array(bytes));bytes.length=0}};
  while(i<s.length){
    const c=s[i];
    if(c==='{'){flush();depth++;i++;if(skip<0&&/^\\(\*|fonttbl|colortbl|stylesheet|info|pict|header|footer)/.test(s.slice(i,i+14)))skip=depth;continue}
    if(c==='}'){flush();if(depth===skip)skip=-1;depth--;i++;continue}
    if(c==='\\'){
      const n=s[i+1];
      if(n==="'"){if(skip<0)bytes.push(parseInt(s.slice(i+2,i+4),16));i+=4;continue}
      flush();
      if(n==='\\'||n==='{'||n==='}'){if(skip<0)out+=n;i+=2;continue}
      const m=s.slice(i).match(/^\\([a-zA-Z]+)(-?\d+)? ?/);
      if(m){
        const w=m[1],p=m[2];i+=m[0].length;
        if(skip<0){
          if(w==='par'||w==='line')out+='\n';else if(w==='tab')out+='\t';
          else if(w==='u'&&p!==undefined){let code=parseInt(p,10);if(code<0)code+=65536;out+=String.fromCharCode(code);if(s[i]==='\\'&&s[i+1]==="'")i+=4;else i++}
        }
        continue;
      }
      i+=2;continue;
    }
    if(c==='\n'||c==='\r'){i++;continue}
    flush();if(skip<0)out+=c;i++;
  }
  flush();return out;
}
/* .rtf → HTML с форматиране: удебелено, курсив, подчертано, зачеркнато, цвят, фон, размер и подравняване.
   Чете както файловете от TPrompt, така и тези от Word, LibreOffice и Google Docs. */
function rtfToHtml(src){
  let dec;try{const m=/\\ansicpg(\d+)/.exec(src.slice(0,600));dec=new TextDecoder('windows-'+(m?m[1]:'1251'))}catch(e){dec=new TextDecoder('windows-1251')}
  const colors=[],fonts={};let ctDepth=-1,ct={r:0,g:0,b:0,has:false},ftDepth=-1,ftCur=0,ftName='',pict=null;
  const pg={w:12240,l:1800,r:1800};   /* страница и полета (twips) – за ширината на картинките */
  const SKIP=/^\\(\*|stylesheet|info|pict|header|footer|listtable|listoverridetable|rsidtbl|themedata|colorschememapping|datastore|latentstyles|generator|xmlnstbl|mmathPr|nonshppict|shpinst)/;
  const zero={b:0,i:0,u:0,s:0,cf:0,hl:0,fs:0,f:-1,va:''};
  let st=Object.assign({},zero),al='',uc=1,depth=0,skip=-1,i=0;
  const stack=[],paras=[],bytes=[];let cur=[];
  const emit=t=>{
    if(!t)return;
    const l=cur[cur.length-1];
    if(l&&!l.br&&l.b===st.b&&l.i===st.i&&l.u===st.u&&l.s===st.s&&l.cf===st.cf&&l.hl===st.hl&&l.fs===st.fs&&l.f===st.f&&l.va===st.va){l.t+=t;return}
    cur.push(Object.assign({t},st));
  };
  const endPara=()=>{paras.push({al,runs:cur});cur=[]};
  const flush=()=>{if(bytes.length){if(skip<0)emit(dec.decode(new Uint8Array(bytes)));bytes.length=0}};
  while(i<src.length){
    const c=src[i];
    if(c==='{'){flush();depth++;stack.push({st:Object.assign({},st),uc});i++;
      if(skip<0){
        const rest=src.slice(i,i+24);
        if(/^\\colortbl/.test(rest)){ctDepth=depth;ct={r:0,g:0,b:0,has:false}}
        else if(/^\\fonttbl/.test(rest)){ftDepth=depth;ftName='';ftCur=0}
        else if(/^\\pict\b/.test(rest)){pict={depth,type:'',wg:0,hg:0,w:0,sx:100,hex:''}}
        else if(/^\\\*\\shppict/.test(rest)){/* картинка във Word: четем вътрешния \pict, а резервното копие \nonshppict се пропуска */}
        else if(SKIP.test(rest))skip=depth;
      }
      continue}
    if(c==='}'){flush();
      if(pict&&depth===pict.depth){
        if((pict.type==='png'||pict.type==='jpeg')&&pict.hex.length>=16&&pict.hex.length%2===0){
          let bin='';for(let k=0;k<pict.hex.length;k+=2)bin+=String.fromCharCode(parseInt(pict.hex.substr(k,2),16));
          const tw=Math.max(1,pg.w-pg.l-pg.r),wt=(pict.wg>0?pict.wg:pict.w*15)*pict.sx/100;
          cur.push({img:`data:image/${pict.type};base64,${btoa(bin)}`,pct:Math.max(5,Math.min(100,Math.round(wt/tw*100)))});
        }
        pict=null;
      }
      if(depth===ftDepth)ftDepth=-1;
      if(depth===skip)skip=-1;if(depth===ctDepth)ctDepth=-1;const t=stack.pop();if(t){st=t.st;uc=t.uc}depth=Math.max(0,depth-1);i++;continue}
    if(c==='\\'){
      const n=src[i+1];
      if(n==="'"){bytes.push(parseInt(src.slice(i+2,i+4),16)||0);i+=4;continue}
      flush();
      if(n==='\\'||n==='{'||n==='}'){if(skip<0)emit(n);i+=2;continue}
      if(n==='~'){if(skip<0)emit('\u00a0');i+=2;continue}
      if(n==='_'){if(skip<0)emit('-');i+=2;continue}
      if(n==='\n'||n==='\r'){if(skip<0)endPara();i+=2;continue}
      const m=/^\\([a-zA-Z]+)(-?\d+)? ?/.exec(src.slice(i,i+40));
      if(!m){i+=2;continue}
      const w=m[1],p=m[2]===undefined?undefined:parseInt(m[2],10);i+=m[0].length;
      if(w==='paperw'&&p>0)pg.w=p;else if(w==='margl'&&p!==undefined)pg.l=p;else if(w==='margr'&&p!==undefined)pg.r=p;
      if(pict&&depth>=pict.depth){
        if(w==='pngblip')pict.type='png';else if(w==='jpegblip')pict.type='jpeg';
        else if(w==='picwgoal')pict.wg=p||0;else if(w==='picw')pict.w=p||0;
        else if(w==='picscalex'&&p>0)pict.sx=p;
        continue;
      }
      if(ftDepth>=0&&depth>=ftDepth){   /* таблица с шрифтове: {\f0\fswiss Arial;} */
        if(w==='f'&&p!==undefined)ftCur=p;
        continue;
      }
      if(ctDepth===depth){   /* таблица с цветове: \red \green \blue */
        if(w==='red'){ct.r=p;ct.has=true}else if(w==='green'){ct.g=p;ct.has=true}else if(w==='blue'){ct.b=p;ct.has=true}
        continue;
      }
      if(skip>=0)continue;
      switch(w){
        case 'par':case 'row':endPara();break;
        case 'line':cur.push({br:true});break;
        case 'tab':case 'cell':emit(' ');break;
        case 'pard':al='';break;
        case 'plain':st=Object.assign({},zero);break;
        case 'b':st.b=p===0?0:1;break;
        case 'i':st.i=p===0?0:1;break;
        case 'ul':case 'uld':case 'uldb':case 'ulw':case 'ulth':st.u=p===0?0:1;break;
        case 'ulnone':st.u=0;break;
        case 'strike':case 'striked':st.s=p===0?0:1;break;
        case 'cf':st.cf=p||0;break;
        case 'highlight':st.hl=p||0;break;
        case 'fs':st.fs=p||0;break;
        case 'f':st.f=p===undefined?-1:p;break;
        case 'super':st.va='sup';break;
        case 'sub':st.va='sub';break;
        case 'nosupersub':st.va='';break;
        case 'qc':al='center';break;
        case 'qr':al='right';break;
        case 'qj':al='justify';break;
        case 'ql':al='left';break;
        case 'uc':uc=p===undefined?1:p;break;
        case 'emdash':emit('\u2014');break;
        case 'endash':emit('\u2013');break;
        case 'bullet':emit('\u2022');break;
        case 'lquote':emit('\u2018');break;
        case 'rquote':emit('\u2019');break;
        case 'ldblquote':emit('\u201c');break;
        case 'rdblquote':emit('\u201d');break;
        case 'u':
          if(p!==undefined){
            emit(String.fromCharCode(p<0?p+65536:p));
            for(let k=0;k<uc;k++){if(src[i]==='\\'&&src[i+1]==="'")i+=4;else if(src[i]!=='\\'&&src[i]!=='{'&&src[i]!=='}')i++}   /* знакът-заместител след \u */
          }
          break;
      }
      continue;
    }
    if(c==='\n'||c==='\r'){i++;continue}
    if(pict&&depth>=pict.depth){if(/[0-9a-fA-F]/.test(c)&&depth===pict.depth)pict.hex+=c;i++;continue}
    if(ftDepth>=0&&depth>=ftDepth){
      if(c===';'){if(ftName.trim())fonts[ftCur]=ftName.trim();ftName=''}else if(skip<0)ftName+=c;
      i++;continue;
    }
    if(ctDepth===depth){   /* ';' затваря един цвят; първият празен е „автоматичен“ */
      if(c===';'){colors.push(ct.has?'#'+[ct.r,ct.g,ct.b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join(''):null);ct={r:0,g:0,b:0,has:false}}
      i++;continue;
    }
    if(skip<0&&c.charCodeAt(0)<128)bytes.push(c.charCodeAt(0));   /* ASCII; всичко останало идва като \'hh или \u */
    i++;
  }
  flush();if(cur.length)endPara();
  const run=r=>{
    if(r.br)return '<br>';
    if(r.img)return `<img src="${r.img}" style="width:${r.pct}%">`;
    const css=[];
    if(r.f>=0&&fonts[r.f])css.push(`font-family:'${fonts[r.f].replace(/['"]/g,'')}'`);
    if(r.fs>0)css.push(`font-size:${Math.round(r.fs/2*4/3*100)/100}px`);   /* половин пунктове → px, както при .docx */
    if(r.cf&&colors[r.cf])css.push('color:'+colors[r.cf]);
    if(r.hl&&colors[r.hl])css.push('background-color:'+colors[r.hl]);
    if(r.b)css.push('font-weight:bold');if(r.i)css.push('font-style:italic');
    const td=[];if(r.u)td.push('underline');if(r.s)td.push('line-through');if(td.length)css.push('text-decoration:'+td.join(' '));
    const h=esc(r.t);let o=css.length?`<span style="${css.join(';')}">${h}</span>`:h;
    return r.va?`<${r.va}>${o}</${r.va}>`:o;
  };
  return paras.map(p=>`<p${p.al?` style="text-align:${p.al}"`:''}>${p.runs.map(run).join('')||'<br>'}</p>`).join('');
}
/* .docx → HTML със собствен четец (не зависи от мрежата). Дава Word-подобен HTML (pt, цветове, подчертаване,
   подравняване, списъци), който минава през същия sanitize() като при копи/пейст. */
async function zipRead(buf){
  const u=new Uint8Array(buf),dv=new DataView(buf);let e=-1;
  for(let i=u.length-22;i>=Math.max(0,u.length-65600);i--)if(dv.getUint32(i,true)===0x06054b50){e=i;break}
  if(e<0)throw new Error('zip');
  const n=dv.getUint16(e+10,true);let p=dv.getUint32(e+16,true);const files={};
  for(let k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)break;
    const meth=dv.getUint16(p+10,true),cs=dv.getUint32(p+20,true),nl=dv.getUint16(p+28,true),el=dv.getUint16(p+30,true),cl=dv.getUint16(p+32,true),lo=dv.getUint32(p+42,true);
    const name=new TextDecoder().decode(u.subarray(p+46,p+46+nl));
    files[name]={meth,cs,lo};p+=46+nl+el+cl;
  }
  const get=async name=>{
    const f=files[name];if(!f)return null;
    const lo=f.lo,start=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true);
    const raw=u.subarray(start,start+f.cs);
    if(f.meth===0)return raw;
    if(f.meth!==8)throw new Error('zip method');
    return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
  };
  return {has:n=>!!files[n],get,text:async n=>{const b=await get(n);return b?new TextDecoder().decode(b):null}};
}
async function docxToHtml(buf){
  const z=await zipRead(buf);
  const xml=s=>s?new DOMParser().parseFromString(s,'application/xml'):null;
  const docX=xml(await z.text('word/document.xml'));if(!docX)throw new Error('no document');
  const thX=xml(await z.text('word/theme/theme1.xml'));
  const TF={};if(thX){for(const k of ['major','minor']){const f=thX.getElementsByTagName('a:'+k+'Font')[0];const l=f&&f.getElementsByTagName('a:latin')[0];if(l)TF[k]=l.getAttribute('typeface')}}
  const stX=xml(await z.text('word/styles.xml')),numX=xml(await z.text('word/numbering.xml')),relX=xml(await z.text('word/_rels/document.xml.rels'));
  const kids=(el,n)=>{const r=[];if(el)for(const c of el.children)if(c.localName===n)r.push(c);return r};
  const kid=(el,n)=>kids(el,n)[0]||null;
  const A=(el,n)=>{if(!el)return null;const v=el.getAttribute('w:'+n);return v!==null?v:el.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main',n)};
  const on=el=>{if(!el)return undefined;const v=A(el,'val');return !(v==='0'||v==='false'||v==='off'||v==='none')};
  /* свойства на символи от един w:rPr */
  const HL={yellow:'#ffff00',green:'#00ff00',cyan:'#00ffff',magenta:'#ff00ff',blue:'#0000ff',red:'#ff0000',darkBlue:'#000080',darkCyan:'#008080',darkGreen:'#008000',darkMagenta:'#800080',darkRed:'#800000',darkYellow:'#808000',darkGray:'#808080',lightGray:'#c0c0c0',black:'#000000',white:'#ffffff'};
  const rp=r=>{
    const o={};if(!r)return o;
    let v;
    if((v=on(kid(r,'b')))!==undefined)o.b=v;
    if((v=on(kid(r,'i')))!==undefined)o.i=v;
    if((v=kid(r,'u')))o.u=A(v,'val')!=='none';
    if((v=on(kid(r,'strike')))!==undefined)o.s=v;
    if((v=on(kid(r,'dstrike')))!==undefined)o.s=v;
    if((v=kid(r,'color'))){const c=A(v,'val');o.color=(c&&/^[0-9a-f]{6}$/i.test(c))?'#'+c:null}
    if((v=kid(r,'sz'))){const h=parseFloat(A(v,'val'));if(h>0)o.sz=h/2}
    if((v=kid(r,'rFonts'))){let f=A(v,'ascii')||A(v,'hAnsi');const th=A(v,'asciiTheme')||A(v,'hAnsiTheme');if(!f&&th)f=/major/i.test(th)?TF.major:TF.minor;if(f)o.font=f}
    if((v=kid(r,'highlight'))){const h=A(v,'val');o.bg=HL[h]||null}
    else if((v=kid(r,'shd'))){const f=A(v,'fill');if(f&&/^[0-9a-f]{6}$/i.test(f))o.bg='#'+f}
    if((v=kid(r,'vertAlign'))){const a=A(v,'val');o.va=a==='superscript'?'sup':a==='subscript'?'sub':null}
    if((v=on(kid(r,'caps')))!==undefined)o.caps=v;
    return o;
  };
  /* стилове */
  const ST={};let defR={};
  if(stX){
    defR=rp(kid(kid(kid(stX.documentElement,'docDefaults'),'rPrDefault'),'rPr'));
    for(const s of kids(stX.documentElement,'style')){
      const id=A(s,'styleId');if(!id)continue;
      const pp=kid(s,'pPr'),nm=A(kid(s,'name'),'val')||'';
      ST[id]={type:A(s,'type'),name:nm,based:A(kid(s,'basedOn'),'val'),r:rp(kid(s,'rPr')),jc:A(kid(pp,'jc'),'val'),num:kid(kid(pp,'numPr'),'numId')?{id:A(kid(kid(pp,'numPr'),'numId'),'val'),lvl:A(kid(kid(pp,'numPr'),'ilvl'),'val')}:null};
    }
  }
  const styleChain=id=>{const ch=[];let g=0;while(id&&ST[id]&&g++<20){ch.unshift(ST[id]);id=ST[id].based}return ch};
  /* номерация */
  const NUM={};
  if(numX){
    const abs={};
    for(const a of kids(numX.documentElement,'abstractNum')){
      const m={};for(const l of kids(a,'lvl'))m[A(l,'ilvl')]=A(kid(l,'numFmt'),'val');
      abs[A(a,'abstractNumId')]=m;
    }
    for(const nn of kids(numX.documentElement,'num')){
      const a=A(kid(nn,'abstractNumId'),'val');NUM[A(nn,'numId')]=abs[a]||{};
    }
  }
  /* връзки (картинки) */
  const REL={};if(relX)for(const r of relX.documentElement.children)REL[r.getAttribute('Id')]=r.getAttribute('Target');
  let txtEmu=6.5*914400;   /* ширина на текста: размер на страницата без полетата */
  {const sp=docX.getElementsByTagName('w:pgSz')[0],pm=docX.getElementsByTagName('w:pgMar')[0];
   if(sp&&pm){const w=parseFloat(sp.getAttribute('w:w')),l=parseFloat(pm.getAttribute('w:left'))||0,r=parseFloat(pm.getAttribute('w:right'))||0;if(w>0&&w-l-r>1440)txtEmu=(w-l-r)*635}}
  const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp'};
  const b64=u=>{let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)};
  async function image(dr){
    const bl=dr.getElementsByTagName('a:blip')[0];if(!bl)return '';
    const id=bl.getAttribute('r:embed');let tg=REL[id];if(!tg)return '';
    tg=tg.replace(/^\//,'');const path=tg.startsWith('word/')?tg:'word/'+tg;
    const mime=MIME[(path.split('.').pop()||'').toLowerCase()];if(!mime||!z.has(path))return '';
    const ex=dr.getElementsByTagName('wp:extent')[0];let w=60;
    if(ex){const cx=parseFloat(ex.getAttribute('cx'));if(cx>0)w=Math.max(5,Math.min(100,Math.round(cx/txtEmu*100)))}
    return `<img src="data:${mime};base64,${b64(await z.get(path))}" style="width:${w}%">`;
  }
  const effRun=(pStyleId,rStyleId,direct)=>{
    const o=Object.assign({},defR);
    for(const s of styleChain(pStyleId))Object.assign(o,s.r);
    for(const s of styleChain(rStyleId))Object.assign(o,s.r);
    return Object.assign(o,direct);
  };
  const runCss=o=>{
    const c=[];
    if(o.font)c.push(`font-family:'${o.font.replace(/['"]/g,'')}'`);
    if(o.sz)c.push(`font-size:${Math.round(o.sz*4/3*100)/100}px`);   /* пунктове → px; в лентата се показва пак същото число като във Word */
    if(o.color)c.push('color:'+o.color);
    if(o.bg)c.push('background-color:'+o.bg);
    if(o.b)c.push('font-weight:bold');if(o.i)c.push('font-style:italic');
    const td=[];if(o.u)td.push('underline');if(o.s)td.push('line-through');if(td.length)c.push('text-decoration:'+td.join(' '));
    return c.join(';');
  };
  async function runsOf(el,pStyle,out){
    for(const c of el.children){
      const n=c.localName;
      if(n==='r'){
        const rPr=kid(c,'rPr'),o=effRun(pStyle,A(kid(rPr,'rStyle'),'val'),rp(rPr));
        let h='';
        for(const x of c.children){
          const k=x.localName;
          if(k==='t')h+=esc(x.textContent);
          else if(k==='tab')h+=' ';
          else if(k==='br'){if(A(x,'type')!=='page')h+='<br>'}
          else if(k==='noBreakHyphen')h+='-';
          else if(k==='drawing'||k==='pict'){h+=await image(x)}
        }
        if(!h)continue;
        if(o.caps)h=h.replace(/>([^<]+)</g,(m,t)=>'>'+t.toUpperCase()+'<').replace(/^([^<]+)/,t=>t.toUpperCase());
        if(/^<img/.test(h)&&!/[^<]*<(?!img)/.test(h.replace(/<img[^>]*>/g,''))){out.push(h);continue}
        const css=runCss(o);let s=css?`<span style="${css}">${h}</span>`:h;
        if(o.va)s=`<${o.va}>${s}</${o.va}>`;
        out.push(s);
      }else if(n==='del'||n==='moveFrom'||n==='pPr'||n==='rPr')continue;
      else await runsOf(c,pStyle,out);   /* hyperlink, ins, smartTag, sdtContent … */
    }
  }
  const items=[];
  async function para(p){
    const pPr=kid(p,'pPr'),sid=A(kid(pPr,'pStyle'),'val');
    const chain=styleChain(sid);
    let jc=A(kid(pPr,'jc'),'val');if(!jc)for(const s of chain)if(s.jc)jc=s.jc;
    const al={both:'justify',center:'center',right:'right',end:'right',left:'left',start:'left'}[jc]||'';
    let num=null;const np=kid(pPr,'numPr');
    if(np)num={id:A(kid(np,'numId'),'val'),lvl:A(kid(np,'ilvl'),'val')||'0'};
    else for(const s of chain)if(s.num)num={id:s.num.id,lvl:s.num.lvl||'0'};
    const parts=[];await runsOf(p,sid,parts);
    let html=parts.join('');
    const nm=chain.length?chain[chain.length-1].name.toLowerCase():'';
    let tag='p';const hm=/^heading\s?([1-6])$/.exec(nm);if(hm)tag='h'+hm[1];else if(nm==='title')tag='h1';
    const st=al?` style="text-align:${al}"`:'';
    if(num&&num.id&&num.id!=='0'){
      const f=(NUM[num.id]||{})[num.lvl];
      items.push({li:true,ol:!!f&&f!=='bullet'&&f!=='none',lvl:Math.min(8,parseInt(num.lvl,10)||0),h:`<div${st}>${html||'<br>'}</div>`.replace(/^<div([^>]*)>(.*)<\/div>$/,'$2')});
    }else{
      let pst=st;
      if(!html){   /* празен ред: размерът идва от знака за параграф (pPr/rPr), иначе от стила */
        const o={};for(const x of styleChain(sid))Object.assign(o,x.r);Object.assign(o,rp(kid(pPr,'rPr')));   /* без стандартните настройки на документа (11 пт), които не личат никъде в текста */
        if(o.sz){const ps=`font-size:${Math.round(o.sz*4/3*100)/100}px`;pst=al?` style="text-align:${al};${ps}"`:` style="${ps}"`}
      }
      items.push({li:false,h:`<${tag}${pst}>${html||'<br>'}</${tag}>`});
    }
  }
  async function blocks(el){
    for(const c of el.children){
      const n=c.localName;
      if(n==='p')await para(c);
      else if(n==='tbl'||n==='tr'||n==='tc'||n==='sdt'||n==='sdtContent'||n==='ins')await blocks(c);
    }
  }
  await blocks(kid(docX.documentElement,'body')||docX.documentElement);
  let out='',stk=[];
  const closeTo=n=>{while(stk.length>n){out+='</li></'+stk.pop()+'>'}};
  for(const it of items){
    if(!it.li){closeTo(0);out+=it.h;continue}
    const d=it.lvl+1,tg=it.ol?'ol':'ul';
    closeTo(d);
    if(stk.length===d&&stk[d-1]!==tg)closeTo(d-1);
    if(stk.length===d)out+='</li>';
    while(stk.length<d){out+='<'+(stk.length+1===d?tg:'ul')+'>';stk.push(stk.length+1===d?tg:'ul');if(stk.length<d)out+='<li>'}
    out+='<li>'+it.h;
  }
  closeTo(0);
  return out;
}
/* .odt → HTML със собствен четец (LibreOffice, OnlyOffice, Word): знаци, абзаци, списъци, картинки; таблиците стават текст по клетки */
async function odtToHtml(buf){
  const z=await zipRead(buf);
  const xml=t=>t?new DOMParser().parseFromString(t,'application/xml'):null;
  const cX=xml(await z.text('content.xml'));if(!cX||!cX.documentElement||cX.getElementsByTagName('parsererror').length)throw new Error('no content');
  const sX=xml(await z.text('styles.xml'));
  const all=(doc,tag)=>doc?[...doc.getElementsByTagName(tag)]:[];
  const attr=(e,n)=>e?e.getAttribute(n):null;
  const ch=(e,n)=>e?[...e.children].filter(c=>c.nodeName===n):[];
  /* шрифтове по име */
  const FACE={};for(const d of [cX,sX])for(const f of all(d,'style:font-face')){const nm=attr(f,'style:name'),fm=attr(f,'svg:font-family');if(nm&&fm)FACE[nm]=fm.replace(/['"]/g,'').trim()}
  const num=(v,rel)=>{if(!v)return null;const m=/^(-?[\d.]+)\s*(pt|px|cm|mm|in|%)?$/.exec(v.trim());if(!m)return null;const x=parseFloat(m[1]);switch(m[2]){case 'pt':case undefined:return x;case 'px':return x*.75;case 'cm':return x*28.3465;case 'mm':return x*2.83465;case 'in':return x*72;case '%':return rel?rel*x/100:null}return null};
  const props=(el)=>{
    const o={},tp=ch(el,'style:text-properties')[0],pp=ch(el,'style:paragraph-properties')[0];
    if(tp){
      let v;
      if((v=attr(tp,'fo:font-weight')))o.b=v==='bold'||parseInt(v,10)>=600;
      if((v=attr(tp,'fo:font-style')))o.i=v==='italic'||v==='oblique';
      if((v=attr(tp,'style:text-underline-style')))o.u=v!=='none';
      if((v=attr(tp,'style:text-line-through-style')))o.s=v!=='none';
      if((v=attr(tp,'fo:color')))o.color=/^#[0-9a-f]{6}$/i.test(v)?v:null;
      if((v=attr(tp,'fo:background-color')))o.bg=/^#[0-9a-f]{6}$/i.test(v)?v:null;
      if((v=attr(tp,'fo:font-size')))o.szRaw=v;
      const fm=attr(tp,'fo:font-family')||FACE[attr(tp,'style:font-name')];if(fm)o.font=fm.replace(/['"]/g,'').split(',')[0].trim();
      if((v=attr(tp,'style:text-position'))){const m=/^(super|sub|-?\d+%)/.exec(v.trim());o.va=m?(m[1]==='super'||(/%$/.test(m[1])&&parseFloat(m[1])>0)?'sup':m[1]==='sub'||/%$/.test(m[1])?'sub':null):null;if(/^0%/.test(v.trim()))o.va=null}
      if((v=attr(tp,'fo:text-transform')))o.caps=v==='uppercase';
    }
    if(pp){const a=attr(pp,'fo:text-align');if(a)o.al={start:'left',left:'left',end:'right',right:'right',center:'center',justify:'justify'}[a]||''}
    return o;
  };
  /* стилове: [семейство][име] */
  const ST={paragraph:{},text:{},list:{}},DEFP={};
  for(const d of [sX,cX])for(const st of all(d,'style:style')){const fam=attr(st,'style:family'),nm=attr(st,'style:name');if(ST[fam]&&nm)ST[fam][nm]={parent:attr(st,'style:parent-style-name'),p:props(st)}}
  for(const d of [sX])for(const st of all(d,'style:default-style'))if(attr(st,'style:family')==='paragraph')Object.assign(DEFP,props(st));
  const merge=(base,top)=>{
    const o=Object.assign({},base);
    for(const k in top){if(k==='szRaw')continue;o[k]=top[k]}
    if(top.szRaw){const sz=num(top.szRaw,base.sz||12);if(sz)o.sz=sz}
    return o;
  };
  const chain=(fam,name)=>{const l=[];let n=name,g=0;while(n&&ST[fam]&&ST[fam][n]&&g++<20){l.unshift(ST[fam][n]);n=ST[fam][n].parent}return l};
  const resolve=(base,fam,name)=>chain(fam,name).reduce((o,x)=>merge(o,x.p),base);
  const base0=merge({},DEFP);
  /* ширина на текста на страницата (за картинките) */
  let txtW=17;
  {const pl=all(sX,'style:page-layout-properties')[0];if(pl){const w=num(attr(pl,'fo:page-width')),l=num(attr(pl,'fo:margin-left'))||0,r=num(attr(pl,'fo:margin-right'))||0;if(w){const cm=(w-l-r)/28.3465;if(cm>3)txtW=cm}}}
  /* списъци: стил на ниво → номериран или с точки */
  const LS={};for(const d of [sX,cX])for(const ls of all(d,'text:list-style')){const m={};for(const lv of ls.children)m[attr(lv,'text:level')]=lv.nodeName==='text:list-level-style-number'&&attr(lv,'style:num-format')!=='';LS[attr(ls,'style:name')]=m}
  const MIME={png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp'};
  const b64=u=>{let t='';for(let i=0;i<u.length;i+=0x8000)t+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(t)};
  const runCss=o=>{
    const c=[];
    if(o.font)c.push(`font-family:'${o.font.replace(/['"]/g,'')}'`);
    if(o.sz)c.push(`font-size:${Math.round(o.sz*4/3*100)/100}px`);
    if(o.color)c.push('color:'+o.color);
    if(o.bg)c.push('background-color:'+o.bg);
    if(o.b)c.push('font-weight:bold');if(o.i)c.push('font-style:italic');
    const td=[];if(o.u)td.push('underline');if(o.s)td.push('line-through');if(td.length)c.push('text-decoration:'+td.join(' '));
    return c.join(';');
  };
  const wrap=(tx,o)=>{
    if(!tx)return '';
    if(o.caps)tx=tx.toUpperCase();
    const css=runCss(o);let h=css?`<span style="${css}">${tx}</span>`:tx;
    if(o.va)h=`<${o.va}>${h}</${o.va}>`;
    return h;
  };
  async function frame(fr){
    const im=all(fr,'draw:image')[0];
    if(!im)return null;
    const href=(attr(im,'xlink:href')||'').replace(/^\.\//,'');
    const mime=MIME[(href.split('.').pop()||'').toLowerCase()];if(!mime||!z.has(href))return '';
    const w=num(attr(fr,'svg:width'));let pct=60;
    if(w){const cm=w/28.3465;pct=Math.max(5,Math.min(100,Math.round(cm/txtW*100)))}
    return `<img src="data:${mime};base64,${b64(await z.get(href))}" style="width:${pct}%">`;
  }
  /* съдържание на абзац */
  async function inline(el,o,out){
    for(const n of el.childNodes){
      if(n.nodeType===3){const t=n.textContent.replace(/\s+/g,' ');if(t)out.push(wrap(esc(t),o));continue}
      if(n.nodeType!==1)continue;
      const nm=n.nodeName;
      if(nm==='text:span')await inline(n,resolve(o,'text',attr(n,'text:style-name')),out);
      else if(nm==='text:a'||nm==='text:ruby'||nm==='text:ruby-base')await inline(n,o,out);
      else if(nm==='text:s')out.push(wrap(' '.repeat(Math.max(1,parseInt(attr(n,'text:c')||'1',10))),o));
      else if(nm==='text:tab')out.push(wrap(' ',o));
      else if(nm==='text:line-break')out.push('<br>');
      else if(nm==='draw:frame'){const h=await frame(n);if(h!==null)out.push(h);else await blocksIn(n,true,out)}
      else if(nm==='text:note'||nm==='text:tracked-changes'||nm==='text:soft-page-break'||nm==='office:annotation'||nm==='text:bookmark'||nm==='text:bookmark-start'||nm==='text:bookmark-end')continue;
    }
  }
  const items=[];   /* абзаци и елементи на списък в ред на появяване */
  async function para(el,li){
    const pname=attr(el,'text:style-name');
    const po=resolve(base0,'paragraph',pname);
    const out=[];await inline(el,po,out);
    let html=out.join('');
    const al=po.al||'';
    const st=al?` style="text-align:${al}"`:'';
    if(li){items.push({li:true,ol:li.ol,lvl:li.lvl,h:html||'<br>'});return}
    if(!html){const ps=po.sz?`font-size:${Math.round(po.sz*4/3*100)/100}px`:'';const a2=[al?`text-align:${al}`:'',ps].filter(Boolean).join(';');items.push({li:false,h:`<p${a2?` style="${a2}"`:''}><br></p>`});return}
    items.push({li:false,h:`<p${st}>${html}</p>`});
  }
  async function blocksIn(el,inFrame,sink){
    for(const c of el.children){
      const nm=c.nodeName;
      if(nm==='text:p'||nm==='text:h')await para(c,null);
      else if(nm==='text:list')await list(c,attr(c,'text:style-name'),0);
      else if(/^(table:table|table:table-row|table:table-cell|table:table-rows|table:table-header-rows|table:table-row-group|text:section|text:index-body|text:table-of-content|text:index-title|draw:text-box|draw:custom-shape|draw:frame|draw:g)$/.test(nm))await blocksIn(c,inFrame,sink);
    }
  }
  async function list(el,sname,depth){
    for(const it of ch(el,'text:list-item')){
      for(const c of it.children){
        if(c.nodeName==='text:p'||c.nodeName==='text:h'){const lv=(LS[sname]||{})[String(depth+1)];await para(c,{ol:!!lv,lvl:depth})}
        else if(c.nodeName==='text:list')await list(c,attr(c,'text:style-name')||sname,depth+1);
      }
    }
  }
  const body=all(cX,'office:text')[0];if(!body)throw new Error('no body');
  await blocksIn(body,false,null);
  /* вложени списъци: същата сглобка като при .docx */
  let outH='',stk=[];
  const closeTo=n=>{while(stk.length>n){outH+='</li></'+stk.pop()+'>'}};
  for(const it of items){
    if(!it.li){closeTo(0);outH+=it.h;continue}
    const d=it.lvl+1,tg=it.ol?'ol':'ul';
    closeTo(d);
    if(stk.length===d&&stk[d-1]!==tg)closeTo(d-1);
    if(stk.length===d)outH+='</li>';
    while(stk.length<d){outH+='<'+(stk.length+1===d?tg:'ul')+'>';stk.push(stk.length+1===d?tg:'ul');if(stk.length<d)outH+='<li>'}
    outH+='<li>'+it.h;
  }
  closeTo(0);
  return outH;
}
/* .txt: UTF-8 или (за стари български файлове) windows-1251 */
function decodeText(buf){
  const u=new Uint8Array(buf);
  if(u[0]===0xEF&&u[1]===0xBB&&u[2]===0xBF)return new TextDecoder('utf-8').decode(u.subarray(3));
  if(u[0]===0xFF&&u[1]===0xFE)return new TextDecoder('utf-16le').decode(u.subarray(2));
  if(u[0]===0xFE&&u[1]===0xFF)return new TextDecoder('utf-16be').decode(u.subarray(2));
  try{return new TextDecoder('utf-8',{fatal:true}).decode(u)}
  catch(e){   /* не е UTF-8: кодирането е от Настройки (по подразбиране windows-1251) */
    let enc=S.txtEnc||'windows-1251';decodeText.fb=enc;
    try{return new TextDecoder(enc).decode(u)}catch(e2){decodeText.fb='windows-1251';return new TextDecoder('windows-1251').decode(u)}
  }
}
async function openFile(f,link){
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  try{
    let html='',raw=null;
    if(link)raw=await LF.rawOf(f,link.fmt);   /* за сравнение при проверка за промени във файла */
    if(ext==='docx'){
      const buf=await f.arrayBuffer();
      try{html=sanitize(await docxToHtml(buf),{noRescale:true})}   /* размерите от Word се запазват точно */
      catch(e2){   /* резервен път: старата библиотека (губи част от форматирането) */
        if(!await loadMammoth())throw new Error(t('The .docx library is not loaded. An internet connection is required.'));
        const r=await mammoth.convertToHtml({arrayBuffer:buf});
        html=sanitize(r.value,{noRescale:true});
      }
    }else if(ext==='odt'){
      html=sanitize(await odtToHtml(await f.arrayBuffer()),{noRescale:true});
    }else if(ext==='doc'){
      throw new Error(t('The old .doc format cannot be read by the browser. Save it as .docx in Word, or copy the text and paste it here.'));
    }else if(ext==='json'){
      await scLoadFile(f);return;
    }else if(ext==='rtf'){
      const rt=await f.text();
      html=sanitize(rtfToHtml(rt),{noRescale:true});   /* форматирането се запазва; размерите остават точно както в RTF */
      if(!html.replace(/<[^>]*>/g,'').trim())html=textToHtml(rtfToText(rt));   /* резервен път: само текст */
    }else if(ext==='txt'){
      decodeText.fb=null;
      html=textToHtml(decodeText(await f.arrayBuffer()));
      if(decodeText.fb)toast(t('The file is not UTF-8: it was read as {e}. If the letters look wrong, change the encoding in Settings.',{e:decodeText.fb}),true);
    }else{
      throw new Error(t('This format is not supported. You can open .docx, .odt, .rtf and .txt.'));
    }
    scFlush();
    const nm=f.name.replace(/\.[^.]+$/,'').slice(0,60)||(t('Text')+' '+(SC.length+1));
    const rec={id:scNewId(),name:nm,html:html||'<p><br></p>'};
    if(link&&lfFind(link.uri))link=null;   /* защита: един файл = един свързан текст */
    if(link)rec.link={uri:link.uri,name:link.name,fmt:link.fmt,mt:link.mt,rh:LF.hash(raw),wh:null};   /* wh се определя при зареждане в редактора */
    SC.push(rec);scPersist();renderScripts();
    await scLoad(SC.length-1,remoteOn(),true);   /* ако тече дистанционно, четенето не се прекъсва */
    showEditor();
    toast(link?t('Linked to local file: {n}',{n:link.name}):t('Added to the list: {n}',{n:nm}));
  }catch(err){toast(err.message||t('The file could not be opened.'),true)}
}
