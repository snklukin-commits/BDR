(() => {
  'use strict';

  function cleanupDashboard() {
    const panel = document.getElementById('bdrDashPanel');
    if (!panel) return;

    panel.querySelectorAll('.kpi-title').forEach(title => {
      const text = (title.textContent || '').trim().toLowerCase();
      if (text === 'жкх' || text.includes('кредит')) {
        const card = title.parentElement;
        if (card) card.remove();
      }
    });

    panel.querySelectorAll('.muted').forEach(node => {
      const text = node.textContent || '';
      if (text.includes('Месяцев в расчёте') || text.includes('Кредиты') || text.includes('ипотека')) node.remove();
    });
  }

  new MutationObserver(() => setTimeout(cleanupDashboard, 30)).observe(document.body, { childList: true, subtree: true });
  window.addEventListener('load', () => setTimeout(cleanupDashboard, 500));
  setInterval(cleanupDashboard, 1000);
})();
