(() => {
  'use strict';

  const STORE_KEYS = ['bdr.money.app.product.1','bdr.money.app.stable.1','bdr.money.app.v12','bdr.money.app.v11','bdr.money.app.v10','bdr.money.app.v9','bdr.money.app.v8','bdr.money.app.v7','bdr.money.app.v6','bdr.money.app.v5','bdr.money.app.v4','bdr.money.app.v3'];
  let currentKey = null;
  let selectedCreditId = localStorage.getItem('bdr.selected.credit') || '';

  function uid(){ return crypto && crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(16).slice(2); }
  function money(value){ return new Intl.NumberFormat('ru-RU', {style:'currency', currency:'RUB', maximumFractionDigits:0}).format(Number(value) || 0); }
  function number(value){ if(typeof value === 'number') return value; if(value == null) return 0; return Number(String(value).replace(/\s| /g,'').replace(',','.').replace(/[₽р]/gi,'')) || 0; }
  function round(value){ return Math.round((Number(value) || 0) * 100) / 100; }
  function escapeHtml(value){ return String(value ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function clean(value){ return String(value ?? '').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim(); }
  function dateText(value){ const text = String(value || '').slice(0,10); const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : (text || '—'); }
  function addMonths(dateString, months){ const source = dateString || new Date().toISOString().slice(0,10); const date = new Date(source + 'T00:00:00'); date.setMonth(date.getMonth() + months); return date.toISOString().slice(0,10); }
  function monthKey(dateString){ return String(dateString || '').slice(0,7); }

  function readState(){
    for(const key of STORE_KEYS){
      try{
        const state = JSON.parse(localStorage.getItem(key));
        if(state && (Array.isArray(state.operations) || Array.isArray(state.credits))){
          currentKey = key;
          state.operations = state.operations || [];
          state.credits = (state.credits || []).map(normalizeCredit);
          return state;
        }
      }catch(_){ }
    }
    currentKey = STORE_KEYS[0];
    return {operations:[], credits:[]};
  }
  function saveState(state){ localStorage.setItem(currentKey || STORE_KEYS[0], JSON.stringify(state)); }

  function normalizeCredit(raw){
    raw = raw || {};
    const startDate = raw.startDate || new Date().toISOString().slice(0,10);
    return {
      id: raw.id || uid(),
      name: raw.name || 'Ипотека',
      type: raw.type || 'Ипотека',
      startDate,
      objectCost: number(raw.objectCost),
      downPayment: number(raw.downPayment),
      principal: number(raw.principal || raw.loanAmount),
      currentBalance: number(raw.currentBalance),
      annualRate: number(raw.annualRate || 18.5),
      months: Math.max(1, Math.round(number(raw.months || (number(raw.years) * 12) || 180))),
      payment: number(raw.payment),
      firstPaymentDate: raw.firstPaymentDate || addMonths(startDate, 1),
      strategy: raw.strategy || raw.prepaymentStrategy || 'term',
      prepayments: (raw.prepayments || []).map(p => ({
        id: p.id || uid(),
        date: p.date || new Date().toISOString().slice(0,10),
        amount: number(p.amount),
        type: p.type || 'term',
        comment: p.comment || '',
        sourceOperationId: p.sourceOperationId || ''
      }))
    };
  }

  function annuityPayment(principal, annualRate, months){
    principal = Math.max(0, number(principal));
    months = Math.max(1, Math.round(number(months)));
    const rate = number(annualRate) / 100 / 12;
    if(!principal) return 0;
    if(!rate) return principal / months;
    return principal * rate / (1 - Math.pow(1 + rate, -months));
  }

  function simulateCredit(credit, forcedPayment){
    const startBalance = credit.currentBalance > 0 ? credit.currentBalance : credit.principal;
    let balance = Math.max(0, startBalance);
    let payment = forcedPayment > 0 ? forcedPayment : annuityPayment(balance, credit.annualRate, credit.months);
    const monthlyRate = credit.annualRate / 100 / 12;
    const prepayments = (credit.prepayments || []).filter(p => p.amount > 0).slice().sort((a,b) => String(a.date).localeCompare(String(b.date)));
    let date = credit.firstPaymentDate || addMonths(credit.startDate, 1);
    let totalInterest = 0;
    let totalBankPaid = 0;
    let n = 0;
    const schedule = [];

    while(balance > 0.01 && n < 600){
      n += 1;
      const interest = balance * monthlyRate;
      let regularPayment = payment;
      if(regularPayment > balance + interest) regularPayment = balance + interest;
      let principalPaid = Math.max(0, regularPayment - interest);
      if(principalPaid > balance) principalPaid = balance;
      balance = Math.max(0, balance - principalPaid);
      let prepay = 0;
      const thisMonth = monthKey(date);
      prepayments.forEach(item => {
        if(monthKey(item.date) !== thisMonth || balance <= 0) return;
        const amount = Math.min(balance, item.amount);
        prepay += amount;
        balance = Math.max(0, balance - amount);
        if(item.type === 'payment' && balance > 0){
          const monthsLeft = Math.max(1, credit.months - n);
          payment = annuityPayment(balance, credit.annualRate, monthsLeft);
        }
      });
      totalInterest += interest;
      totalBankPaid += regularPayment + prepay;
      schedule.push({n, date, payment:regularPayment, interest, principalPaid, prepay, balance, totalPaid:totalBankPaid});
      if(balance <= 0.01) break;
      if(credit.strategy === 'payment' && balance > 0){
        const monthsLeft = Math.max(1, credit.months - n);
        payment = annuityPayment(balance, credit.annualRate, monthsLeft);
      }
      date = addMonths(date, 1);
    }
    return {payment:forcedPayment > 0 ? forcedPayment : annuityPayment(startBalance, credit.annualRate, credit.months), startBalance, remaining:balance, totalInterest, totalBankPaid, monthsToClose:schedule.length, closeDate:schedule.length ? schedule[schedule.length - 1].date : '', schedule};
  }

  function calculateCredit(credit){
    const payment = credit.payment > 0 ? credit.payment : annuityPayment(credit.currentBalance > 0 ? credit.currentBalance : credit.principal, credit.annualRate, credit.months);
    const base = simulateCredit({...credit, prepayments:[]}, payment);
    const scenario = simulateCredit(credit, payment);
    scenario.savings = Math.max(0, base.totalInterest - scenario.totalInterest);
    scenario.baseTotalInterest = base.totalInterest;
    scenario.fullCost = credit.downPayment + scenario.totalBankPaid;
    return scenario;
  }

  function table(headers, rows, emptyText){
    if(!rows.length) return `<div class="empty">${emptyText || 'Нет данных'}</div>`;
    return `<div class="scroll"><table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  }
  function creditOptions(credits, selectedId){ return credits.map(c => `<option value="${c.id}" ${c.id === selectedId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join(''); }

  function form(credit){
    return `<div class="grid2">
      <label>Название кредита<input id="creditName" value="${escapeHtml(credit.name)}"></label>
      <label>Тип кредита<select id="creditType">${['Ипотека','Потребительский кредит','Автокредит','Кредитная карта','Другое'].map(t => `<option ${credit.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label>Дата выдачи<input id="creditStart" type="date" value="${escapeHtml(credit.startDate)}"></label>
      <label>Дата первого платежа<input id="creditFirst" type="date" value="${escapeHtml(credit.firstPaymentDate)}"></label>
      <label>Стоимость объекта / покупки<input id="creditObject" inputmode="decimal" value="${credit.objectCost || ''}" placeholder="например 3 000 000"></label>
      <label>Первоначальный взнос<input id="creditDown" inputmode="decimal" value="${credit.downPayment || ''}" placeholder="например 700 000"></label>
      <label>Сумма кредита<input id="creditPrincipal" inputmode="decimal" value="${credit.principal || ''}" placeholder="например 2 300 000"></label>
      <label>Текущий остаток долга<input id="creditBalance" inputmode="decimal" value="${credit.currentBalance || ''}" placeholder="можно оставить пустым"></label>
      <label>Ставка годовых, %<input id="creditRate" inputmode="decimal" value="${credit.annualRate || ''}" placeholder="18.5"></label>
      <label>Срок, лет<input id="creditYears" inputmode="decimal" value="${round(credit.months / 12)}" placeholder="15"></label>
      <label>Платёж по графику<input id="creditPayment" inputmode="decimal" value="${credit.payment || ''}" placeholder="если пусто — рассчитается"></label>
      <label>Стратегия досрочных<select id="creditStrategy"><option value="term" ${credit.strategy === 'term' ? 'selected' : ''}>Сокращать срок</option><option value="payment" ${credit.strategy === 'payment' ? 'selected' : ''}>Сокращать платёж</option></select></label>
    </div>`;
  }
  function manualPrepaymentForm(){
    return `<details class="rule-card"><summary style="font-weight:900;cursor:pointer">Добавить вручную, если операции нет в выписке</summary><div class="toolbar" style="margin-top:12px">
      <input id="prepayDate" type="date" value="${new Date().toISOString().slice(0,10)}">
      <input id="prepayAmount" inputmode="decimal" placeholder="Сумма досрочного">
      <select id="prepayType"><option value="term">Сократить срок</option><option value="payment">Сократить платёж</option></select>
      <input id="prepayComment" placeholder="Комментарий">
      <button id="addPrepayment" class="primary">Добавить вручную</button>
    </div></details>`;
  }
  function prepaymentTable(credit){
    const rows = credit.prepayments.slice().sort((a,b) => String(a.date).localeCompare(String(b.date))).map(p => `<tr><td>${dateText(p.date)}</td><td>${money(p.amount)}</td><td>${p.type === 'payment' ? 'Сокращение платежа' : 'Сокращение срока'}</td><td>${escapeHtml(p.comment)}${p.sourceOperationId ? '<br><span class="muted small">из транзакции</span>' : ''}</td><td><button class="danger" data-delete-prepayment="${p.id}">Удалить</button></td></tr>`);
    return table(['Дата','Сумма','Тип','Комментарий',''], rows, 'Досрочных погашений нет');
  }
  function scheduleTable(schedule){
    const rows = schedule.map(r => `<tr><td>${r.n}</td><td>${dateText(r.date)}</td><td>${money(r.payment)}</td><td>${money(r.interest)}</td><td>${money(r.principalPaid)}</td><td>${money(r.prepay)}</td><td>${money(r.balance)}</td></tr>`);
    return table(['№','Дата','Платёж','Проценты','Тело','Досрочно','Остаток'], rows, 'График пуст');
  }
  function creditOperations(state){ return (state.operations || []).filter(op => ['Кредиты/ипотека','Ипотека/жильё: справочно'].includes(op.category)); }
  function isExpenseCreditOperation(op){ return ['Кредиты/ипотека','Ипотека/жильё: справочно'].includes(op.category) && number(op.amount) < 0; }
  function candidateTransactions(state, credit){
    const used = new Set((credit.prepayments || []).map(p => p.sourceOperationId).filter(Boolean));
    return (state.operations || [])
      .filter(op => isExpenseCreditOperation(op))
      .filter(op => !used.has(op.id))
      .sort((a,b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 120);
  }
  function transactionPicker(state, credit){
    const rows = candidateTransactions(state, credit).map(op => {
      const defaultType = clean([op.description, op.bankCategory, op.sourceType].join(' ')).includes('платеж') ? 'term' : 'term';
      return `<tr><td>${dateText(op.date)}</td><td>${escapeHtml(op.description || 'Без описания')}</td><td>${money(Math.abs(number(op.amount)))}</td><td><select data-prepay-type="${op.id}"><option value="term" ${defaultType === 'term' ? 'selected' : ''}>Сократить срок</option><option value="payment">Сократить платёж</option></select></td><td><button class="primary" data-add-from-operation="${op.id}">Добавить</button></td></tr>`;
    });
    return `<h3>Выбрать досрочное из транзакций</h3><p class="muted small">Выбирай здесь фактическую банковскую операцию досрочного погашения. Она привяжется к кредиту и больше не будет предлагаться повторно.</p>${table(['Дата','Описание','Сумма','Тип',''], rows, 'Нет доступных кредитных транзакций для выбора')}`;
  }

  function renderCredits(){
    const root = document.getElementById('credits');
    if(!root) return;
    const state = readState();
    if(!state.credits.length){ state.credits.push(normalizeCredit({name:'Ипотека', type:'Ипотека', annualRate:18.5, months:180})); saveState(state); }
    const selected = state.credits.find(item => item.id === selectedCreditId) || state.credits[0];
    selectedCreditId = selected.id;
    localStorage.setItem('bdr.selected.credit', selectedCreditId);
    const result = calculateCredit(selected);
    const operations = creditOperations(state);
    root.innerHTML = `
      <div class="card white"><h3>Кредитный калькулятор</h3><div class="toolbar"><select id="creditSelect">${creditOptions(state.credits, selected.id)}</select><button id="newCredit">Новый кредит</button><button id="deleteCredit" class="danger">Удалить</button></div>${form(selected)}<div class="toolbar"><button id="saveCredit" class="primary">Сохранить и пересчитать</button></div></div>
      <div class="grid"><div class="card"><div class="kpi-title">Платёж</div><div class="value">${money(result.payment)}</div></div><div class="card"><div class="kpi-title">Закрытие</div><div class="value">${result.monthsToClose} мес.</div><div class="muted small">${dateText(result.closeDate)}</div></div><div class="card"><div class="kpi-title">Проценты банку</div><div class="value">${money(result.totalInterest)}</div></div><div class="card"><div class="kpi-title">Экономия</div><div class="value good">${money(result.savings)}</div></div></div>
      <div class="grid2"><div class="card"><h3>Полная стоимость</h3>${table(['Показатель','Сумма'], [['Стоимость объекта', money(selected.objectCost)],['Первоначальный взнос', money(selected.downPayment)],['Сумма кредита', money(selected.principal)],['Расчётный остаток', money(result.remaining)],['Всего выплат банку', money(result.totalBankPaid)],['Проценты банку', money(result.totalInterest)],['Полная стоимость для меня', money(result.fullCost)]].map(([a,b]) => `<tr><td>${a}</td><td>${b}</td></tr>`))}</div><div class="card">${transactionPicker(state, selected)}${manualPrepaymentForm()}<h3>Добавленные досрочные</h3>${prepaymentTable(selected)}</div></div>
      <div class="card"><h3>График платежей</h3>${scheduleTable(result.schedule)}</div>
      <div class="card"><h3>Операции по кредитам</h3>${table(['Дата','Описание','Сумма'], operations.map(op => `<tr><td>${dateText(op.date)}</td><td>${escapeHtml(op.description)}</td><td>${money(op.amount)}</td></tr>`), 'Кредитных операций нет')}</div>`;
    bindEvents(state, selected);
  }

  function updateCreditFromForm(credit){
    credit.name = document.getElementById('creditName').value || 'Кредит';
    credit.type = document.getElementById('creditType').value;
    credit.startDate = document.getElementById('creditStart').value;
    credit.firstPaymentDate = document.getElementById('creditFirst').value;
    credit.objectCost = number(document.getElementById('creditObject').value);
    credit.downPayment = number(document.getElementById('creditDown').value);
    credit.principal = number(document.getElementById('creditPrincipal').value);
    credit.currentBalance = number(document.getElementById('creditBalance').value);
    credit.annualRate = number(document.getElementById('creditRate').value);
    credit.months = Math.max(1, Math.round(number(document.getElementById('creditYears').value) * 12));
    credit.payment = number(document.getElementById('creditPayment').value);
    credit.strategy = document.getElementById('creditStrategy').value;
  }
  function addPrepaymentFromOperation(state, credit, operationId){
    const op = (state.operations || []).find(item => String(item.id) === String(operationId));
    if(!op) return alert('Транзакция не найдена');
    const typeSelect = document.querySelector(`[data-prepay-type="${CSS.escape(operationId)}"]`);
    const type = typeSelect ? typeSelect.value : 'term';
    const amount = Math.abs(number(op.amount));
    if(amount <= 0) return alert('У транзакции нет суммы');
    credit.prepayments.push({
      id: uid(),
      date: op.date || new Date().toISOString().slice(0,10),
      amount,
      type,
      comment: op.description || 'Досрочное из транзакции',
      sourceOperationId: op.id
    });
    op.creditId = credit.id;
    op.creditRole = 'prepayment';
    op.prepaymentType = type;
    op.includeTotals = false;
    op.block = 'Кредиты';
    saveState(state);
    renderCredits();
  }
  function bindEvents(state, credit){
    document.getElementById('creditSelect').onchange = event => { selectedCreditId = event.target.value; localStorage.setItem('bdr.selected.credit', selectedCreditId); renderCredits(); };
    document.getElementById('newCredit').onclick = () => { const item = normalizeCredit({name:'Новый кредит', type:'Ипотека', annualRate:18.5, months:180}); state.credits.push(item); selectedCreditId = item.id; saveState(state); renderCredits(); };
    document.getElementById('deleteCredit').onclick = () => { if(state.credits.length <= 1) return alert('Нельзя удалить последний кредит'); if(!confirm('Удалить этот кредит?')) return; state.credits = state.credits.filter(item => item.id !== credit.id); selectedCreditId = state.credits[0].id; saveState(state); renderCredits(); };
    document.getElementById('saveCredit').onclick = () => { updateCreditFromForm(credit); saveState(state); renderCredits(); };
    document.getElementById('addPrepayment').onclick = () => { const amount = number(document.getElementById('prepayAmount').value); if(amount <= 0) return alert('Укажи сумму досрочного погашения'); credit.prepayments.push({id:uid(), date:document.getElementById('prepayDate').value || new Date().toISOString().slice(0,10), amount, type:document.getElementById('prepayType').value, comment:document.getElementById('prepayComment').value || '', sourceOperationId:''}); saveState(state); renderCredits(); };
    document.querySelectorAll('[data-add-from-operation]').forEach(button => { button.onclick = () => addPrepaymentFromOperation(state, credit, button.dataset.addFromOperation); });
    document.querySelectorAll('[data-delete-prepayment]').forEach(button => { button.onclick = () => { const removed = credit.prepayments.find(item => item.id === button.dataset.deletePrepayment); credit.prepayments = credit.prepayments.filter(item => item.id !== button.dataset.deletePrepayment); if(removed && removed.sourceOperationId){ const op = (state.operations || []).find(item => item.id === removed.sourceOperationId); if(op){ delete op.creditRole; delete op.prepaymentType; } } saveState(state); renderCredits(); }; });
  }
  function init(){ renderCredits(); const tab = document.querySelector('[data-tab="credits"]'); if(tab) tab.addEventListener('click', () => setTimeout(renderCredits, 0)); }
  window.addEventListener('load', init);
})();