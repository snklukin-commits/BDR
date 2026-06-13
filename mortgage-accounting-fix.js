(() => {
  'use strict';
  const KEYS = ['bdr.money.app.v10','bdr.money.app.v9','bdr.money.app.v8','bdr.money.app.v7','bdr.money.app.v6','bdr.money.app.v5','bdr.money.app.v4','bdr.money.app.v3'];
  const RX = /(ипотек|первоначальн|первоначальный взнос|кредитные средства|выдача кредита|зачисление кредита|лицевой счет|лицевой сч|л\/с|эскроу|дду|жилье|жильё|квартира)/i;

  function text(op) {
    return [op.description, op.bankCategory, op.sourceType, op.category, op.direction, op.block, op.account, op.status].join(' ');
  }

  function amount(op) {
    return Math.abs(Number(op.amount) || 0);
  }

  function isMortgage(op) {
    const t = text(op);
    if (RX.test(t)) return true;
    if ((op.direction === 'Доход' || Number(op.amount) > 0) && amount(op) >= 1000000 && /(банк|зачисл|поступл|перевод)/i.test(t)) return true;
    return false;
  }

  function fixState(state) {
    if (!state || !Array.isArray(state.operations)) return false;
    let changed = false;
    state.operations.forEach(op => {
      if (!op || !isMortgage(op)) return;
      const before = [op.category, op.direction, op.includeTotals, op.block].join('|');
      op.category = 'Ипотека/жильё: справочно';
      op.direction = 'Справочно';
      op.includeTotals = false;
      op.block = 'Кредиты';
      op.discretionary = false;
      op.mortgageReference = true;
      op.manuallyEdited = true;
      const after = [op.category, op.direction, op.includeTotals, op.block].join('|');
      if (before !== after) changed = true;
    });
    state.rules = state.rules || [];
    if (!state.rules.some(r => String(r.name || '').includes('Ипотека справочно'))) {
      state.rules.push({
        id: 'rule_mortgage_reference_' + Date.now(),
        enabled: true,
        name: 'Ипотека справочно',
        matchType: 'regex',
        pattern: 'ипотек|первоначальн|первоначальный взнос|кредитные средства|лицевой счет|эскроу|дду|жилье|жильё|квартира',
        category: 'Ипотека/жильё: справочно',
        direction: 'Справочно',
        includeTotals: false,
        priority: 250
      });
      changed = true;
    }
    return changed;
  }

  function run() {
    let changed = false;
    KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const state = JSON.parse(raw);
        if (fixState(state)) {
          localStorage.setItem(key, JSON.stringify(state));
          changed = true;
        }
      } catch (_) {}
    });
    if (changed && !sessionStorage.getItem('bdr.mortgage.fix.reloaded')) {
      sessionStorage.setItem('bdr.mortgage.fix.reloaded', '1');
      location.reload();
    }
  }

  window.addEventListener('load', () => setTimeout(run, 300));
})();