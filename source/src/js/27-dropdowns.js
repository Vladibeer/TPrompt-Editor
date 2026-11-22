/* ----- собствени падащи менюта ----- */
(()=>{
  const CHK='<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7"/></svg>';
  let menu=null,cur=null,curAnchor=null,items=[],act=-1;
  const fontish=sel=>sel.id==='fontSel'||sel.id==='fontG';
  function close(){if(!menu)return;menu.remove();menu=null;cur=null;curAnchor=null;items=[];act=-1}
  function setAct(i,scroll){
    if(!items.length)return;act=(i+items.length)%items.length;
    items.forEach((el,k)=>el.classList.toggle('act',k===act));
    if(scroll)items[act].scrollIntoView({block:'nearest'});
  }
  function pick(i){
    const sel=cur,o=sel&&sel.options[i];close();if(!o)return;
    if(sel.value!==o.value){sel.value=o.value;sel.dispatchEvent(new Event('input',{bubbles:true}));sel.dispatchEvent(new Event('change',{bubbles:true}))}
  }
  function open(sel,anchor){
    if(cur===sel){close();return}
    close();cur=sel;curAnchor=anchor||null;
    menu=document.createElement('div');menu.className='ddm';menu.setAttribute('role','listbox');
    [...sel.options].forEach((o,i)=>{
      const it=document.createElement('div');it.className='it';it.setAttribute('role','option');
      it.setAttribute('aria-selected',String(o.value===sel.value));
      const tx=document.createElement('span');tx.textContent=o.textContent;if(fontish(sel))tx.style.fontFamily='"'+o.textContent+'",sans-serif';
      it.appendChild(tx);it.insertAdjacentHTML('beforeend',CHK);
      it.addEventListener('mousedown',e=>e.preventDefault());
      it.addEventListener('click',()=>pick(i));
      it.addEventListener('mousemove',()=>setAct(i,false));
      menu.appendChild(it);
    });
    items=[...menu.children];
    document.body.appendChild(menu);
    const r=(anchor||sel).getBoundingClientRect(),vh=innerHeight,vw=innerWidth;
    menu.style.minWidth=Math.max(160,r.width)+'px';
    const mh=Math.min(menu.scrollHeight+2,320,vh-16);
    const below=vh-r.bottom-8,above=r.top-8;
    const top=(below>=Math.min(mh,200)||below>=above)?Math.min(r.bottom+4,vh-mh-8):Math.max(8,r.top-4-mh);
    menu.style.maxHeight=Math.min(320,vh-16)+'px';menu.style.top=Math.max(8,top)+'px';
    const mw=menu.offsetWidth;menu.style.left=Math.max(8,Math.min(r.left,vw-mw-8))+'px';
    const si=Math.max(0,sel.selectedIndex);setAct(si,true);
  }
  function enhance(sel){
    if(sel.__dd)return;sel.__dd=true;
    const block=e=>{e.preventDefault()};
    sel.addEventListener('mousedown',e=>{if(e.button!==0)return;block(e);open(sel)});
    let tp=null;
    sel.addEventListener('touchstart',e=>{const t0=e.touches[0];tp=t0?[t0.clientX,t0.clientY]:null},{passive:true});
    sel.addEventListener('touchend',e=>{
      const t0=e.changedTouches[0];
      if(tp&&t0&&Math.abs(t0.clientX-tp[0])<10&&Math.abs(t0.clientY-tp[1])<10&&e.cancelable){block(e);open(sel)}
      tp=null;
    });
    sel.addEventListener('keydown',e=>{
      const k=e.key;
      if(menu&&cur===sel){
        if(k==='ArrowDown'){e.preventDefault();setAct(act+1,true)}
        else if(k==='ArrowUp'){e.preventDefault();setAct(act-1,true)}
        else if(k==='Home'){e.preventDefault();setAct(0,true)}
        else if(k==='End'){e.preventDefault();setAct(items.length-1,true)}
        else if(k==='Enter'||k===' '){e.preventDefault();pick(act)}
        else if(k==='Escape'||k==='Tab'){if(k==='Escape')e.preventDefault();close()}
      }else if(k==='Enter'||k===' '||(e.altKey&&(k==='ArrowDown'||k==='ArrowUp'))||k==='F4'){e.preventDefault();open(sel)}
    });
    sel.addEventListener('blur',()=>{if(cur===sel)setTimeout(()=>{if(cur===sel&&document.activeElement!==sel)close()},0)});
  }
  $$('select').forEach(enhance);
  $('#szChev').addEventListener('mousedown',e=>e.preventDefault());
  $('#szChev').addEventListener('click',()=>open(sizeSel,$('#szBox')));
  document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target)&&e.target!==cur&&!(curAnchor&&curAnchor.contains(e.target)))close()},true);
  document.addEventListener('keydown',e=>{if(menu&&e.key==='Escape'&&document.activeElement!==cur){e.preventDefault();close()}},true);
  window.addEventListener('resize',close);
  window.addEventListener('blur',close);
  document.addEventListener('scroll',e=>{if(menu&&!menu.contains(e.target))close()},true);
})();
