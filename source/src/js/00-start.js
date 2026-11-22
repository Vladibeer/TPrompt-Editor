(()=>{
'use strict';
/* грешки, които програмата преодолява, без да спира: записват се (конзола + последните 50 в tpErrors), вместо да се крият */
const tpErrors=[];
function oops(where,e){try{tpErrors.push({where,msg:String(e&&e.message||e),t:Date.now()});if(tpErrors.length>50)tpErrors.shift();console.warn('[TPrompt]',where,e)}catch(_){}}
window.tpErrors=tpErrors;

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const BASE=24; // базов размер в редактора (px) = 100%
