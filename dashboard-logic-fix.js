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

  const ROUTINE = [
    'Продукты и супермаркеты','Маркетплейсы/покупки','Доставка/Еда вне дома','Транспорт',
    'Связь, интернет, подписки','Здоровье, аптеки и уход','Услуги/комиссии','Страхование',
    'Наличные','Ремонт/дом','Прочие расходы'
  ];
  const STABLE_INCOME = ['Зарплата','Стипендия','Проценты и бонусы'];
  const ORDINARY_INCOME = ['Зарплата','Стипендия','Проценты и бонусы','Поступления от людей','Прочие доходы'];
  const CREDIT_CATS = ['Кредиты/ипотека','Ипотека/жильё: справочно'];

  let mode = localStorage.getItem('bdr.dashboard.mode') || 'total';
  let currentStoreKey = null;
  let normalizedOnce = false;

  function readState() {
    for (const key of STORE_KEYS) {
      try {
        const state = JSON.parse(localStorage.getItem(key));
        if (state && Array.isArray(state.operations)) {
          currentStoreKey = key;
          return state;
        }
      } catch (_) {}
    }
    currentStoreKey = STORE_KEYS[0];
    return { operations: Array.isArray(window.operations) ? window.operations : [], limits: {}, settings: {} };
  }

  function saveState(state) {
    localStorage.setItem(currentStoreKey || STORE_KEYS[0], JSON.stringify(state));
  }

  function money(n) {
    return new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 }).format(Number(n) || 0);
  }

  function num(v) { return Number(v) || 0; }
  function abs(v) { return Math.abs(num(v)); }
  function monthOf(op) { return String(op.month || op.date || '').slice(0, 7) || 'Без месяца'; }
  function daysInMonth(month) { const [y,m] = String(month).split('-').map(Number); return new Date(y, m, 0).getDate() || 30; }
  function dayOfMonth(date) { const d = String(date || '').slice(8, 10); return Number(d) || 1; }
  function todayDayFor(month, ops) {
    const nowMonth = new Date().toISOString().slice(0, 7);
    if (month === nowMonth) return new Date().getDate();
    const days = ops.filter(op => monthOf(op) === month).map(op => dayOfMonth(op.date));
    return Math.max(1, ...days);
  }

  function normalizeCreditAccounting() {
    if (normalizedOnce) return;
    normalizedOnce = true;
    const state = readState();
    let changed = false;
    (state.operations || []).forEach(op => {
      if (CREDIT_CATS.includes(op.category) && op.includeTotals !== false) {
        op.includeTotals = false;
        op.block = 'Кредиты';
        op.discretionary = false;
        changed = true;
      }
    });
    if (changed) saveState(state);
  }

  function summarize(ops) {
    const s = {
      ordinaryIncome:0, stableIncome:0, routine:0, zhkh:0, large:0, transfers:0, creditInfo:0,
      byRoutine:{}, byIncome:{}
    };
    (ops || []).forEach(op => {
      const cat = op.category;
      const amount = num(op.amount);
      const amountAbs = abs(amount);
      const dir = op.direction;

      if (CREDIT_CATS.includes(cat)) {
        s.creditInfo += amountAbs;
        return;
      }
      if (op.includeTotals === false) return;

      if (dir === 'Доход') {
        if (ORDINARY_INCOME.includes(cat)) {
          s.ordinaryIncome += amount;
          s.byIncome[cat] = (s.byIncome[cat] || 0) + amount;
        }
        if (STABLE_INCOME.includes(cat)) s.stableIncome += amount;
      }

      if (dir === 'Расход') {
        if (ROUTINE.includes(cat)) {
          s.routine += amountAbs;
          s.byRoutine[cat] = (s.byRoutine[cat] || 0) + amountAbs;
        }
        if (cat === 'ЖКХ/квартплата') s.zhkh += amountAbs;
        if (cat === 'Крупные разовые расходы') s.large += amountAbs;
        if (cat === 'Переводы другим людям') s.transfers += amountAbs;
      }

      if (dir === 'Возврат' && ROUTINE.includes(cat)) {
        s.routine -= amountAbs;
        s.byRoutine[cat] = (s.byRoutine[cat] || 0) - amountAbs;
      }
    });
    return s;
  }

  function months(ops) {
    return [...new Set((ops || []).map(monthOf).filter(Boolean).filter(m => /^\d{4}-\d{2}$/.test(m)))].sort();
  }

  function averageMonthly(ops) {
    const ms = months(ops);
    if (!ms.length) return summarize([]);
    const total = summarize(ops);
    const div = ms.length || 1;
    return {
      ordinaryIncome: total.ordinaryIncome / div,
      stableIncome: total.stableIncome / div,
      routine: total.routine / div,
      zhkh: total.zhkh / div,
      large: total.large / div,
      transfers: total.transfers / div,
      creditInfo: total.creditInfo / div
    };
  }

  function selectedMonth() {
    const select = document.getElementById('monthPick');
    if (select && /^\d{4}-\d{2}$/.test(select.value)) return select.value;
    const ms = months(readState().operations);
    return ms[ms.length - 1] || new Date().toISOString().slice(0,7);
  }

  function sumLimits(state) {
    let total = 0;
    Object.entries(state.limits || {}).forEach(([cat, cfg]) => {
      if (ROUTINE.includes(cat)) total += Number(cfg && cfg.value) || 0;
    });
    return total;
  }

  function dashboardPanel() {
    const state = readState();
    const ops = state.operations || [];
    const total = summarize(ops);
    const avg = averageMonthly(ops);
    const data = mode === 'avg' ? avg : total;
    const label = mode === 'avg' ? 'Среднемесячно' : 'Итого за период';
    const monthsCount = months(ops).length;
    const creditNote = total.creditInfo ? `<div class="muted" style="font-size:12px;margin-top:8px">Кредиты/ипотека исключены из общих расчётов: ${money(total.creditInfo)} справочно.</div>` : '';

    return `<div id="bdrDashPanel" class="card" style="background:#fff;box-shadow:0 12px 32px rgba(24,20,15,.08)">
      <div style="display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">${label}</h3>
        <div style="display:flex;gap:6px;background:#f0eadf;border-radius:999px;padding:4px">
          <button id="bdrModeTotal" style="padding:8px 10px;box-shadow:none;background:${mode==='total'?'#111':'transparent'};color:${mode==='total'?'#fff':'#5e5447'}">Итого</button>
          <button id="bdrModeAvg" style="padding:8px 10px;box-shadow:none;background:${mode==='avg'?'#111':'transparent'};color:${mode==='avg'?'#fff':'#5e5447'}">В месяц</button>
        </div>
      </div>
      <div class="grid">
        <div><div class="kpi-title">Обычные доходы</div><div class="value">${money(data.ordinaryIncome)}</div></div>
        <div><div class="kpi-title">Стабильные доходы</div><div class="value">${money(data.stableIncome)}</div></div>
        <div><div class="kpi-title">Рутина без кредитов</div><div class="value">${money(data.routine)}</div></div>
        <div><div class="kpi-title">ЖКХ</div><div class="value">${money(data.zhkh)}</div></div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">Месяцев в расчёте: ${monthsCount || 0}. Кредиты и ипотека не входят в общие доходы/расходы.</div>
      ${creditNote}
    </div>`;
  }

  function injectDashboardPanel() {
    const dashboard = document.getElementById('dashboard');
    if (!dashboard) return;
    const old = document.getElementById('bdrDashPanel');
    if (old) old.remove();
    const hero = dashboard.querySelector('.hero');
    if (!hero) return;
    hero.insertAdjacentHTML('afterend', dashboardPanel());
    const totalBtn = document.getElementById('bdrModeTotal');
    const avgBtn = document.getElementById('bdrModeAvg');
    if (totalBtn) totalBtn.onclick = () => { mode = 'total'; localStorage.setItem('bdr.dashboard.mode', mode); injectDashboardPanel(); };
    if (avgBtn) avgBtn.onclick = () => { mode = 'avg'; localStorage.setItem('bdr.dashboard.mode', mode); injectDashboardPanel(); };
  }

  function forecastPanel() {
    const state = readState();
    const ops = state.operations || [];
    const m = selectedMonth();
    const monthOps = ops.filter(op => monthOf(op) === m);
    const fact = summarize(monthOps);
    const elapsed = Math.min(todayDayFor(m, monthOps), daysInMonth(m));
    const totalDays = daysInMonth(m);
    const forecastRoutine = elapsed > 0 ? fact.routine / elapsed * totalDays : fact.routine;

    const allMonths = months(ops).filter(x => x !== m);
    const avgRoutine = allMonths.length
      ? allMonths.reduce((sum, month) => sum + summarize(ops.filter(op => monthOf(op) === month)).routine, 0) / allMonths.length
      : averageMonthly(ops).routine;

    const limit = sumLimits(state);
    const limitDiff = limit > 0 ? forecastRoutine - limit : null;
    const avgDiff = forecastRoutine - avgRoutine;
    const dailyNow = elapsed > 0 ? fact.routine / elapsed : 0;
    const dailyPlan = totalDays > 0 ? (limit > 0 ? limit : avgRoutine) / totalDays : 0;

    return `<div id="bdrForecastPanel" class="card" style="background:#fff;box-shadow:0 12px 32px rgba(24,20,15,.08)">
      <h3>Прогноз текущего месяца</h3>
      <div class="grid">
        <div><div class="kpi-title">Факт рутины</div><div class="value">${money(fact.routine)}</div></div>
        <div><div class="kpi-title">Прогноз рутины</div><div class="value">${money(forecastRoutine)}</div></div>
        <div><div class="kpi-title">Отклонение от среднего</div><div class="value ${avgDiff>0?'bad':'good'}">${avgDiff>0?'+':''}${money(avgDiff)}</div></div>
        <div><div class="kpi-title">Отклонение от лимита</div><div class="value ${limitDiff===null?'':limitDiff>0?'bad':'good'}">${limitDiff===null?'Лимит не задан':(limitDiff>0?'+':'')+money(limitDiff)}</div></div>
      </div>
      <div class="muted" style="font-size:12px;margin-top:8px">Прошло дней: ${elapsed} из ${totalDays}. Сейчас в день: ${money(dailyNow)}. Плановый темп: ${money(dailyPlan)}.</div>
    </div>`;
  }

  function injectForecastPanel() {
    const current = document.getElementById('current');
    if (!current) return;
    const old = document.getElementById('bdrForecastPanel');
    if (old) old.remove();
    const toolbar = current.querySelector('.toolbar');
    if (!toolbar) return;
    toolbar.insertAdjacentHTML('afterend', forecastPanel());
  }

  function patch() {
    normalizeCreditAccounting();
    injectDashboardPanel();
    injectForecastPanel();
  }

  new MutationObserver(() => setTimeout(patch, 40)).observe(document.body, { childList:true, subtree:true });
  window.addEventListener('load', () => setTimeout(patch, 400));
  setInterval(patch, 1200);
})();
