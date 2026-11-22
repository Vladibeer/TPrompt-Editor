/* ---------- RTF: редактируем формат, който се отваря във Word, LibreOffice, Google Docs и Pages ---------- */
/* ===== Експорт: общ модел на документа и записи в DOCX, ODT и RTF (без външни библиотеки) ===== */
const CRC_T=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u){let c=0xFFFFFFFF;for(let i=0;i<u.length;i++)c=CRC_T[(c^u[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
/* ZIP без компресия; файловете са {name,text} или {name,data:Uint8Array} */
function zipStore(files){
  const enc=new TextEncoder(),u16=v=>[v&255,(v>>>8)&255],u32=v=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
  const out=[],cd=[];let off=0;
  for(const f of files){
    const nm=enc.encode(f.name),d=f.data||enc.encode(f.text),crc=crc32(d),sz=d.length;
    const lh=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),...u16(0)]);
    out.push(lh,nm,d);
    cd.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(0),...u16(0x21),...u32(crc),...u32(sz),...u32(sz),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
    off+=lh.length+nm.length+d.length;
  }
  const cdLen=cd.reduce((n,x)=>n+x.length,0);
  const end=new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cdLen),...u32(off),...u16(0)]);
  const all=[...out,...cd,end],res=new Uint8Array(all.reduce((n,x)=>n+x.length,0));
  let o=0;for(const x of all){res.set(x,o);o+=x.length}
  return res;
}
function bytesToB64(u){let s='';for(let i=0;i<u.length;i+=0x8000)s+=String.fromCharCode.apply(null,u.subarray(i,i+0x8000));return btoa(s)}
function dataUrlBytes(src){const m=/^data:([^;,]+);base64,(.*)$/s.exec(src||'');if(!m)return null;const bin=atob(m[2]),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return{mime:m[1].toLowerCase().replace('image/jpg','image/jpeg'),bytes:u}}
/* размер на картинка по заглавната част на файла: [ширина,височина] или [0,0] */
function imgSize(mime,u){
  try{
    if(mime==='image/png'&&u.length>24)return[((u[16]<<24)|(u[17]<<16)|(u[18]<<8)|u[19])>>>0,((u[20]<<24)|(u[21]<<16)|(u[22]<<8)|u[23])>>>0];
    if(mime==='image/gif')return[u[6]|(u[7]<<8),u[8]|(u[9]<<8)];
    if(mime==='image/jpeg'){let i=2;while(i<u.length-9){if(u[i]!==0xFF){i++;continue}const m=u[i+1];if(m>=0xC0&&m<=0xCF&&m!==0xC4&&m!==0xC8&&m!==0xCC)return[(u[i+7]<<8)|u[i+8],(u[i+5]<<8)|u[i+6]];i+=2+((u[i+2]<<8)|u[i+3])}}
    if(mime==='image/webp'){const t=String.fromCharCode(u[12],u[13],u[14],u[15]);
      if(t==='VP8X')return[1+(u[24]|(u[25]<<8)|(u[26]<<16)),1+(u[27]|(u[28]<<8)|(u[29]<<16))];
      if(t==='VP8 ')return[(u[26]|(u[27]<<8))&0x3fff,(u[28]|(u[29]<<8))&0x3fff];
      if(t==='VP8L'){const b=u[21]|(u[22]<<8)|(u[23]<<16)|(u[24]<<24);return[1+(b&0x3fff),1+((b>>14)&0x3fff)]}}
  }catch(e){oops('imgSize#1',e)}
  return[0,0];
}
/* превръща картинка в PNG (за формати без .gif и .webp); за анимиран .gif остава само първият кадър */
async function imgToPng(mime,u){
  const url=URL.createObjectURL(new Blob([u],{type:mime}));
  try{
    const im=new Image();im.src=url;await im.decode();
    const c=document.createElement('canvas');c.width=im.naturalWidth;c.height=im.naturalHeight;c.getContext('2d').drawImage(im,0,0);
    const b=await new Promise(r=>c.toBlob(r,'image/png'));
    return{mime:'image/png',bytes:new Uint8Array(await b.arrayBuffer()),w:c.width,h:c.height};
  }finally{URL.revokeObjectURL(url)}
}
/* картинка за запис: само позволените типове, с размер */
async function prepImg(im,allowed){
  const d=dataUrlBytes(im.src);if(!d)return null;
  let{mime,bytes}=d,[w,h]=imgSize(mime,bytes);
  if(!allowed.includes(mime)||!w||!h){
    try{const p=await imgToPng(mime,bytes);if(!allowed.includes(mime))({mime,bytes}=p);w=p.w;h=p.h}catch(e){if(!allowed.includes(mime))return null}
  }
  if(!w||!h){w=4;h=3}
  return{mime,bytes,w,h,ext:{'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp'}[mime]||'png',pct:im.pct};
}
/* модел: абзаци {al,runs}, а всеки участък има текст t, <br> (br) или картинка (img) и формат b,i,u,s,c,bg,px,font,va */
function docModel(){
  const norm=v=>{
    if(!v)return null;const e=document.createElement('span');e.style.color=v;document.body.appendChild(e);
    const m=/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(getComputedStyle(e).color);e.remove();
    return m&&(m[4]===undefined||parseFloat(m[4])>0)?[+m[1],+m[2],+m[3]]:null;
  };
  const BLOCK=/^(P|H[1-6]|DIV|LI|BLOCKQUOTE|UL|OL)$/;
  const HSZ={H1:1.6,H2:1.4,H3:1.2,H4:1.1,H5:1,H6:1};
  const sty=(el,st)=>{
    const n=Object.assign({},st),tg=el.tagName,cs=el.style||{};
    if(tg==='B'||tg==='STRONG')n.b=1;if(tg==='I'||tg==='EM')n.i=1;if(tg==='U')n.u=1;if(tg==='S'||tg==='STRIKE'||tg==='DEL')n.s=1;
    if(tg==='SUP')n.va='sup';if(tg==='SUB')n.va='sub';
    if(cs.fontWeight&&(cs.fontWeight==='bold'||parseInt(cs.fontWeight,10)>=600))n.b=1;
    if(cs.fontStyle==='italic')n.i=1;
    if(cs.textDecorationLine||cs.textDecoration){const d=cs.textDecorationLine||cs.textDecoration;if(/underline/.test(d))n.u=1;if(/line-through/.test(d))n.s=1}
    if(cs.verticalAlign==='super')n.va='sup';if(cs.verticalAlign==='sub')n.va='sub';
    if(cs.color){const c=norm(cs.color);if(c)n.c=c}
    if(cs.backgroundColor){const c=norm(cs.backgroundColor);if(c)n.bg=c}
    if(cs.fontSize&&/px$/.test(cs.fontSize))n.px=parseFloat(cs.fontSize);
    if(cs.fontFamily){const f=cs.fontFamily.split(',')[0].replace(/["']/g,'').trim();if(f)n.font=f}
    return n;
  };
  const paras=[];let runs=[],al='left';
  const flush=()=>{paras.push({al,runs});runs=[]};
  const push=(t,st)=>{runs.push(Object.assign({t},st))};
  const inline=(node,st)=>{
    for(const ch of node.childNodes){
      if(ch.nodeType===3){const tx=ch.textContent.replace(/[\n\r]+/g,' ');if(tx)push(tx,st)}
      else if(ch.nodeType===1){
        if(ch.tagName==='BR'){runs.push({br:1});continue}
        if(ch.tagName==='IMG'){const m=/^([\d.]+)%$/.exec((ch.style&&ch.style.width)||'');runs.push({img:{src:ch.getAttribute('src'),pct:m?parseFloat(m[1]):60}});continue}
        if(BLOCK.test(ch.tagName)){if(runs.length)flush();block(ch,st);continue}
        inline(ch,sty(ch,st));
      }
    }
  };
  const block=(el,st)=>{
    const tg=el.tagName;
    if(tg==='UL'||tg==='OL'){let k=0;for(const li of el.children){k++;block(li,Object.assign({},st,{pre:tg==='UL'?'\u2022 ':k+'. '}))}return}
    const hasBlocks=[...el.children].some(c=>BLOCK.test(c.tagName));
    let n=sty(el,st);
    if(HSZ[tg]){n.b=1;n.px=(n.px||BASE)*HSZ[tg]}
    if(hasBlocks){inline(el,n);if(runs.length)flush();return}
    const a=(el.style&&el.style.textAlign)||el.getAttribute('align')||'';
    al={center:'center',right:'right',justify:'justify'}[a]||'left';
    runs=[];
    if(st.pre)push(st.pre,n);
    inline(el,n);
    flush();
  };
  const root=document.createElement('div');root.innerHTML=edHtml();
  let loose=false;
  for(const ch of root.childNodes){if(ch.nodeType===3&&ch.textContent.trim())loose=true}
  if(loose){const p=document.createElement('p');while(root.firstChild)p.appendChild(root.firstChild);root.appendChild(p)}
  for(const ch of root.children){if(BLOCK.test(ch.tagName))block(ch,{});else{const p=document.createElement('p');p.appendChild(ch.cloneNode(true));block(p,{})}}
  return paras;
}
const xmlEsc=str=>String(str).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const hexOf=c=>c.map(v=>v.toString(16).padStart(2,'0')).join('').toUpperCase();
const pxToPt=px=>Math.round(px*.75*100)/100;
const TXT_W_TW=9638;   /* ширина на текста на A4 с полета 2 см: 9638 twips = 17 cm */

/* ---------- DOCX ---------- */
async function buildDocx(){
  const paras=docModel(),hp=px=>Math.max(2,Math.round(px*.75*2));
  const media=[],rels=[];let did=1;
  const rpr=n=>{
    const f=n.font?xmlEsc(n.font):'';
    return '<w:rPr>'+(f?`<w:rFonts w:ascii="${f}" w:hAnsi="${f}" w:eastAsia="${f}" w:cs="${f}"/>`:'')+(n.b?'<w:b/>':'')+(n.i?'<w:i/>':'')+(n.s?'<w:strike/>':'')+(n.c?`<w:color w:val="${hexOf(n.c)}"/>`:'')
      +`<w:sz w:val="${hp(n.px||BASE)}"/><w:szCs w:val="${hp(n.px||BASE)}"/>`+(n.u?'<w:u w:val="single"/>':'')
      +(n.bg?`<w:shd w:val="clear" w:color="auto" w:fill="${hexOf(n.bg)}"/>`:'')+(n.va?`<w:vertAlign w:val="${n.va==='sup'?'superscript':'subscript'}"/>`:'')+'</w:rPr>';
  };
  const run=(tx,n)=>tx.split('\t').map((part,i)=>(i?`<w:r>${rpr(n)}<w:tab/></w:r>`:'')+(part?`<w:r>${rpr(n)}<w:t xml:space="preserve">${xmlEsc(part)}</w:t></w:r>`:'')).join('');
  let body='';
  for(const p of paras){
    let rx='';
    for(const r of p.runs){
      if(r.br)rx+='<w:r><w:br/></w:r>';
      else if(r.img){
        const im=await prepImg(r.img,['image/png','image/jpeg','image/gif']);if(!im)continue;
        const k=media.length+1,rid='rIdImg'+k,name=`image${k}.${im.ext}`;
        media.push({name:'word/media/'+name,data:im.bytes,ext:im.ext});rels.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
        let cx=Math.round(im.pct/100*TXT_W_TW*635),cy=Math.round(cx*im.h/im.w);
        const maxCy=Math.round(24*360000);if(cy>maxCy){cx=Math.round(cx*maxCy/cy);cy=maxCy}
        const id=did++;
        rx+=`<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rid}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
      }else rx+=run(r.t,r);
    }
    const jc={left:'left',center:'center',right:'right',justify:'both'}[p.al]||'left';
    body+=`<w:p><w:pPr><w:spacing w:after="120"/><w:jc w:val="${jc}"/></w:pPr>${rx}</w:p>`;
  }
  if(!body)body='<w:p/>';
  const H='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const NS='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"';
  const exts=[...new Set(media.map(m=>m.ext))],CT={png:'image/png',jpg:'image/jpeg',gif:'image/gif'};
  const fnt=xmlEsc(S.font);
  return bytesToB64(zipStore([
    {name:'[Content_Types].xml',text:H+'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+exts.map(e=>`<Default Extension="${e}" ContentType="${CT[e]}"/>`).join('')+'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'},
    {name:'_rels/.rels',text:H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'},
    {name:'word/_rels/document.xml.rels',text:H+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'+rels.join('')+'</Relationships>'},
    {name:'word/styles.xml',text:H+`<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${fnt}" w:hAnsi="${fnt}" w:eastAsia="${fnt}" w:cs="${fnt}"/><w:sz w:val="${hp(BASE)}"/><w:szCs w:val="${hp(BASE)}"/><w:lang w:val="bg-BG" w:eastAsia="bg-BG" w:bidi="ar-SA"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`},
    {name:'word/document.xml',text:H+`<w:document ${NS}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`},
    ...media.map(m=>({name:m.name,data:m.data}))
  ]));
}

/* ---------- ODT (OpenDocument) ---------- */
async function buildOdt(){
  const paras=docModel(),tst=new Map(),pst=new Map(),pics=[];
  const fo=n=>{
    let a='';
    if(n.font)a+=` fo:font-family="${xmlEsc(n.font)}" style:font-family-generic="${fontKind(n.font)==='serif'?'roman':fontKind(n.font)==='monospace'?'modern':'swiss'}"`;
    a+=` fo:font-size="${pxToPt(n.px||BASE)}pt"`;
    if(n.b)a+=' fo:font-weight="bold"';if(n.i)a+=' fo:font-style="italic"';
    if(n.u)a+=' style:text-underline-style="solid" style:text-underline-width="auto" style:text-underline-color="font-color"';
    if(n.s)a+=' style:text-line-through-style="solid"';
    if(n.c)a+=` fo:color="#${hexOf(n.c)}"`;
    if(n.bg)a+=` fo:background-color="#${hexOf(n.bg)}"`;
    if(n.va)a+=` style:text-position="${n.va==='sup'?'super':'sub'} 58%"`;
    return a;
  };
  const tname=n=>{const k=fo(n);if(!tst.has(k))tst.set(k,'T'+(tst.size+1));return tst.get(k)};
  const pname=al=>{if(!pst.has(al))pst.set(al,'P'+(pst.size+1));return pst.get(al)};
  const txt=(tx)=>xmlEsc(tx).replace(/\t/g,'<text:tab/>').replace(/ {2,}/g,m=>' <text:s text:c="'+(m.length-1)+'"/>').replace(/^ /,'<text:s/>');
  let body='';
  for(const p of paras){
    let rx='';
    for(const r of p.runs){
      if(r.br)rx+='<text:line-break/>';
      else if(r.img){
        const im=await prepImg(r.img,['image/png','image/jpeg','image/gif','image/webp']);if(!im)continue;
        const k=pics.length+1,name=`Pictures/image${k}.${im.ext}`;pics.push({name,data:im.bytes,mime:im.mime});
        let wcm=im.pct/100*17,hcm=wcm*im.h/im.w;if(hcm>24){wcm=wcm*24/hcm;hcm=24}
        rx+=`<draw:frame draw:style-name="fr1" draw:name="Image${k}" text:anchor-type="as-char" svg:width="${wcm.toFixed(3)}cm" svg:height="${hcm.toFixed(3)}cm" draw:z-index="0"><draw:image xlink:href="${name}" xlink:type="simple" xlink:show="embed" xlink:actuate="onLoad"/></draw:frame>`;
      }else rx+=`<text:span text:style-name="${tname(r)}">${txt(r.t)}</text:span>`;
    }
    body+=`<text:p text:style-name="${pname(p.al)}">${rx}</text:p>`;
  }
  const NSD='xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0" office:version="1.2"';
  const H='<?xml version="1.0" encoding="UTF-8"?>\n';
  const auto=[...tst].map(([k,v])=>`<style:style style:name="${v}" style:family="text"><style:text-properties${k}/></style:style>`).join('')
    +[...pst].map(([k,v])=>`<style:style style:name="${v}" style:family="paragraph"><style:paragraph-properties fo:text-align="${k==='left'?'start':k==='right'?'end':k}" fo:margin-bottom="0.212cm"/></style:style>`).join('')
    +'<style:style style:name="fr1" style:family="graphic"><style:graphic-properties style:vertical-pos="top" style:vertical-rel="baseline" style:horizontal-pos="center" style:horizontal-rel="paragraph" style:wrap="none"/></style:style>';
  const content=H+`<office:document-content ${NSD}><office:automatic-styles>${auto}</office:automatic-styles><office:body><office:text>${body||'<text:p/>'}</office:text></office:body></office:document-content>`;
  const fnt=xmlEsc(S.font);
  const styles=H+`<office:document-styles ${NSD}><office:styles><style:default-style style:family="paragraph"><style:text-properties fo:font-family="${fnt}" fo:font-size="${pxToPt(BASE)}pt" fo:language="bg" fo:country="BG"/></style:default-style></office:styles><office:automatic-styles><style:page-layout style:name="pm1"><style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm" fo:margin-top="2cm" fo:margin-bottom="2cm" fo:margin-left="2cm" fo:margin-right="2cm"/></style:page-layout></office:automatic-styles><office:master-styles><style:master-page style:name="Standard" style:page-layout-name="pm1"/></office:master-styles></office:document-styles>`;
  const manifest=H+'<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.2"><manifest:file-entry manifest:full-path="/" manifest:version="1.2" manifest:media-type="application/vnd.oasis.opendocument.text"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>'+pics.map(p=>`<manifest:file-entry manifest:full-path="${p.name}" manifest:media-type="${p.mime}"/>`).join('')+'</manifest:manifest>';
  return bytesToB64(zipStore([
    {name:'mimetype',text:'application/vnd.oasis.opendocument.text'},   /* първият файл в архива, без компресия */
    {name:'META-INF/manifest.xml',text:manifest},
    {name:'content.xml',text:content},
    {name:'styles.xml',text:styles},
    ...pics.map(p=>({name:p.name,data:p.data}))
  ]));
}

/* ---------- RTF ---------- */
async function buildRtf(){
  const paras=docModel(),cols=[],fonts=[],ci=hex=>{let i=cols.indexOf(hex);if(i<0){cols.push(hex);i=cols.length-1}return i+1};
  const fi=n=>{let i=fonts.indexOf(n);if(i<0){fonts.push(n);i=fonts.length-1}return i};
  fi(S.font);
  const esc=str=>{let o='';for(const ch of str){const c=ch.codePointAt(0);
    if(ch==='\\')o+='\\\\';else if(ch==='{')o+='\\{';else if(ch==='}')o+='\\}';
    else if(c>=32&&c<127)o+=ch;
    else if(c===9)o+='\\tab ';
    else if(c<32){}
    else if(c<0x10000)o+='\\u'+(c>32767?c-65536:c)+'?';
    else{const k=c-0x10000,hi=0xD800+(k>>10),lo=0xDC00+(k&1023);o+='\\u'+(hi-65536)+'?\\u'+(lo-65536)+'?'}
  }return o};
  const hp=px=>Math.max(2,Math.round(px*.75*2));
  const fmt=n=>{
    let o='\\f'+fi(n.font||S.font);
    if(n.b)o+='\\b';if(n.i)o+='\\i';if(n.u)o+='\\ul';if(n.s)o+='\\strike';
    if(n.va)o+=n.va==='sup'?'\\super':'\\sub';
    if(n.c)o+='\\cf'+ci(n.c.join(','));
    if(n.bg)o+='\\highlight'+ci(n.bg.join(','));
    return o+'\\fs'+hp(n.px||BASE);
  };
  let body='';
  for(const p of paras){
    const jc={center:'\\qc',right:'\\qr',justify:'\\qj'}[p.al]||'\\ql';
    body+='\\pard'+jc+'\\sa120 ';
    for(const r of p.runs){
      if(r.br)body+='\\line ';
      else if(r.img){
        const im=await prepImg(r.img,['image/png','image/jpeg']);if(!im)continue;
        let wt=Math.round(im.pct/100*TXT_W_TW),ht=Math.round(wt*im.h/im.w);
        let hex='';for(let i=0;i<im.bytes.length;i++)hex+=im.bytes[i].toString(16).padStart(2,'0');
        body+=`{\\pict${im.mime==='image/png'?'\\pngblip':'\\jpegblip'}\\picw${im.w}\\pich${im.h}\\picwgoal${wt}\\pichgoal${ht}\n${hex.replace(/(.{128})/g,'$1\n')}}`;
      }else body+='{'+fmt(r)+' '+esc(r.t)+'}';
    }
    body+='\\par\n';
  }
  const ct='{\\colortbl ;'+cols.map(c=>{const[r,g,b]=c.split(',');return`\\red${r}\\green${g}\\blue${b};`}).join('')+'}';
  const ft='{\\fonttbl'+fonts.map((n,i)=>`{\\f${i}\\f${fontKind(n)==='serif'?'roman':fontKind(n)==='monospace'?'modern':'swiss'} ${esc(n)};}`).join('')+'}';
  return '{\\rtf1\\ansi\\ansicpg1251\\deff0\\uc1\\paperw11906\\paperh16838\\margl1134\\margr1134\\margt1134\\margb1134'+ft+ct+'\\f0\\fs'+hp(BASE)+' '+body+'}';
}

async function doSave(kind){
  $('#saveAsModal').hidden=true;
  try{
    if(kind==='all')scSaveAll();
    else if(kind==='docx')saveFile(docTitle()+'.docx',await buildDocx(),true);
    else if(kind==='odt')saveFile(docTitle()+'.odt',await buildOdt(),true);
    else if(kind==='rtf')saveFile(docTitle()+'.rtf',await buildRtf());
    else if(kind==='txt')saveFile(docTitle()+'.txt',edText('\n\n').replace(/\n{3,}/g,'\n\n'));
  }catch(e){toast(t('Saving did not work in this window.')+' '+String((e&&e.message)||e),true)}
}
$$('[data-save]').forEach(b=>b.addEventListener('click',()=>doSave(b.dataset.save)));
function openSaveDlg(){$('#saveAsModal').hidden=false;const b=$('#saveAsModal [data-save]');if(b)b.focus()}
$('#miSaveAs').addEventListener('click',openSaveDlg);
$('#saClose').addEventListener('click',()=>{$('#saveAsModal').hidden=true});
$('#saveAsModal').addEventListener('mousedown',e=>{if(e.target===e.currentTarget)e.currentTarget.hidden=true});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#saveAsModal').hidden){e.preventDefault();$('#saveAsModal').hidden=true}},true);
