/* ----- роли: докато устройството управлява четенето, главният прозорец на компютъра е само за наблюдение ----- */
(()=>{
  if(VIEWER)return {};
  const box=$('#ctlLock'),wrap=$('#ctlPvWrap'),pvx=$('#ctlPv'),stg=$('#ctlStage'),scr=$('#ctlScroller'),txt=$('#ctlText'),mk=$('#ctlMk');
  let locked=false,shownHtml=null,sig='',inerted=[],raf=0,lastSt=null,base={frac:0,fr:0,ts:0},disp=0,maxY=0,last=0,shownY=NaN,dims={W:1280,H:720};
  const ps=()=>(lastNet&&lastNet.S)||{};
  /* текстът от устройството се показва като във втория прозорец: същото форматиране, без огледало */
  function mirror(h){
    const d=new DOMParser().parseFromString(h||'','text/html').body;
    d.querySelectorAll('script,iframe,object,embed,link,meta').forEach(n=>n.remove());
    d.querySelectorAll('*').forEach(el=>{[...el.attributes].forEach(a=>{if(/^on/i.test(a.name))el.removeAttribute(a.name)})});
    d.querySelectorAll('[style]').forEach(el=>{const fs=el.style.fontSize;if(fs&&fs.endsWith('px'))el.style.fontSize=`calc(var(--pfs) * ${(parseFloat(fs)/BASE).toFixed(4)})`});
    findBm(d).forEach(stripTilde);
    return d.innerHTML;
  }
  function applyVars(){
    const q=ps(),r=pvx.style;
    r.setProperty('--pfs',(q.fs||64)+'px');r.setProperty('--plh',q.lh||1.35);r.setProperty('--ppg',(q.pgap!=null?q.pgap:.6)+'em');r.setProperty('--pw',(q.width||82)+'%');
    r.setProperty('--pcolor',q.color||'#ffffff');r.setProperty('--pbg',q.bg||'#000000');r.setProperty('--pfont',fam(q.font||'Open Sans'));
  }
  function layout(){
    const q=ps(),W=dims.W,H=dims.H,aw=wrap.clientWidth;if(!aw||!W||!H)return;
    const ah=Math.max(140,Math.min(innerHeight*.6,640));
    const sc=Math.min(aw/W,ah/H);
    pvx.style.width=(W*sc)+'px';pvx.style.height=(H*sc)+'px';
    stg.style.width=W+'px';stg.style.height=H+'px';stg.style.transform='scale('+sc+')';
    const my=q.markerY==null?42:q.markerY,mh=q.markerH||140;
    scr.style.paddingTop=(H*my/100)+'px';scr.style.paddingBottom=(H*(1-my/100))+'px';
    maxY=Math.max(0,scr.offsetHeight-H);
    mk.style.display=q.marker?'block':'none';
    mk.style.top=(H*my/100-mh/2)+'px';mk.style.height=mh+'px';
    mk.style.background='color-mix(in srgb,'+(q.markerColor||'#ffb547')+' 22%,transparent)';
    shownY=NaN;
  }
  function frame(now){
    raf=0;if(!locked)return;
    if(netSt!==lastSt){
      lastSt=netSt;
      if(netSt){
        base={frac:netSt.frac||0,fr:netSt.rate&&netSt.max?netSt.rate/netSt.max:0,ts:netSt.ts||Date.now()};
        if(netSt.W&&netSt.H&&(netSt.W!==dims.W||netSt.H!==dims.H)){dims={W:netSt.W,H:netSt.H};layout()}
      }
    }
    const dt=Math.min(.1,Math.max(0,(now-last)/1000));last=now;
    const target=Math.min(1,Math.max(0,base.frac+base.fr*Math.max(0,performance.timeOrigin+now-base.ts)/1000));
    /* малка разлика се изглажда, голям скок (отметка, начало) става веднага */
    const gap=Math.abs(target-disp)*maxY;
    if(gap>60||(netSt&&netSt.ease))disp=target;   /* при плъзгане вторият прозорец праща позиция на всеки кадър: следва се точно */
    else if(base.fr<=0){if(gap<.05)disp=target;else disp+=(target-disp)*(1-Math.exp(-dt*14))}
    else{const step=base.fr*dt,err=target-disp-step;disp+=step+err*(1-Math.exp(-dt/.18))}
    disp=Math.min(1,Math.max(0,disp));
    if(now-lastBar>120){lastBar=now;paintBar()}   /* иконата и числата се опресняват рядко; лентата за напредък - на всеки кадър */
    else{(fillEl||(fillEl=$('#r2ProgFill'))).style.transform=`scaleX(${Math.min(1,Math.max(0,disp))})`}
    const y=Math.round(disp*maxY*20)/20;
    if(y!==shownY){shownY=y;scr.style.transform='translate3d(0,'+(-y)+'px,0)'}
    raf=requestAnimationFrame(frame);
  }
  function lock(){
    if(locked)return;locked=true;
    if(reading)stopReading();
    document.body.classList.add('ctlLock');
    inerted=[...document.body.children].filter(el=>el!==box&&el.tagName!=='SCRIPT'&&el.id!=='toast'&&!el.hasAttribute('inert'));
    inerted.forEach(el=>el.setAttribute('inert',''));
    $('#ctlBarSlot').appendChild($('#rBar2'));   /* същият контролен панел като навсякъде */
    box.hidden=false;
    try{document.activeElement&&document.activeElement.blur&&document.activeElement.blur()}catch(e){oops('lock#1',e)}
    shownHtml=null;sig='';lastSt=null;disp=0;base={frac:0,fr:0,ts:0};
    refresh();
    last=performance.now();if(!raf)raf=requestAnimationFrame(frame);
  }
  function unlock(){
    if(!locked)return;locked=false;
    inerted.forEach(el=>el.removeAttribute('inert'));inerted=[];
    $('#remote').insertBefore($('#rBar2'),$('#rProg'));
    box.hidden=true;shownHtml=null;txt.innerHTML='';
    document.body.classList.remove('ctlLock');
  }
  function refresh(){
    const want=!!(netCtl&&lastNet);
    if(want&&!locked){lock();return}
    if(!want){unlock();return}
    if(!locked)return;
    const h=lastNet.html||'',q=ps();
    const sg=JSON.stringify([q.fs,q.lh,q.width,q.color,q.bg,q.font,q.markerY,q.markerH,q.marker,q.markerColor,q.noteColor]);
    let relayout=false;
    if(sg!==sig){sig=sg;applyVars();relayout=true}
    if(h!==shownHtml){shownHtml=h;txt.innerHTML=mirror(h);relayout=true}
    if(relayout)layout();
    paintBar();
  }
  function takeOver(){
    /* същото като при затваряне от устройството: устройството получава „край“ през състоянието (seq се сменя), вторият прозорец се затваря, а главният показва редактора */
    takeUntil=performance.now()+4000;
    netSt=null;netSeq++;netDirty=true;netCtl=false;lastNet=null;
    closePopup();
    unlock();updateOpenLabel();updateRemote();
    toast(t('Control is on {d}.',{d:ownN('own')}));
  }
  $('#ctlTake').addEventListener('click',takeOver);
  /* управление на четящия прозорец от компютъра; състоянието се връща към устройството през същия канал */
  const cmd=(c,a)=>post({type:'cmd',cmd:c,arg:a});
  let want=null,wantT=0,shownPl=null;
  const playingNow=()=>{
    if(want!==null&&performance.now()-wantT<1500&&!(netSt&&netSt.playing===want))return want;
    want=null;return !!(netSt&&netSt.playing);
  };
  let lastBar=0,fillEl=null;
  function paintBar(){
    const v=playingNow(),q=ps();
    if(v!==shownPl){shownPl=v;setIcon($('#r2Play i'),v?'pause':'play');$('#r2Play').setAttribute('aria-pressed',String(!!v))}
    setTxt($('#r2Spd'),q.speed!=null?q.speed:S.speed);setTxt($('#r2Fs'),q.fs!=null?q.fs:S.fs);
    $('#r2ProgFill').style.transform=`scaleX(${Math.min(1,Math.max(0,disp))})`;
  }
  function doPlay(){const v=!playingNow();want=v;wantT=performance.now();cmd('play',v);paintBar()}
  /* скорост и размер отиват само към четящия прозорец, без да пипат настройките на компютъра */
  function bumpNet(k,d){const q=ps(),v=clamp(k,Math.round(((q[k]!=null?q[k]:S[k])+d)*100)/100);if(lastNet)lastNet.S=Object.assign({},lastNet.S,{[k]:v});post({type:'settings',S:{[k]:v}});paintBar()}
  const act={r2Home:()=>cmd('home'),r2Play:doPlay,r2SpdDn:()=>bumpNet('speed',-5),r2SpdUp:()=>bumpNet('speed',5),r2FsDn:()=>bumpNet('fs',-1),r2FsUp:()=>bumpNet('fs',1)};
  /* в заключено състояние тези бутони не минават през обработчиците за редактора */
  Object.keys(act).forEach(id=>$('#'+id).addEventListener('click',e=>{if(!locked)return;e.stopImmediatePropagation();act[id]();e.currentTarget.blur()},true));
  {
    const pr=$('#r2Prog');let dg=false;
    const sk=e=>{const r=pr.getBoundingClientRect();const f=Math.min(1,Math.max(0,(e.clientX-r.left)/r.width));cmd('seek',f);disp=f};
    pr.addEventListener('pointerdown',e=>{if(!locked)return;e.stopImmediatePropagation();dg=true;try{pr.setPointerCapture(e.pointerId)}catch(e){oops('sk#1',e)}sk(e)},true);
    pr.addEventListener('pointermove',e=>{if(locked&&dg){e.stopImmediatePropagation();sk(e)}},true);
    pr.addEventListener('pointerup',e=>{if(locked){e.stopImmediatePropagation();dg=false}},true);
  }
  const keyAct={' ':doPlay,Home:()=>cmd('home'),End:()=>cmd('end'),ArrowLeft:()=>cmd('prev'),PageUp:()=>cmd('prev'),ArrowRight:()=>cmd('next'),PageDown:()=>cmd('next')};
  /* всички останали клавиши и влачене на файлове към заключения прозорец се блокират */
  window.addEventListener('keydown',e=>{
    if(!locked)return;
    const f=!e.ctrlKey&&!e.altKey&&!e.metaKey&&keyAct[e.key];
    if(f){e.preventDefault();e.stopPropagation();if(!e.repeat)f();return}
    if(!box.contains(e.target)){e.preventDefault();e.stopPropagation()}
  },true);
  window.addEventListener('keyup',e=>{if(locked&&e.key===' ')e.preventDefault()},true);
  ['dragover','drop'].forEach(n=>box.addEventListener(n,e=>{e.preventDefault();e.stopPropagation()}));
  window.addEventListener('resize',()=>{if(locked)layout()});
  setInterval(refresh,200);
  return {refresh,takeOver,locked:()=>locked};
})();
