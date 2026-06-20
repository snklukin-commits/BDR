(() => {
  'use strict';
  const STORE = 'bdr.money.app.stable.2';
  const MIRROR = 'bdr.money.app.product.1';
  const css = `
    :root{--bg:#f6f7f9;--ink:#111827;--muted:#6b7280;--line:#d9dde5;--panel:#fff;--soft:#f3f4f6;--green:#047857;--red:#b42318;--amber:#b45309;--shadow:0 16px 40px rgba(17,24,39,.08);--radius:8px}
    html,body{background:#f6f7f9!important;color:#111827!important}body{background:linear-gradient(180deg,#fbfcfe 0,#f6f7f9 280px,#f6f7f9 100%)!important}.app{max-width:1220px}.brand{letter-spacing:-.03em!important}.avatar,.brand-mark{border-radius:8px!important;background:#111827!important;color:#fff!important}.tabs{background:rgba(255,255,255,.92)!important;border:1px solid #e5e7eb!important;border-radius:12px!important;box-shadow:0 10px 24px rgba(17,24,39,.06)!important}.tab,button,input,select,textarea{border-radius:8px!important}.tab,button{box-shadow:none!important}.tab.active,button.primary{background:#111827!important;border-color:#111827!important;color:#fff!important}.card{background:#fff!important;border:1px solid #e5e7eb!important;border-radius:8px!important;box-shadow:0 16px 40px rgba(17,24,39,.08)!important}.card.white{background:#fff!important}.hero{background:#111827!important;border-radius:8px!important;box-shadow:0 16px 40px rgba(17,24,39,.12)!important}.hero:after{display:none!important}.hero-value{letter-spacing:-.04em!important}.chip{background:#eef2f7!important;color:#374151!important}.hero .chip{background:rgba(255,255,255,.12)!important;color:#fff!important}.kpi-title,h3{letter-spacing:.07em!important}.value{letter-spacing:-.04em!important}.good{color:#047857!important}.bad{color:#b42318!important}.warn{color:#b45309!important}.drop{border:1px dashed #b8c0cc!important;background:#fff!important;border-radius:8px!important}.empty{border-radius:8px!important;background:#fff!important}.rule-card,.bank-card{border-radius:8px!important}.bar{background:#eef1f5!important}.top-actions{display:flex;gap:8px;align-items:center}.top-actions button{white-space:nowrap}.bdr-product-note{margin:0 0 14px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff;color:#6b7280;font-size:13px}.bdr-product-note b{color:#111827}.bdr-quality-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:0 0 14px}.bdr-quality-grid>div{padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#fff}.bdr-quality-grid b{display:block;margin-bottom:3px}@media(max-width:760px){.bdr-quality-grid{grid-template-columns:1fr}.top-actions{display:none}.tabs{border-radius:14px!important}.tab{min-width:auto!important}}
  `;
  function injectCss(){
    if(document.getElementById('bdr-polish-css')) return;
    const style=document.createElement('style');
    style.id='bdr-polish-css';
    style.textContent=css;
    document.head.appendChild(style);
  }
  function mirrorState(){
    const data=localStorage.getItem(STORE);
    if(data) localStorage.setItem(MIRROR,data);
  }
  function activate(tab){
    document.querySelectorAll('.tab,.section').forEach(el=>el.classList.remove('active'));
    document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active');
    document.getElementById(tab)?.classList.add('active');
  }
  function wireTopActions(){
    const topbar=document.querySelector('.topbar');
    if(!topbar || document.getElementById('bdrTopActions')) return;
    const avatar=topbar.querySelector('.avatar');
    if(avatar) avatar.remove();
    const box=document.createElement('div');
    box.id='bdrTopActions';
    box.className='top-actions';
    box.innerHTML='<button id="bdrGoOps">Операции</button><button id="bdrGoImport" class="primary">Импорт</button>';
    topbar.appendChild(box);
    document.getElementById('bdrGoOps').onclick=()=>activate('operations');
    document.getElementById('bdrGoImport').onclick=()=>activate('manage');
  }
  function addProductNotes(){
    const dash=document.getElementById('dashboard');
    if(dash && dash.classList.contains('active') && !dash.querySelector('.bdr-product-note')){
      const note=document.createElement('div');
      note.className='bdr-product-note';
      note.innerHTML='<b>Рабочая версия БДР.</b> Основной сценарий: импорт банковских файлов, проверка категорий, контроль текущего месяца, структура расходов и резервная копия базы.';
      dash.prepend(note);
    }
    const manage=document.getElementById('manage');
    if(manage && manage.classList.contains('active') && !manage.querySelector('.bdr-quality-grid')){
      const grid=document.createElement('div');
      grid.className='bdr-quality-grid';
      grid.innerHTML='<div><b>1. Импорт</b><span class="muted small">Загрузи Сбер/Т-Банк XLSX или CSV.</span></div><div><b>2. Проверка</b><span class="muted small">Разбери «Прочие расходы» и исключения.</span></div><div><b>3. Контроль</b><span class="muted small">Сохрани резервную копию после правок.</span></div>';
      manage.prepend(grid);
    }
  }
  function polish(){injectCss();mirrorState();wireTopActions();addProductNotes();}
  window.addEventListener('load',polish);
  document.addEventListener('click',()=>setTimeout(polish,0));
  new MutationObserver(()=>polish()).observe(document.documentElement,{childList:true,subtree:true});
  setInterval(mirrorState,1500);
})();