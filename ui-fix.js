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

  const CATEGORIES = [
    'Зарплата','Стипендия','Проценты и бонусы','Поступления от людей','Пополнение наличными','Прочие доходы','Ипотека/жильё: справочно','Продукты и супермаркеты','Маркетплейсы/покупки','Доставка/Еда вне дома','Транспорт','Связь, интернет, подписки','ЖКХ/квартплата','Здоровье, аптеки и уход','Услуги/комиссии','Страхование','Наличные','Переводы другим людям','Кредиты/ипотека','Ремонт/дом','Крупные разовые расходы','Прочие расходы','Не учитывается'
  ];
  const DIRECTIONS = ['Доход','Расход','Возврат','Справочно','Внутренний перевод','Техническая операция'];

  let last = null;
  let busy = false;
  let currentStoreKey = null;

  function readBundle() {
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
    return { operations: Array.isArray(window.operations) ? window.operations : [], rules: [] };
  }

  function saveState(state) {
    localStorage.setItem(currentStoreKey || STORE_KEYS[0], JSON.stringify(state));
  }

  function money(value) {
    return new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(Number(value) || 0);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  }

  function currentYear() { return new Date().getFullYear(); }

  function repairDate(value) {
    const text = String(value || '').trim();
    const m = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return text;
    let year = Number(m[1]);
    const month = m[2];
    const day = m[3];
    const nowYear = currentYear();
    if (year !== nowYear && ['03','04','05','06'].includes(month)) year = nowYear;
    return `${year}-${month}-${day}`;
  }

  function compactDate(value) {
    const fixed = repairDate(value);
    const m = fixed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return fixed || '—';
    return `${m[3]}.${m[2]}.${String(m[1]).slice(2)}`;
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/ё/g, 'е')
      .replace(/\+?\d[\d\s()\-]{5,}/g, ' ')
      .replace(/[0-9]+/g, ' ')
      .replace(/[.,;:!?"'`~()[\]{}<>/\\|_+=*№#%&^$@]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function merchantKey(description) {
    const normalized = normalizeText(description);
    if (!normalized) return '';
    const words = normalized.split(' ').filter(w => w.length > 1 && !['оплата','покупка','перевод','платеж','заказ','карта','счет','tinkoff','sber'].includes(w));
    if (!words.length) return normalized;
    return words.slice(0, Math.min(3, words.length)).join(' ');
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

  function directionOk(mode, op) {
    if (mode === 'income') return op.direction === 'Доход';
    return op.direction === 'Расход' || op.direction === 'Возврат';
  }

  function getRows(mode, category) {
    const state = readBundle();
    return (state.operations || [])
      .filter(op => op && op.category === category)
      .filter(op => op.includeTotals !== false)
      .filter(op => directionOk(mode, op))
      .slice(0, 12);
  }

  function rowHtml(op) {
    const amount = Number(op.amount) || 0;
    const amountColor = amount < 0 ? '#b42318' : '#087f5b';
    const id = esc(op.id || '');
    return `<button data-edit-op="${id}" style="width:100%;border:0;display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border-radius:16px;background:#fff;color:#171717;box-shadow:inset 0 0 0 1px rgba(23,23,23,.08);text-align:left;font:inherit;cursor:pointer">
      <span style="font-size:12px;color:#7a746b;white-space:nowrap">${compactDate(op.date)}</span>
      <span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(op.description || 'Без описания')}</span>
      <b style="white-space:nowrap;color:${amountColor}">${money(amount)}</b>
    </button>`;
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
      if (!card || !isActive(card)) { busy = false; return; }
      const mode = card.dataset.listMode;
      const category = card.dataset.listCat;
      const ops = getRows(mode, category);
      const block = document.createElement('div');
      block.className = 'bdr-drill-below';
      block.style.cssText = 'margin:8px 0 12px;padding:12px;border-radius:20px;background:#fffaf2;box-shadow:0 10px 24px rgba(24,20,15,.08);display:grid;gap:8px';
      block.innerHTML = ops.length ? ops.map(rowHtml).join('') : '<div style="padding:12px;color:#7a746b">Операций для раскрытия нет</div>';
      card.insertAdjacentElement('afterend', block);
      bindEditRows();
      busy = false;
    });
  }

  function options(values, selected) {
    return values.map(v => `<option value="${esc(v)}" ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
  }

  function openEditor(id) {
    const state = readBundle();
    const op = (state.operations || []).find(item => String(item.id) === String(id));
    if (!op) return;
    const key = merchantKey(op.description);
    const similarCount = (state.operations || []).filter(item => merchantKey(item.description) === key).length;
    document.querySelectorAll('.bdr-sheet').forEach(x => x.remove());
    const sheet = document.createElement('div');
    sheet.className = 'bdr-sheet';
    sheet.style.cssText = 'position:fixed;inset:auto 0 0 0;z-index:9999;background:#fffaf2;border-radius:28px 28px 0 0;box-shadow:0 -22px 60px rgba(24,20,15,.24);padding:18px;display:grid;gap:12px';
    sheet.innerHTML = `
      <div style="width:42px;height:5px;border-radius:999px;background:#d8cbb8;margin:0 auto 4px"></div>
      <div style="font-weight:950;font-size:18px">Редактировать операцию</div>
      <div style="color:#7a746b;font-size:13px">${compactDate(op.date)} · ${esc(op.description || 'Без описания')}</div>
      <label style="display:grid;gap:6px;font-size:13px;color:#7a746b">Категория<select id="sheetCat">${options(CATEGORIES, op.category)}</select></label>
      <label style="display:grid;gap:6px;font-size:13px;color:#7a746b">Направление<select id="sheetDir">${options(DIRECTIONS, op.direction)}</select></label>
      <label style="display:grid;gap:6px;font-size:13px;color:#7a746b">Включать в итоги<select id="sheetInc"><option value="true" ${op.includeTotals !== false ? 'selected' : ''}>Да</option><option value="false" ${op.includeTotals === false ? 'selected' : ''}>Нет</option></select></label>
      <label style="display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 1px rgba(23,23,23,.08);font-size:14px">
        <input id="sheetSimilar" type="checkbox" style="width:auto;margin-top:2px">
        <span><b>Применить ко всем похожим</b><br><span style="color:#7a746b;font-size:12px">${key ? `Шаблон: «${esc(key)}». Найдено: ${similarCount}` : 'Похожие операции не найдены'}; также будет создано правило на будущее.</span></span>
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button id="sheetCancel">Отмена</button><button id="sheetSave" class="primary">Сохранить</button></div>
    `;
    document.body.appendChild(sheet);
    document.getElementById('sheetCancel').onclick = () => sheet.remove();
    document.getElementById('sheetSave').onclick = () => {
      const category = document.getElementById('sheetCat').value;
      const direction = document.getElementById('sheetDir').value;
      const includeTotals = document.getElementById('sheetInc').value === 'true';
      const applySimilar = document.getElementById('sheetSimilar').checked && key;
      let changed = 0;
      if (applySimilar) {
        (state.operations || []).forEach(item => {
          if (merchantKey(item.description) === key) {
            item.category = category;
            item.direction = direction;
            item.includeTotals = includeTotals;
            item.manuallyEdited = true;
            item.date = repairDate(item.date);
            changed++;
          }
        });
        state.rules = state.rules || [];
        const exists = state.rules.some(rule => String(rule.pattern || '').toLowerCase() === key.toLowerCase());
        if (!exists) {
          state.rules.push({
            id: 'rule_' + Date.now(),
            enabled: true,
            name: `${key} → ${category}`,
            matchType: 'contains',
            pattern: key,
            category,
            direction,
            includeTotals,
            priority: 95
          });
        }
      } else {
        op.category = category;
        op.direction = direction;
        op.includeTotals = includeTotals;
        op.manuallyEdited = true;
        op.date = repairDate(op.date);
        changed = 1;
      }
      saveState(state);
      sheet.remove();
      setTimeout(renderBelow, 80);
      alert(applySimilar ? `Сохранено. Обновлено похожих операций: ${changed}. Правило создано.` : 'Сохранено');
    };
  }

  function bindEditRows() {
    document.querySelectorAll('[data-edit-op]').forEach(button => {
      button.onclick = event => {
        event.stopPropagation();
        openEditor(button.dataset.editOp);
      };
    });
  }

  function repairExistingDates() {
    const state = readBundle();
    let changed = false;
    (state.operations || []).forEach(op => {
      const fixed = repairDate(op.date);
      if (fixed && fixed !== op.date) {
        op.date = fixed;
        op.month = fixed.slice(0, 7);
        op.monthText = `${fixed.slice(5, 7)}.${fixed.slice(0, 4)}`;
        changed = true;
      }
    });
    if (changed) saveState(state);
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

  window.addEventListener('load', () => {
    repairExistingDates();
    setTimeout(renderBelow, 500);
  });
})();
