/* ---------- Клавишни комбинации ---------- */
// Шорткътите ползват физическия клавиш (e.code), за да работят при всякаква подредба (напр. BG)
const LETTER={KeyN:'n',KeyP:'p',KeyF:'f',KeyM:'m',KeyH:'h',KeyV:'v',KeyS:'s',KeyB:'b',KeyT:'t',KeyC:'c',KeyE:'e',KeyO:'o'};
function keyName(e){
  const c=e.code;
  if(c==='Space')return 'space';
  /* < и > са физическите клавиши запетая и точка (и клавишът до Shift на европейските клавиатури), без значение от подредбата */
  if(e.key==='<'||c==='Comma'||(c==='IntlBackslash'&&!e.shiftKey))return '<';
  if(e.key==='>'||c==='Period'||(c==='IntlBackslash'&&e.shiftKey))return '>';
  if(LETTER[c])return LETTER[c];
  const d=c&&c.match(/^(?:Digit|Numpad)([0-9])$/);if(d)return d[1];
  if(c==='Equal'||c==='NumpadAdd')return 'plus';
  if(c==='Minus'||c==='NumpadSubtract')return 'minus';
  if(c==='BracketLeft')return '[';
  if(c==='BracketRight')return ']';
  const k=e.key;
  if(k===' ')return 'space';
  if(k==='+'||k==='=')return 'plus';
  if(k==='-'||k==='_')return 'minus';
  return k.length===1?k.toLowerCase():k;
}