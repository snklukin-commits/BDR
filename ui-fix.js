(() => {
  'use strict';

  const STORE_KEYS = [
    'bdr.money.app.v10',
    'bdr.money.app.v9',
    'bdr.money.app.v8',
    'bdr.money.app.v7',
    'bdr.money.app.v6',
    'bdr.money.app.v5',
    'bdr.money.app.v4',
    'bdr.money.app.v3'
  ];

  let last = null;
  let busy = false;

  function readState() {
    for (const key of STORE_KEYS) {
      try {
        const state = JSON.parse(localStorage.getItem(key));
        if (state && Array.isArray(state.operations)) return state;
      } catch (_) {}
    }
    return { operations: Array.isArray(window.operations) ? window.operations : [] };
  }

  function clean(value) {
    return String(value || '').trim();
  }

  function money(value) {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0
    }).format(Number(value) || 0);
  }

  function compactDate(value) {
    const text = clean(value);
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return text || '—';
    return `${m[3]}.${m[2]}.${m[1].slice(2)}`;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"]/g, ch => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;'
    }[ch]));
  }

  function isActive(card) {
    const bg = (getComputedStyle(card).backgroundColor || '').replace(/\s/g, '');
    return bg === 'rgb(17,17,17)' || card.style.background === '#111';
  }

  function getSelectedCard() {
    const cards = Array.from(document.querySelectorAll('[data-list-mode][data-list-cat]'));
    const activeCard = cards.find(isActive);
    if (activeCard) return activeCard;
    if (!last) return null;
    return cards.find(card => card.dataset.listMode === last.mode && card.dataset.listCat === last.category) || null;
  }

  function getRows(mode, category) {
    const state = readState();
    return (state.operations || [])
      .filter(op => op && op.category === category)
      .filter(op => op.includeTotals !== false)
      .filter(op => {
        if (mode === 'income') return op.direction === 'Доход';
        return op.direction === 'Расход' || op.direction === 'Возврат';
      })
      .slice(0, 8);
  }

  function rowHtml(op) {
    const amount = Number(op.amount) || 0;
    const amountColor = amount < 0 ? '#b42318' : '#087f5b';
    return `<div style="display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border-radius:16px;background:#fff;color:#171717;box-shadow:inset 0 0 0 1px rgba(23,23,23,.08)">
      <span style="font-size:12px;color:#7a746b;white-space:nowrap">${compactDate(op.date)}</span>
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(op.description || 'Без описания')}</span>
      <b style="white-space:nowrap;color:${amountColor}">${money(amount)}</b>
    </div>`;
  }

  function removeOldDrilldowns() {
    document.querySelectorAll('.bdr-drill-below').forEach(node => node.remove());
    document.querySelectorAll('[data-list-mode][data-list-cat] .scroll').forEach(node => {
      const outer = node.parentElement;
      if (outer && outer.tagName === 'DIV') outer.remove();
      else node.remove();
    });
  }

  function renderBelow() {
    if (busy) return;
    busy = true;
    requestAnimationFrame(() => {
      removeOldDrilldowns();
      const card = getSelectedCard();
      if (!card) {
        busy = false;
        return;
      }
      const mode = card.dataset.listMode;
      const category = card.dataset.listCat;
      if (!mode || !category || !isActive(card)) {
        busy = false;
        return;
      }
      const ops = getRows(mode, category);
      const block = document.createElement('div');
      block.className = 'bdr-drill-below';
      block.style.cssText = 'margin:8px 0 12px;padding:12px;border-radius:20px;background:#fffaf2;box-shadow:0 10px 24px rgba(24,20,15,.08);display:grid;gap:8px';
      block.innerHTML = ops.length
        ? ops.map(rowHtml).join('')
        : '<div style="padding:12px;color:#7a746b">Операций для раскрытия нет</div>';
      card.insertAdjacentElement('afterend', block);
      busy = false;
    });
  }

  document.addEventListener('click', event => {
    const target = event.target.closest('[data-list-mode][data-list-cat], [data-chart-mode][data-chart-cat]');
    if (!target) return;
    last = {
      mode: target.dataset.listMode || target.dataset.chartMode,
      category: target.dataset.listCat || target.dataset.chartCat
    };
    setTimeout(renderBelow, 80);
    setTimeout(renderBelow, 250);
  }, true);

  new MutationObserver(() => {
    if (last) setTimeout(renderBelow, 40);
  }).observe(document.body, { childList: true, subtree: true });

  window.addEventListener('load', () => setTimeout(renderBelow, 500));
})();
