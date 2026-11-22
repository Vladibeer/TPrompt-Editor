/* ---------- Елементи ---------- */
const editorWrap=$('#editor'), tt=TPEd.create(editorWrap), editor=tt.view.dom, prompter=$('#prompter'), stage=$('#stage'), viewport=$('#viewport'), scroller=$('#scroller'), textcol=$('#textcol'), hud=$('#hud'), settings=$('#settings');
let reading=false, playing=false, pos=0, maxPos=0, raf=0, lastT=0, lastTickAt=0, hudTimer=0, dragMoved=false, remain=0;
