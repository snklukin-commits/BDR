(() => {
  const STORE = 'bdr.money.app.v3';
  const IMPORT_STORE = 'bdr.money.pendingImport';

  const CATS = {
    income: ['Зарплата','Стипендия','Проценты и бонусы','Поступления от людей','Пополнение наличными','Прочие доходы','Ипотека/жильё: справочно','Не учитывается'],
    expense: ['Продукты и супермаркеты','Маркетплейсы/покупки','Доставка/Еда вне дома','Транспорт','Связь, интернет, подписки','ЖКХ/квартплата','Здоровье, аптеки и уход','Услуги/комиссии','Страхование','Наличные','Переводы другим людям','Кредиты/ипотека','Ремонт/дом','Крупные разовые расходы','Прочие расходы','Не учитывается']
  };
  const stableIncomeCats = ['Зарплата','Стипендия','Проценты и бонусы'];
  const ordinaryIncomeCats = ['Зарплата','Стипендия','Проценты и бонусы','Поступления от людей','Прочие доходы'];
  const routineCats = ['Продукты и супермаркеты','Маркетплейсы/покупки','Доставка/Еда вне дома','Транспорт','Связь, интернет, подписки','Здоровье, аптеки и уход','Услуги/комиссии','Страхование','Наличные','Прочие расходы'];
  const mandatoryCats = ['Кредиты/ипотека','ЖКХ/квартплата'];
  const separateExpenseCats = ['Кредиты/ипотека','ЖКХ/квартплата','Крупные разовые расходы','Переводы другим людям'];

  const defaultLimits = {
    'Продукты и супермаркеты': { type:'manual', value:0 },
    'Маркетплейсы/покупки': { type:'manual', value:0 },
    'Доставка/Еда вне дома': { type:'manual', value:0 },
    'Транспорт': { type:'manual', value:0 },
    'Связь, интернет, подписки': { type:'manual', value:0 },
    'Здоровье, аптеки и уход': { type:'manual', value:0 },
    'Услуги/комиссии': { type:'manual', value:0 },
    'Страхование': { type:'manual', value:0 },
    'Наличные': { type:'manual', value:0 },
    'Прочие расходы': { type:'manual', value:0 },
    'ЖКХ/квартплата': { type:'auto_zhkh', value:0 }
  };

  const state = loadState();
  let pendingImport = loadPendingImport();

  function loadState(){
    try { const saved = JSON.parse(localStorage.getItem(STORE)); if (saved && saved.operations) return saved; } catch(e) {}
    const initial = Array.isArray(window.operations) ? window.operations.map(normalizeOperation) : [];
    return { operations: initial, credits: [], imports: [], limits: defaultLimits, settings: { minSavings:0, currency:'RUB', stableIncomeCats, dateFormat:'auto' }, manual: {} };
  }
  function saveState(){ localStorage.setItem(STORE, JSON.stringify(state)); }
  function loadPendingImport(){ try { return JSON.parse(localStorage.getItem(IMPORT_STORE)); } catch(e) { return null; } }
  function savePendingImport(){ pendingImport ? localStorage.setItem(IMPORT_STORE, JSON.stringify(pendingImport)) : localStorage.removeItem(IMPORT_STORE); }
  function uid(){ return crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(16).slice(2); }
  function money(n){ return new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 }).format(Number(n)||0); }
  function num(x){ if (typeof x === 'number') return x; if (x == null) return 0; const s = String(x).replace(/\s| /g,'').replace(',', '.').replace(/[₽р]/gi,''); return Number(s) || 0; }
  function abs(x){ return Math.abs(num(x)); }
  function clean(s){ return String(s ?? '').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim(); }
  function dateISO(x){
    if (!x) return '';
    if (x instanceof Date && !isNaN(x)) return x.toISOString().slice(0,10);
    if (typeof x === 'number') { const d = XLSX?.SSF?.parse_date_code ? XLSX.SSF.parse_date_code(x) : null; if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`; }
    const s = String(x).trim();
    const m = s.match(/(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/);
    if (m) { const y = m[3].length === 2 ? '20'+m[3] : m[3]; return `${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`; }
    const d = new Date(s); return isNaN(d) ? s.slice(0,10) : d.toISOString().slice(0,10);
  }
  function monthOf(date){ const d = dateISO(date); return d && d.length >= 7 ? d.slice(0,7) : 'Без месяца'; }
  function monthText(m){ if (!/^\d{4}-\d{2}$/.test(m)) return m; const [y, mm] = m.split('-'); return `${mm}.${y}`; }

  function normalizeOperation(raw){
    const amount = num(raw.amount ?? raw['Сумма'] ?? raw.sum);
    const date = dateISO(raw.date ?? raw['Дата']);
    return {
      id: raw.id || raw.ID || raw['ID'] || uid(),
      importKey: raw.importKey || '',
      date,
      month: raw.month || raw['Месяц'] || monthOf(date),
      monthText: raw.monthText || raw.month_text || raw['Месяц текст'] || raw['Месяц_текст'] || monthText(monthOf(date)),
      bank: raw.bank || raw['Банк'] || '',
      sourceType: raw.sourceType || raw.source_type || raw['Тип исходный'] || '',
      bankCategory: raw.bankCategory || raw.bank_category || raw['Категория банка'] || '',
      category: raw.category || raw.account_category || raw['Категория учета'] || raw['Группа БДР'] || 'Прочие расходы',
      direction: raw.direction || raw.flow_type || raw['Направление'] || raw['Тип потока'] || (amount >= 0 ? 'Доход' : 'Расход'),
      amount,
      currency: raw.currency || raw['Валюта'] || 'RUB',
      includeTotals: bool(raw.includeTotals ?? raw.bdr_account ?? raw['Включать в общие итоги?'] ?? raw['Учет_БДР'], true),
      regular: bool(raw.regular ?? raw['Регулярная операция?'] ?? raw['Регулярный_бюджет'], false),
      discretionary: bool(raw.discretionary ?? raw['Дискреционная трата?'] ?? raw['Дискреционность'], true),
      description: raw.description || raw['Описание'] || '',
      status: raw.status || raw['Статус'] || '',
      account: raw.account || raw['Счёт/карта'] || raw['Счет/карта'] || '',
      mcc: raw.mcc || raw.MCC || raw['MCC'] || '',
      block: raw.block || raw['Блок учета'] || '',
      excludeReason: raw.excludeReason || raw.exclusion_reason || raw['Причина исключения'] || '',
      creditId: raw.creditId || '',
      creditMark: raw.creditMark || ''
    };
  }
  function bool(v, def){ if (v === undefined || v === null || v === '') return def; const s = clean(v); if (['нет','false','0','no'].includes(s)) return false; if (['да','true','1','yes'].includes(s)) return true; return Boolean(v); }

  function applyRules(op){
    const d = clean(op.description + ' ' + op.bankCategory + ' ' + op.sourceType);
    const a = abs(op.amount);
    if (a === 1 && /(магнит|доставка|провер|тест|авторизац)/.test(d)) return exclude(op, 'Техническая операция');
    if (/галина анатольевна/.test(d)) { op.category='Зарплата'; op.direction='Доход'; op.block='Доходы'; op.includeTotals=true; op.discretionary=false; return op; }
    if (op.amount > 1000000 && /(ипотек|кредит|зачисление|поступлен)/.test(d)) { op.category='Ипотека/жильё: справочно'; op.direction='Справочно'; op.block='Кредиты'; op.includeTotals=false; return op; }
    if (isInternalText(d)) return exclude(op, 'Внутренний перевод');
    if (/фгбоу во .*пиму|пиму.*минздрава/.test(d)) return income(op, 'Стипендия');
    if (/epr_gis_zkh|жкх|квартплат|гис жкх/.test(d)) return expense(op, 'ЖКХ/квартплата', false);
    if (/ооо "?парацельс"?|ооо "?аквимекс"?/.test(d)) return income(op, 'Зарплата');
    if (/кэшбэк|cashback|бонус|процент|начисление процентов|зачисление кэшбэка/.test(d)) return income(op, 'Проценты и бонусы');
    if (/внесение налич|пополнение налич|atm cash|банкомат/.test(d)) { op.category='Пополнение наличными'; op.direction='Справочно'; op.block='Доходы'; op.includeTotals=false; return op; }
    if (/ипотек|погашение кредита|кредит/.test(d) && op.amount < 0) return expense(op, 'Кредиты/ипотека', false);
    if (/возврат|refund|отмена покупки/.test(d) || (op.amount > 0 && /расход/.test(clean(op.sourceType)))) { op.direction='Возврат'; op.category = mapExpenseCategory(d); op.block='Расходы'; op.includeTotals=true; return op; }
    if (op.amount >= 0) return income(op, mapIncomeCategory(d));
    return expense(op, mapExpenseCategory(d), true);
  }
  function exclude(op, reason){ op.category='Не учитывается'; op.direction=reason; op.block='Исключено'; op.includeTotals=false; op.excludeReason=reason; op.discretionary=false; return op; }
  function income(op, cat){ op.category=cat; op.direction='Доход'; op.block='Доходы'; op.includeTotals=true; op.discretionary=false; return op; }
  function expense(op, cat, discretionary=true){ op.category=cat; op.direction='Расход'; op.block=mandatoryCats.includes(cat) ? 'Обязательные платежи' : 'Расходы'; op.includeTotals=true; op.discretionary=discretionary; return op; }
  function isInternalText(d){ return /(сергей к|сергей николаевич к|между своими|сво(и|ей) счет|пополнение своей|перевод между|со сбер.*т.?банк|т.?банк.*сбер)/.test(d); }
  function mapIncomeCategory(d){ if (/зарплат|аванс/.test(d)) return 'Зарплата'; if (/стипенд/.test(d)) return 'Стипендия'; if (/процент|кэшбэк|cashback|бонус/.test(d)) return 'Проценты и бонусы'; if (/перевод|зачисление от/.test(d)) return 'Поступления от людей'; return 'Прочие доходы'; }
  function mapExpenseCategory(d){
    if (/супермаркет|пятероч|магнит|перекресток|ашан|лента|продукт|еда.*магаз/.test(d)) return 'Продукты и супермаркеты';
    if (/wildberries|ozon|маркет|marketplace|яндекс маркет/.test(d)) return 'Маркетплейсы/покупки';
    if (/кафе|ресторан|доставка|яндекс еда|delivery|самокат|вкусно|burger|kfc|теремок/.test(d)) return 'Доставка/Еда вне дома';
    if (/такси|яндекс go|метро|транспорт|автобус|тройка|топливо|азс/.test(d)) return 'Транспорт';
    if (/мтс|билайн|мегафон|tele2|интернет|подписк|cloud|apple|google|yandex plus|кинопоиск/.test(d)) return 'Связь, интернет, подписки';
    if (/жкх|квартплат|epr_gis_zkh/.test(d)) return 'ЖКХ/квартплата';
    if (/аптек|здоров|клиник|мед|стомат|уход|космет/.test(d)) return 'Здоровье, аптеки и уход';
    if (/комисс|услуг|сервис|госпошлин/.test(d)) return 'Услуги/комиссии';
    if (/страхов/.test(d)) return 'Страхование';
    if (/налич|atm|банкомат/.test(d)) return 'Наличные';
    if (/перевод/.test(d)) return 'Переводы другим людям';
    if (/ремонт|дом|строй|леруа|оби|hoff|мебел/.test(d)) return 'Ремонт/дом';
    return 'Прочие расходы';
  }

  function dedupeKey(op){ return [dateISO(op.date), Math.round(num(op.amount)*100)/100, clean(op.bank), clean(op.description), clean(op.account), clean(op.sourceType)].join('|'); }

  async function parseFiles(files){
    let parsed = [];
    for (const file of files) parsed = parsed.concat(await parseFile(file));
    markInternalPairs(parsed);
    const existing = new Set(state.operations.map(o => o.importKey || dedupeKey(o)));
    const rows = parsed.map(o => { o.importKey = dedupeKey(o); return o; });
    const seen = new Set(); let doubles = 0;
    const fresh = [];
    for (const o of rows) { const k = o.importKey; if (existing.has(k) || seen.has(k)) doubles++; else { seen.add(k); fresh.push(o); } }
    const stats = previewStats(fresh, doubles);
    return { id: uid(), date: new Date().toISOString(), files: [...files].map(f=>f.name), operations: fresh, doubles, stats };
  }

  async function parseFile(file){
    const name = file.name.toLowerCase();
    if (name.endsWith('.json')) return JSON.parse(await file.text()).map(x => applyRules(normalizeOperation(x)));
    if (name.endsWith('.js')) { const t = await file.text(); const m = t.match(/(?:window\.)?operations\s*=\s*([\s\S]*?);?\s*$/); return JSON.parse(m ? m[1] : t).map(x => applyRules(normalizeOperation(x))); }
    if (name.endsWith('.csv') || name.endsWith('.txt')) return parseCsv(await file.text(), name);
    if (!window.XLSX) throw new Error('Библиотека XLSX не загрузилась. Проверь интернет и обнови страницу.');
    const wb = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true });
    let all = [];
    wb.SheetNames.forEach(sn => { all = all.concat(parseSheet(XLSX.utils.sheet_to_json(wb.Sheets[sn], { header:1, raw:false, defval:'' }), name)); });
    return all;
  }

  function parseCsv(text, name){
    const sep = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ',';
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = splitLine(lines.shift(), sep);
    return lines.map(line => rowToOperation(Object.fromEntries(splitLine(line, sep).map((v,i)=>[headers[i]||'col'+i, v])), name)).filter(Boolean);
  }
  function splitLine(line, sep){ const out=[]; let cur='', q=false; for (const ch of line){ if(ch==='"'){q=!q;continue} if(ch===sep&&!q){out.push(cur);cur='';continue} cur+=ch } out.push(cur); return out; }

  function parseSheet(rows, name){
    const headerIndex = rows.findIndex(r => r.filter(Boolean).length >= 3 && scoreHeader(r) >= 2);
    if (headerIndex < 0) return [];
    const headers = rows[headerIndex].map(x => String(x).trim());
    return rows.slice(headerIndex+1).map(r => Object.fromEntries(headers.map((h,i)=>[h, r[i]]))).map(obj => rowToOperation(obj, name)).filter(Boolean);
  }
  function scoreHeader(r){ const txt = clean(r.join(' ')); let n=0; ['дата','сумма','операц','описан','назнач','категор','mcc','карта','счет'].forEach(w=>{ if(txt.includes(w)) n++; }); return n; }
  function val(obj, aliases){ const entries = Object.entries(obj); for (const a of aliases){ const found = entries.find(([k]) => clean(k) === clean(a) || clean(k).includes(clean(a))); if (found) return found[1]; } return ''; }
  function rowToOperation(obj, filename){
    const bank = /сбер|sber/.test(filename) ? 'Сбер' : /тбанк|тинькофф|tinkoff|t-bank/.test(filename) ? 'Т-Банк' : '';
    const sourceType = /доход/.test(filename) ? 'Доходы файл' : /расход/.test(filename) ? 'Расходы файл' : 'Банковская выгрузка';
    const date = dateISO(val(obj, ['Дата','Дата операции','Дата платежа','Дата и время','date']));
    const description = String(val(obj, ['Описание','Назначение платежа','Операция','Детали операции','Контрагент','Получатель','Плательщик','Место операции','description']) || '').trim();
    let amount = num(val(obj, ['Сумма','Сумма операции','Сумма платежа','Сумма в валюте операции','amount','Приход','Расход']));
    const incomeVal = num(val(obj, ['Приход','Зачисления','Поступления']));
    const expenseVal = num(val(obj, ['Расход','Списания']));
    if (incomeVal) amount = Math.abs(incomeVal);
    if (expenseVal) amount = -Math.abs(expenseVal);
    if (/расход/.test(filename) && amount > 0) amount = -Math.abs(amount);
    if (/доход/.test(filename) && amount < 0) amount = Math.abs(amount);
    if (!date && !description && !amount) return null;
    const op = normalizeOperation({
      date, month: monthOf(date), monthText: monthText(monthOf(date)), bank, sourceType,
      bankCategory: val(obj, ['Категория','Категория банка','category']), category:'', direction: amount >= 0 ? 'Доход' : 'Расход', amount,
      currency: val(obj, ['Валюта','currency']) || 'RUB', description,
      account: val(obj, ['Счет','Счёт','Карта','Номер карты','Счет/карта','Счёт/карта']),
      mcc: val(obj, ['MCC','mcc']), status: val(obj, ['Статус','status'])
    });
    return applyRules(op);
  }

  function markInternalPairs(list){
    for (let i=0;i<list.length;i++) for (let j=i+1;j<list.length;j++) {
      const a=list[i], b=list[j];
      if (a.bank === b.bank) continue;
      if (Math.abs(abs(a.amount)-abs(b.amount)) > 2) continue;
      const da = new Date(a.date), db = new Date(b.date); if (Math.abs(da-db) > 3*86400000) continue;
      if (a.amount*b.amount < 0 || isInternalText(clean(a.description+' '+b.description))) { exclude(a,'Внутренний перевод'); exclude(b,'Внутренний перевод'); }
    }
  }

  function previewStats(rows, doubles){
    const s = summarize(rows);
    return { total: rows.length, new: rows.length, doubles, internal: rows.filter(o=>o.excludeReason==='Внутренний перевод').length, excluded: rows.filter(o=>!o.includeTotals).length, review: rows.filter(o=>o.category==='Прочие расходы'||!o.category).length, income:s.ordinaryIncome, expense:s.allSpending, credits:s.mandatory['Кредиты/ипотека']||0, mortgageInfo:s.infoMortgage };
  }

  function summarize(rows){
    const s = { ordinaryIncome:0, stableIncome:0, peopleIncome:0, cashInfo:0, infoMortgage:0, routine:0, mandatory:{}, separate:{}, large:0, transfers:0, allSpending:0, byIncome:{}, byRoutine:{}, allDebits:0 };
    rows.filter(o=>o.includeTotals !== false).forEach(o => {
      const cat=o.category, a=num(o.amount), aa=abs(a), dir=o.direction;
      if (dir === 'Доход') {
        if (ordinaryIncomeCats.includes(cat)) { s.ordinaryIncome += a; s.byIncome[cat]=(s.byIncome[cat]||0)+a; }
        if (stableIncomeCats.includes(cat)) s.stableIncome += a;
        if (cat === 'Поступления от людей') s.peopleIncome += a;
      }
      if (dir === 'Расход') {
        s.allSpending += aa; s.allDebits += aa;
        if (routineCats.includes(cat)) { s.routine += aa; s.byRoutine[cat]=(s.byRoutine[cat]||0)+aa; }
        if (mandatoryCats.includes(cat)) s.mandatory[cat]=(s.mandatory[cat]||0)+aa;
        if (cat === 'Крупные разовые расходы') s.large += aa;
        if (cat === 'Переводы другим людям') s.transfers += aa;
      }
      if (dir === 'Возврат') { s.allSpending -= aa; if (routineCats.includes(cat)) { s.routine -= aa; s.byRoutine[cat]=(s.byRoutine[cat]||0)-aa; } }
    });
    rows.filter(o=>o.includeTotals === false).forEach(o => { if(o.category==='Пополнение наличными') s.cashInfo += abs(o.amount); if(o.category==='Ипотека/жильё: справочно') s.infoMortgage += abs(o.amount); });
    return s;
  }

  function rowsForMonth(m){ return state.operations.filter(o => m==='all' || o.month===m); }
  function months(){ const set = [...new Set(state.operations.map(o=>o.month).filter(Boolean))].sort(); const now = new Date().toISOString().slice(0,7); return set.includes(now) ? [now, ...set.filter(x=>x!==now)] : set; }
  function selectedMonth(){ return document.querySelector('#monthPick')?.value || new Date().toISOString().slice(0,7); }
  function htmlTable(head, rows, empty='Нет данных'){ if(!rows.length) return `<div class="empty">${empty}</div>`; return `<div class="scroll"><table><thead><tr>${head.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
  function esc(s){ return String(s??'').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m])); }

  function render(){ renderDashboard(); renderCurrent(); renderOperations(); renderCredits(); renderManage(); bindCommon(); }
  function bindCommon(){ document.querySelectorAll('.tab').forEach(b => b.onclick = () => { document.querySelectorAll('.tab,.section').forEach(x=>x.classList.remove('active')); b.classList.add('active'); document.getElementById(b.dataset.tab).classList.add('active'); }); }

  function renderDashboard(){
    const s = summarize(state.operations);
    const cutNeed = Math.max(0, s.routine + Object.values(s.mandatory).reduce((a,b)=>a+b,0) + Number(state.settings.minSavings||0) - s.stableIncome);
    document.getElementById('dashboard').innerHTML = `<div class="toolbar"><span class="pill">${state.operations.length} операций</span><span class="pill">${state.credits.length} кредитов</span></div>
      <div class="grid"><div class="card"><h3>Обычные доходы</h3><div class="value">${money(s.ordinaryIncome)}</div><p class="muted">Ипотека и наличные не включены.</p></div><div class="card"><h3>Стабильные доходы</h3><div class="value">${money(s.stableIncome)}</div><p class="muted">Зарплата + стипендия + проценты.</p></div><div class="card"><h3>Повседневная рутина</h3><div class="value">${money(s.routine)}</div><p class="muted">Без ипотеки, ЖКХ, крупных и переводов.</p></div><div class="card"><h3>Нужно сократить/мес</h3><div class="value ${cutNeed?'bad':'good'}">${money(cutNeed)}</div></div></div>
      <div class="grid2"><div class="card"><h3>Доходы</h3>${htmlTable(['Категория','Сумма'], Object.entries(s.byIncome).map(([c,v])=>`<tr><td>${esc(c)}</td><td>${money(v)}</td></tr>`))}<p class="muted">Пополнение наличными справочно: ${money(s.cashInfo)}. Ипотечные поступления справочно: ${money(s.infoMortgage)}.</p></div><div class="card"><h3>Обязательные и отдельные расходы</h3>${htmlTable(['Блок','Сумма'], [['Кредиты/ипотека',s.mandatory['Кредиты/ипотека']||0],['ЖКХ/квартплата',s.mandatory['ЖКХ/квартплата']||0],['Крупные разовые',s.large],['Переводы другим людям',s.transfers]].map(x=>`<tr><td>${x[0]}</td><td>${money(x[1])}</td></tr>`))}</div></div>
      <div class="card"><h3>Расходы рутины по категориям</h3>${htmlTable(['Категория','Сумма'], Object.entries(s.byRoutine).sort((a,b)=>b[1]-a[1]).map(([c,v])=>`<tr><td>${esc(c)}</td><td>${money(v)}</td></tr>`))}</div>`;
  }

  function renderCurrent(){
    const ms = months(); const cur = selectedMonth(); const m = ms.includes(cur) ? cur : (ms[0] || new Date().toISOString().slice(0,7)); const rows = rowsForMonth(m); const s = summarize(rows);
    const limits = calcLimits(m);
    document.getElementById('current').innerHTML = `<div class="toolbar"><select id="monthPick">${ms.map(x=>`<option ${x===m?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="grid"><div class="card"><h3>Обычные доходы</h3><div class="value">${money(s.ordinaryIncome)}</div></div><div class="card"><h3>Стабильные доходы</h3><div class="value">${money(s.stableIncome)}</div></div><div class="card"><h3>Рутина</h3><div class="value">${money(s.routine)}</div></div><div class="card"><h3>Остаток от стабильного</h3><div class="value">${money(s.stableIncome - s.routine - (s.mandatory['Кредиты/ипотека']||0) - (s.mandatory['ЖКХ/квартплата']||0))}</div></div></div>
      <div class="grid2"><div class="card"><h3>Доходы по категориям</h3>${htmlTable(['Категория','Сумма'], Object.entries(s.byIncome).map(([c,v])=>`<tr><td>${c}</td><td>${money(v)}</td></tr>`))}<p class="muted">Пополнение наличными: ${money(s.cashInfo)} справочно.</p></div><div class="card"><h3>Обычные расходы рутины</h3>${htmlTable(['Категория','Сумма'], Object.entries(s.byRoutine).map(([c,v])=>`<tr><td>${c}</td><td>${money(v)}</td></tr>`))}</div></div>
      <div class="card"><h3>Отдельные блоки</h3>${htmlTable(['Блок','Сумма'], [['Кредиты/ипотека',s.mandatory['Кредиты/ипотека']||0],['ЖКХ',s.mandatory['ЖКХ/квартплата']||0],['Крупные разовые',s.large],['Переводы другим людям',s.transfers]].map(x=>`<tr><td>${x[0]}</td><td>${money(x[1])}</td></tr>`))}</div>
      <div class="card"><h3>Лимиты текущего месяца</h3>${htmlTable(['Категория','Лимит','Факт','Осталось / перерасход','Статус'], limits.map(x=>`<tr><td>${x.cat}</td><td>${money(x.limit)}</td><td>${money(x.fact)}</td><td class="${x.left<0?'bad':'good'}">${money(x.left)}</td><td>${x.left<0?'Перерасход':'В лимите'}</td></tr>`))}</div>`;
    document.getElementById('monthPick').onchange = render;
  }
  function calcLimits(m){
    const s = summarize(rowsForMonth(m));
    const histZhkh = Math.max(0, ...[...new Set(state.operations.map(o=>o.month))].map(mm => summarize(rowsForMonth(mm)).mandatory['ЖКХ/квартплата']||0));
    return Object.entries(state.limits || defaultLimits).map(([cat,obj]) => { let limit = Number(obj.value)||0; if(obj.type==='auto_zhkh') limit = Math.ceil(histZhkh/500)*500; const fact = (cat==='ЖКХ/квартплата') ? (s.mandatory[cat]||0) : (s.byRoutine[cat]||0); return {cat, limit, fact, left: limit-fact}; });
  }

  function renderOperations(){
    const filters = `<div class="toolbar"><select id="opMonth"><option value="all">Все месяцы</option>${months().map(m=>`<option>${m}</option>`).join('')}</select><select id="opBank"><option value="all">Все банки</option>${[...new Set(state.operations.map(o=>o.bank).filter(Boolean))].map(b=>`<option>${b}</option>`).join('')}</select><select id="opCat"><option value="all">Все категории</option>${[...CATS.income,...CATS.expense].map(c=>`<option>${c}</option>`).join('')}</select><select id="opDir"><option value="all">Все направления</option><option>Доход</option><option>Расход</option><option>Возврат</option><option>Внутренний перевод</option><option>Справочно</option></select><select id="opIncl"><option value="all">Все</option><option value="yes">В итогах</option><option value="no">Не учитывать</option></select><input id="opSearch" placeholder="Поиск"><input id="sumFrom" type="number" placeholder="Сумма от"><input id="sumTo" type="number" placeholder="Сумма до"><button id="applyOpFilters">Фильтр</button></div>`;
    const rows = filteredOps().slice(0,600).map(o => `<tr><td>${esc(o.id)}</td><td>${esc(o.date)}</td><td>${esc(o.month)}</td><td>${esc(o.bank)}</td><td>${esc(o.sourceType)}</td><td>${esc(o.bankCategory)}</td><td>${selectHtml('cat_'+o.id,[...CATS.income,...CATS.expense],o.category)}</td><td>${selectHtml('dir_'+o.id,['Доход','Расход','Возврат','Справочно','Внутренний перевод','Техническая операция'],o.direction)}</td><td>${money(o.amount)}</td><td>${selectHtml('incl_'+o.id,['Да','Нет'],o.includeTotals?'Да':'Нет')}</td><td>${selectHtml('reg_'+o.id,['Да','Нет'],o.regular?'Да':'Нет')}</td><td>${selectHtml('disc_'+o.id,['Да','Нет'],o.discretionary?'Да':'Нет')}</td><td><input id="desc_${o.id}" value="${esc(o.description)}"></td><td>${esc(o.account)}</td><td>${esc(o.mcc)}</td><td>${selectHtml('block_'+o.id,['Доходы','Расходы','Обязательные платежи','Кредиты','Исключено','Справочно'],o.block)}</td><td>${creditSelect('cred_'+o.id,o.creditId)}</td></tr>`).join('');
    document.getElementById('operations').innerHTML = `<div class="card"><h3>Операции</h3>${filters}${htmlTable(['ID','Дата','Месяц','Банк','Тип исходный','Категория банка','Категория учета','Направление','Сумма','В итогах','Регулярная','Дискреционная','Описание','Счёт/карта','MCC','Блок','Кредит'], rows ? [rows] : [], 'Операций нет')}</div>`;
    document.getElementById('applyOpFilters').onclick = renderOperations;
    state.operations.forEach(bindOpEdit);
  }
  function selectHtml(id, opts, val){ return `<select id="${id}">${opts.map(o=>`<option ${o===val?'selected':''}>${o}</option>`).join('')}</select>`; }
  function creditSelect(id,val){ return `<select id="${id}"><option value="">Нет</option>${state.credits.map(c=>`<option value="${c.id}" ${c.id===val?'selected':''}>${esc(c.name)}</option>`).join('')}</select>`; }
  function filteredOps(){
    const get = id => document.getElementById(id)?.value || 'all';
    return state.operations.filter(o => get('opMonth')==='all'||o.month===get('opMonth')).filter(o=>get('opBank')==='all'||o.bank===get('opBank')).filter(o=>get('opCat')==='all'||o.category===get('opCat')).filter(o=>get('opDir')==='all'||o.direction===get('opDir')).filter(o=>get('opIncl')==='all'||(get('opIncl')==='yes'?o.includeTotals:!o.includeTotals)).filter(o=>!get('opSearch')||clean(o.description).includes(clean(get('opSearch')))).filter(o=>!get('sumFrom')||abs(o.amount)>=Number(get('sumFrom'))).filter(o=>!get('sumTo')||abs(o.amount)<=Number(get('sumTo')));
  }
  function bindOpEdit(o){
    const bind = (id, fn) => { const el=document.getElementById(id+'_'+o.id); if(el) el.onchange=()=>{fn(el.value); saveState(); render();}; };
    bind('cat',v=>o.category=v); bind('dir',v=>o.direction=v); bind('incl',v=>o.includeTotals=v==='Да'); bind('reg',v=>o.regular=v==='Да'); bind('disc',v=>o.discretionary=v==='Да'); bind('block',v=>o.block=v); bind('cred',v=>o.creditId=v);
    const desc=document.getElementById('desc_'+o.id); if(desc) desc.onchange=()=>{o.description=desc.value; saveState(); render();};
  }

  function renderCredits(){
    const list = state.credits.map(c => creditCard(c)).join('') || '<div class="empty">Кредитов пока нет.</div>';
    document.getElementById('credits').innerHTML = `<div class="grid2"><div class="card"><h3>Добавить кредит</h3><div class="toolbar"><input id="crName" placeholder="Название"><select id="crType"><option>Ипотека</option><option>Потребительский кредит</option><option>Автокредит</option><option>Кредитная карта</option><option>Другое</option></select><input id="crDate" type="date"><input id="crObject" type="number" placeholder="Стоимость объекта"><input id="crDown" type="number" placeholder="Первоначальный взнос"><input id="crAmount" type="number" placeholder="Сумма кредита"><input id="crRate" type="number" step="0.01" placeholder="Ставка"><input id="crMonths" type="number" placeholder="Срок мес"><input id="crPayment" type="number" placeholder="Платёж"><input id="crBalance" type="number" placeholder="Остаток"><input id="crFirst" type="date"><select id="crStrategy"><option>сокращать срок</option><option>сокращать платёж</option></select><button class="primary" id="addCredit">Добавить</button></div></div><div class="card"><h3>Кредитные операции из БДР</h3>${creditOperationsTable()}</div></div><div>${list}</div>`;
    document.getElementById('addCredit').onclick = addCredit;
    state.credits.forEach(c => { const b=document.getElementById('addEarly_'+c.id); if(b) b.onclick=()=>addEarly(c.id); const del=document.getElementById('delCredit_'+c.id); if(del) del.onclick=()=>{state.credits=state.credits.filter(x=>x.id!==c.id);saveState();render();}; });
  }
  function addCredit(){ state.credits.push({ id:uid(), name:crName.value||'Кредит', type:crType.value, issueDate:crDate.value, objectCost:num(crObject.value), downPayment:num(crDown.value), principal:num(crAmount.value), annualRate:num(crRate.value), months:num(crMonths.value), payment:num(crPayment.value), balance:num(crBalance.value)||num(crAmount.value), firstPaymentDate:crFirst.value, strategy:crStrategy.value, earlyPayments:[] }); saveState(); render(); }
  function addEarly(id){ const c=state.credits.find(x=>x.id===id); c.earlyPayments.push({id:uid(), date:document.getElementById('epDate_'+id).value, amount:num(document.getElementById('epAmount_'+id).value), type:document.getElementById('epType_'+id).value, comment:document.getElementById('epComment_'+id).value}); saveState(); render(); }
  function annuity(p, r, n){ const mr=r/100/12; return mr ? p*mr/(1-Math.pow(1+mr,-n)) : p/n; }
  function schedule(c){ let bal = c.balance || c.principal; let payment = c.payment || annuity(c.principal,c.annualRate,c.months); const mr=c.annualRate/100/12; let interest=0,total=0,months=0; const early=[...(c.earlyPayments||[])].sort((a,b)=>String(a.date).localeCompare(String(b.date))); while(bal>1 && months<600){ months++; const i=bal*mr; let principal=payment-i; if(principal<0) principal=0; bal=Math.max(0,bal-principal); const ep=early.filter(e=>monthOf(e.date)===addMonths(c.firstPaymentDate||c.issueDate,months-1)); ep.forEach(e=>{bal=Math.max(0,bal-e.amount); total+=e.amount; if(e.type==='сокращение платежа') payment=annuity(bal,c.annualRate,Math.max(1,c.months-months));}); interest+=i; total+=payment; if(bal===0) break; } return {months,interest,total,payment,fullCost:(c.downPayment||0)+total, balance:bal}; }
  function addMonths(date, n){ const d = date ? new Date(date) : new Date(); d.setMonth(d.getMonth()+n); return d.toISOString().slice(0,7); }
  function creditCard(c){ const sc=schedule(c); return `<div class="card"><div class="toolbar"><h2>${esc(c.name)}</h2><span class="pill">${esc(c.type)}</span><button class="danger" id="delCredit_${c.id}">Удалить</button></div><div class="grid"><div><h3>Сумма кредита</h3><div class="value">${money(c.principal)}</div></div><div><h3>Платёж</h3><div class="value">${money(c.payment||sc.payment)}</div></div><div><h3>Срок до закрытия</h3><div class="value">${sc.months} мес.</div></div><div><h3>Проценты банку</h3><div class="value">${money(sc.interest)}</div></div></div><div class="grid2"><div><h3>Полная стоимость</h3>${htmlTable(['Показатель','Сумма'], [['Стоимость объекта',c.objectCost],['Первоначальный взнос',c.downPayment],['Сумма кредита',c.principal],['Выплаты банку',sc.total],['Проценты банку',sc.interest],['Полная стоимость для меня',sc.fullCost]].map(x=>`<tr><td>${x[0]}</td><td>${money(x[1])}</td></tr>`))}</div><div><h3>Досрочные погашения</h3>${htmlTable(['Дата','Сумма','Тип','Комментарий'], (c.earlyPayments||[]).map(e=>`<tr><td>${e.date}</td><td>${money(e.amount)}</td><td>${e.type}</td><td>${esc(e.comment)}</td></tr>`),'Досрочных нет')}<div class="toolbar"><input id="epDate_${c.id}" type="date"><input id="epAmount_${c.id}" type="number" placeholder="Сумма"><select id="epType_${c.id}"><option>сокращение срока</option><option>сокращение платежа</option></select><input id="epComment_${c.id}" placeholder="Комментарий"><button id="addEarly_${c.id}">Добавить досрочное</button></div></div></div></div>`; }
  function creditOperationsTable(){ const rows=state.operations.filter(o=>o.category==='Кредиты/ипотека').map(o=>`<tr><td>${o.date}</td><td>${esc(o.description)}</td><td>${money(o.amount)}</td><td>${creditSelect('x_'+o.id,o.creditId)}</td></tr>`); return htmlTable(['Дата','Описание','Сумма','Кредит'], rows, 'Кредитных операций нет'); }

  function renderManage(){
    const p = pendingImport;
    document.getElementById('manage').innerHTML = `<div class="grid2"><div class="card"><h3>Импорт</h3><div id="drop" class="drop"><p><b>Загрузи 3 файла банка одновременно</b></p><p class="muted">БДР ТБанк.xlsx, Доходы Сбер.xlsx, Расходы Сбер.xlsx. Названия могут отличаться — тип определяется по колонкам.</p><input id="files" type="file" multiple accept=".xlsx,.xls,.json,.csv,.js,.txt"></div><div class="toolbar"><button class="primary" id="previewImport">Предпросмотр</button><button id="applyImport" ${p?'':'disabled'}>Применить импорт</button><button id="cancelImport" ${p?'':'disabled'}>Отменить импорт</button></div><div id="importPreview">${p?importPreviewHtml(p):'<p class="muted">Предпросмотра пока нет.</p>'}</div></div><div class="card"><h3>Экспорт и резервная копия</h3><div class="toolbar"><button id="exportJson">Скачать базу JSON</button><button id="exportCsv">Скачать операции CSV</button><input id="importDb" type="file" accept=".json"><button id="clearDb" class="danger">Очистить базу</button></div><p class="muted">JSON — полная резервная копия операций, кредитов, лимитов и настроек.</p></div></div><div class="grid2"><div class="card"><h3>Лимиты</h3>${limitsEditor()}</div><div class="card"><h3>Настройки</h3><label>Минимально откладывать/мес <input id="minSavings" type="number" value="${state.settings.minSavings||0}"></label><p class="muted">ЖКХ можно считать автоматически по максимуму истории с округлением до 500 ₽.</p><button id="saveSettings" class="primary">Сохранить настройки</button></div></div><div class="card"><h3>Категории и правила</h3><p class="muted">Базовые категории уже зашиты в правила. Ручные правки операций сохраняются и не затираются при повторном импорте.</p>${htmlTable(['Доходы','Расходы'], Array.from({length:Math.max(CATS.income.length,CATS.expense.length)},(_,i)=>`<tr><td>${CATS.income[i]||''}</td><td>${CATS.expense[i]||''}</td></tr>`))}</div>`;
    document.getElementById('previewImport').onclick = async()=>{ pendingImport = await parseFiles(document.getElementById('files').files); savePendingImport(); render(); };
    document.getElementById('applyImport').onclick = ()=>{ applyImport(); };
    document.getElementById('cancelImport').onclick = ()=>{ pendingImport=null; savePendingImport(); render(); };
    document.getElementById('exportJson').onclick = ()=>download('bdr-backup.json', JSON.stringify(state,null,2),'application/json');
    document.getElementById('exportCsv').onclick = ()=>download('operations.csv', toCsv(state.operations),'text/csv');
    document.getElementById('importDb').onchange = async e => { const db=JSON.parse(await e.target.files[0].text()); Object.assign(state, db); saveState(); render(); };
    document.getElementById('clearDb').onclick = ()=>{ if(confirm('Очистить локальную базу?')){ localStorage.removeItem(STORE); location.reload(); } };
    document.getElementById('saveSettings').onclick = ()=>{ state.settings.minSavings=num(document.getElementById('minSavings').value); saveLimitsFromDom(); saveState(); render(); };
  }
  function applyImport(){ if(!pendingImport) return; const existing = new Set(state.operations.map(o=>o.importKey||dedupeKey(o))); const add = pendingImport.operations.filter(o=>!existing.has(o.importKey||dedupeKey(o))); state.operations = state.operations.concat(add); state.imports.push({id:pendingImport.id,date:pendingImport.date,files:pendingImport.files,count:add.length}); pendingImport=null; savePendingImport(); saveState(); render(); }
  function importPreviewHtml(p){ const s=p.stats; return htmlTable(['Показатель','Значение'], [['Найдено операций',s.total],['Новых',s.new],['Дублей',s.doubles],['Внутренних переводов',s.internal],['Исключено',s.excluded],['Требует проверки',s.review],['Доходы',money(s.income)],['Расходы',money(s.expense)],['Кредиты/ипотека',money(s.credits)],['Ипотечные справочные поступления',money(s.mortgageInfo)]].map(x=>`<tr><td>${x[0]}</td><td>${x[1]}</td></tr>`)); }
  function limitsEditor(){ return htmlTable(['Категория','Тип','Лимит'], Object.entries(state.limits||defaultLimits).map(([c,o])=>`<tr><td>${c}</td><td><select id="limType_${c}"><option ${o.type==='manual'?'selected':''}>manual</option><option ${o.type==='auto_zhkh'?'selected':''}>auto_zhkh</option></select></td><td><input id="limVal_${c}" type="number" value="${o.value||0}"></td></tr>`)); }
  function saveLimitsFromDom(){ Object.keys(state.limits||defaultLimits).forEach(c=>{ state.limits[c]={type:document.getElementById('limType_'+c).value,value:num(document.getElementById('limVal_'+c).value)}; }); }
  function toCsv(rows){ const h=['ID','Дата','Месяц','Месяц текст','Банк','Тип исходный','Категория банка','Категория учета','Направление','Сумма','Валюта','Включать в общие итоги?','Регулярная операция?','Дискреционная трата?','Описание','Статус','Счёт/карта','MCC','Блок учета','Кредит']; return [h.join(';')].concat(rows.map(o=>[o.id,o.date,o.month,o.monthText,o.bank,o.sourceType,o.bankCategory,o.category,o.direction,o.amount,o.currency,o.includeTotals?'Да':'Нет',o.regular?'Да':'Нет',o.discretionary?'Да':'Нет',o.description,o.status,o.account,o.mcc,o.block,o.creditId].map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';'))).join('\n'); }
  function download(name, content, type){ const b=new Blob([content],{type}); const a=document.createElement('a'); a.href=URL.createObjectURL(b); a.download=name; a.click(); URL.revokeObjectURL(a.href); }

  render();
})();
