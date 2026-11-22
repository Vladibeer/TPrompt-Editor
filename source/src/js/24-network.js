/* ---------- Управление в мрежа ----------
   Windows приложението е „компютър“: има малък сървър и показва текста във втория прозорец.
   Всяко друго устройство (Android приложението, браузър) е „устройство“: свързва се с компютъра,
   редактира, управлява и вижда превю. Двете страни говорят със същите съобщения като двата прозореца. */
function openRemote(v){
  if(v===false){NETC.stopScan();return}
  toggleSettings(true);
  setTab('conn',true);
  if(HOSTROLE)HOST.enter();
  NETC.ui();
  renderNetworkSettings();
}
/* ----- смяна на ролята: Монитор (показва QR код) или Дистанционно (сканира QR код) ----- */
async function switchRole(role,act){
  if(VIEWER)return;
  const toHost=role==='host';
  if(HOSTROLE===toHost){   /* ролята е същата: „Сканирай“ само пуска камерата, „Покажи“ вече показва кода */
    if(!toHost){if(netApi)netApi.scan()}
    else{await HOST.enter();renderNetworkSettings()}   /* ролята вече е Монитор, но сървърът е спрян: пускаме го */
    return;
  }
  if(toHost&&!canHost()){toast(t('This device cannot be a Monitor.'),true);return}
  try{closePopup()}catch(e){oops('switchRole#1',e)}
  /* ролята се сменя на място, без презареждане на интерфейса */
  try{
    if(HOSTROLE)await HOST.stop();
    else if(netApi&&netApi.state().on)netApi.disc();
  }catch(e){oops('switchRole#2',e)}
  try{scFlush()}catch(e){oops('switchRole#3',e)}
  try{localStorage.setItem('tp.role',role)}catch(e){oops('switchRole#4',e)}
  HOSTROLE=toHost;
  try{if(toHost)HOST.hooks();else NETC.hooks()}catch(e){oops('switchRole#5',e)}
  setNetRoleTab(toHost?'host':'cli');
  if(toHost)await HOST.enter();
  try{NETC.ui()}catch(e){oops('switchRole#6',e)}
  renderNetworkSettings();
  try{updateOpenLabel()}catch(e){oops('switchRole#7',e)}
  if(!toHost&&act==='scan')setTimeout(()=>{if(netApi)netApi.scan()},300);
}
function remoteGo(){
  if(HOSTROLE){
    const h=hostApi();
    if(h.viewing()){closePopup();return}
    if(!h.linked()){toast(t('Connect a device: scan the QR code.'));openRemote(true);return}
    h.showOnPhone();updateOpenLabel();return;
  }
  const n=netApi?netApi.state():null;
  if(n&&n.on){if(popupOpen())closePopup();else netApi.open();return}   /* свързан: показваме или затваряме прозореца на компютъра */
  toast(t('Connect a device to show the text on it.'));openRemote(true);
}
$('#bRemote').addEventListener('click',()=>openRemote(true));
$('#rmShow').addEventListener('click',closeRun);   /* действията са в диалога „Пусни“: след избор той се затваря */
