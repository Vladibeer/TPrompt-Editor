/* ----- старт с Windows (само в Windows приложението) ----- */
if(IS_TAURI&&!VIEWER){
  const sec=$('#autoSec'),tg=$('#autoTgl');
  tinvoke('autostart_get').then(v=>{sec.hidden=false;tg.checked=!!v}).catch(e=>{oops('#szChev click#1',e)});
  tg.addEventListener('change',async()=>{
    const want=tg.checked;
    try{const ok=await tinvoke('autostart_set',{enabled:want});if(!ok){tg.checked=!want;toast(t('Could not save the setting.'),true)}}
    catch(e){tg.checked=!want;toast(String(e),true)}
  });
}
