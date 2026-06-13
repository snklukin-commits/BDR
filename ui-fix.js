(() => {
  function active(el) {
    return (getComputedStyle(el).backgroundColor || '').replace(/\s/g, '') === 'rgb(17,17,17)';
  }

  function rowHtml(cols) {
    const d = (cols[0] || '').replace(/^(\d{4})-(\d{2})-(\d{2}).*/, '$3.$2.$1').replace(/\.(\d{4})$/, (_, y) => '.' + y.slice(2));
    const text = cols[1] || 'Без описания';
    const sum = cols[2] || '';
    return '<div style="display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border-radius:16px;background:#fff;color:#171717;box-shadow:inset 0 0 0 1px rgba(23,23,23,.08)"><span style="font-size:12px;color:#7a746b;white-space:nowrap">' + d + '</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + text + '</span><b style="white-space:nowrap">' + sum + '</b></div>';
  }

  function patch() {
    document.querySelectorAll('.bdr-drill-below').forEach(x => x.remove());
    document.querySelectorAll('[data-list-mode][data-list-cat]').forEach(card => {
      const wrap = card.querySelector('.scroll');
      if (!wrap) return;
      const rows = Array.from(wrap.querySelectorAll('tbody tr')).map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.textContent.trim())).filter(r => r.some(Boolean));
      const container = wrap.parentElement;
      if (container) container.remove(); else wrap.remove();
      if (!active(card)) return;
      const block = document.createElement('div');
      block.className = 'bdr-drill-below';
      block.style.cssText = 'margin:8px 0 12px;padding:12px;border-radius:20px;background:#fffaf2;box-shadow:0 10px 24px rgba(24,20,15,.08);display:grid;gap:8px';
      block.innerHTML = rows.length ? rows.slice(0, 8).map(rowHtml).join('') : '<div style="padding:12px;color:#7a746b">Операций для раскрытия нет</div>';
      card.insertAdjacentElement('afterend', block);
    });
  }

  new MutationObserver(patch).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', patch);
  setInterval(patch, 800);
})();
