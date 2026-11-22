/* ----- Лента: размер, шрифт, стил на реда ----- */
const sizeSel=$('#sizeSel'),fontSel=$('#fontSel'),blockSel=$('#blockSel');
[8,9,10,11,12,13,14,15,16,18,20,22,24,26,28,32,36,40,48,60,72,96].forEach(p=>{const o=document.createElement('option');o.value=p;o.textContent=p;sizeSel.appendChild(o)});   /* пунктове, както във Word; 18 пт = основният размер на редактора */
FONTS.forEach(([n])=>{const o=document.createElement('option');o.value=n;o.textContent=n;o.style.fontFamily=fam(n);fontSel.appendChild(o)});
blockSel.addEventListener('change',()=>{const v=blockSel.value,c=tt.chain().focus();(v==='p'?c.setParagraph():c.setHeading({level:+v[1]})).run();blockSel.blur()});
sizeSel.addEventListener('change',()=>{applySize(parseFloat(sizeSel.value));sizeSel.blur();syncSz()});
/* видимото поле за размер: ръчно въвеждане (до 3 цифри, може и .5) или избор от списъка през шеврона; скритият select пази стойностите */
const sizeIn=$('#sizeIn');
function syncSz(){if(document.activeElement===sizeIn)return;sizeIn.value=sizeSel.selectedIndex>=0?sizeSel.value:''}
function commitSz(){
  const v=parseFloat(String(sizeIn.value).replace(',','.'));
  if(v>0&&v<=999)applySize(Math.round(v*2)/2);   /* както във Word – с точност до половин пункт */
  else syncSz();
}
sizeIn.addEventListener('input',()=>{const c=sizeIn.value.replace(',','.').replace(/[^\d.]/g,'').replace(/(\..*)\./,'$1');if(c!==sizeIn.value)sizeIn.value=c});
sizeIn.addEventListener('focus',()=>sizeIn.select());
sizeIn.addEventListener('keydown',e=>{
  if(e.key==='Enter'){e.preventDefault();commitSz();sizeIn.blur()}
  else if(e.key==='Escape'){e.preventDefault();e.stopPropagation();sizeIn.blur();syncSz();try{tt.commands.focus()}catch(e){oops('commitSz#1',e)}}
  else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();const v=(parseFloat(sizeIn.value)||parseFloat(sizeSel.value)||18)+(e.key==='ArrowUp'?1:-1);if(v>0&&v<=999){sizeIn.value=v;commitSz()}}
});
sizeIn.addEventListener('blur',()=>{syncSz()});

fontSel.addEventListener('change',()=>{tt.chain().focus().setFontFamily(fam(fontSel.value).replace(/"/g,"'")).run();fontSel.blur()});
