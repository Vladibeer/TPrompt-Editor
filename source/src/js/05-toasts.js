/* ---------- Тостове ---------- */
let toastT=0;
function toast(msg,err){const t=$('#toast');t.textContent=msg;t.classList.toggle('err',!!err);t.classList.add('show');clearTimeout(toastT);toastT=setTimeout(()=>t.classList.remove('show'),err?4200:2400)}
