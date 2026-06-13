(() => {
  'use strict';

  const STORE = 'bdr.money.app.v11';
  const LEGACY = ['bdr.money.app.v10','bdr.money.app.v9','bdr.money.app.v8','bdr.money.app.v7','bdr.money.app.v6','bdr.money.app.v5','bdr.money.app.v4','bdr.money.app.v3'];

  const incomeCats = ['Зарплата','Стипендия','Проценты и бонусы','Поступления от людей','Пополнение наличными','Прочие доходы','Ипотека/жильё: справочно','Не учитывается'];
  const expenseCats = ['Продукты и супермаркеты','Маркетплейсы/покупки','Доставка/Еда вне дома','Транспорт','Связь, интернет, подписки','ЖКХ/квартплата','Здоровье, аптеки и уход','Услуги/комиссии','Страхование','Наличные','Переводы другим людям','Кредиты/ипотека','Ремонт/дом','Крупные разовые расходы','Прочие расходы','Не учитывается'];
  const allCats = [...new Set([...incomeCats, ...expenseCats])];
  const directions = ['Доход','Расход','Возврат','Справочно','Внутренний перевод','Техническая операция'];
  const stableCats = ['Зарплата','Стипендия','Проценты и бонусы'];
  const ordinaryIncomeCats = ['Зарплата','Стипендия','Проценты и бонусы','Поступления от людей','Прочие доходы'];
  const routineCats = ['Продукты и супермаркеты','Маркетплейсы/покупки','Доставка/Еда вне дома','Транспорт','Связь, интернет, подписки','Здоровье, аптеки и уход','Услуги/комиссии','Страхование','Наличные','Ремонт/дом','Прочие расходы'];
  const creditCats = ['Кредиты/ипотека','Ипотека/жильё: справочно'];
  const excludedCats = ['Не учитывается'];
  const defaultLimitCats = ['Продукты и супермаркеты','Маркетплейсы/покупки','Доставка/Еда вне дома','Транспорт','Связь, интернет, подписки','Здоровье, аптеки и уход','Услуги/комиссии','Страхование','Наличные','Прочие расходы'];
  const defaultLimits = Object.fromEntries(defaultLimitCats.map(cat => [cat, { type: 'manual', value: 0 }]));
  const palette = ['#111111','#c8a96a','#6d5b3f','#087f5b','#2454ff','#7c3aed','#b42318','#f59e0b','#475569','#0f766e','#9333ea','#e8dcc6'];

  let state = loadState();
  let pendingImport = null;
  let activeTab = 'dashboard';
  let dashboardMode = localStorage.getItem('bdr.dashboard.mode') || 'total';
  let selectedExpenseCategory = null;
  let selectedIncomeCategory = null;

  function uid(){ return crypto.randomUUID ? crypto.randomUUID() : 'id_' + Date.now() + '_' + Math.random().toString(16).slice(2); }
  function money(n){ return new Intl.NumberFormat('ru-RU', { style:'currency', currency:'RUB', maximumFractionDigits:0 }).format(Number(n) || 0); }
  function num(v){ if(typeof v === 'number') return v; if(v == null) return 0; return Number(String(v).replace(/\s| /g,'').replace(',', '.').replace(/[₽р]/gi,'')) || 0; }
  function abs(v){ return Math.abs(num(v)); }
  function clean(s){ return String(s ?? '').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim(); }
  function esc(s){ return String(s ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function bool(v, def=true){ if(v === undefined || v === null || v === '') return def; const s = clean(v); if(['нет','false','0','no','n'].includes(s)) return false; if(['да','true','1','yes','y'].includes(s)) return true; return Boolean(v); }

  function dateISO(v){
    if(!v) return '';
    if(v instanceof Date && !isNaN(v)) return repairDate(v.toISOString().slice(0,10));
    if(typeof v === 'number' && window.XLSX?.SSF?.parse_date_code){
      const d = XLSX.SSF.parse_date_code(v);
      if(d) return repairDate(`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`);
    }
    const s = String(v).trim();
    const m = s.match(/(\d{1,2})[.\/\-](\d{1,2})[.\/\-](\d{2,4})/);
    if(m){
      const y = m[3].length === 2 ? '20' + m[3] : m[3];
      return repairDate(`${y}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
    }
    const d = new Date(s);
    return isNaN(d) ? repairDate(s.slice(0,10)) : repairDate(d.toISOString().slice(0,10));
  }
  function repairDate(value){
    const s = String(value || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if(!m) return s;
    let y = Number(m[1]);
    const month = m[2];
    const day = m[3];
    const current = new Date().getFullYear();
    if(y !== current && ['03','04','05','06'].includes(month)) y = current;
    return `${y}-${month}-${day}`;
  }
  function displayDate(value){
    const d = dateISO(value);
    const m = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}.${m[2]}.${m[1].slice(2)}` : (d || '—');
  }
  function monthOf(value){ const d = dateISO(value); return /^\d{4}-\d{2}/.test(d) ? d.slice(0,7) : 'Без месяца'; }
  function monthText(m){ return /^\d{4}-\d{2}$/.test(m) ? `${m.slice(5,7)}.${m.slice(0,4)}` : m; }

  function defaultRules(){ return [
    mkRule('ПИМУ → Стипендия','contains','пиму','Стипендия','Доход',true,100),
    mkRule('Парацельс → Зарплата','contains','парацельс','Зарплата','Доход',true,100),
    mkRule('Аквимекс → Зарплата','contains','аквимекс','Зарплата','Доход',true,100),
    mkRule('EPR GIS ZKH → ЖКХ','contains','epr_gis_zkh','ЖКХ/квартплата','Расход',true,100),
    mkRule('Галина Анатольевна → корректировка зарплаты','contains','галина анатольевна','Зарплата','Доход',true,110),
    mkRule('Кэшбэк/проценты → Проценты и бонусы','regex','кэшбэк|cashback|бонус|процент|начисление процентов|зачисление кэшбэка','Проценты и бонусы','Доход',true,90),
    mkRule('Ипотека/жильё → справочно','regex','ипотек|первоначальн|первоначальный взнос|кредитные средства|выдача кредита|зачисление кредита|лицевой счет|лицевой сч|эскроу|дду|жилье|жильё|квартира','Ипотека/жильё: справочно','Справочно',false,250)
  ]; }
  function mkRule(name, matchType, pattern, category, direction, includeTotals, priority=50){ return { id: uid(), enabled:true, name, matchType, pattern, category, direction, includeTotals, priority }; }

  function loadState(){
    const embedded = Array.isArray(window.operations) ? window.operations.map(normalizeOperation) : [];
    for(const key of [STORE, ...LEGACY]){
      try {
        const saved = JSON.parse(localStorage.getItem(key));
        if(saved && Array.isArray(saved.operations)) return hydrateState(saved, embedded);
      } catch(_) {}
    }
    return hydrateState({ operations: embedded, credits: [], imports: [], rules: defaultRules(), limits: defaultLimits, settings: { minSavings: 0 } }, embedded);
  }
  function hydrateState(s, embedded=[]){
    s.operations = (s.operations || []).map(normalizeOperation);
    if(!s.operations.length && embedded.length) s.operations = embedded;
    s.credits = s.credits || [];
    s.imports = s.imports || [];
    s.rules = (s.rules || s.customRules || defaultRules()).map((r,i)=>({ enabled:true, includeTotals:true, priority:50+i, ...r }));
    s.limits = { ...defaultLimits, ...(s.limits || {}) };
    s.settings = { minSavings:0, ...(s.settings || {}) };
    s.suggestions = s.suggestions || [];
    normalizeExistingOperations(s);
    return s;
  }
  function saveState(){ localStorage.setItem(STORE, JSON.stringify(state)); }

  function normalizeOperation(raw){
    const amount = num(raw.amount ?? raw['Сумма'] ?? raw.sum);
    const d = dateISO(raw.date ?? raw['Дата']);
    return {
      id: raw.id || raw.ID || raw['ID'] || uid(),
      importKey: raw.importKey || '',
      date: d,
      month: raw.month || raw['Месяц'] || monthOf(d),
      monthText: raw.monthText || raw.month_text || raw['Месяц текст'] || raw['Месяц_текст'] || monthText(monthOf(d)),
      bank: raw.bank || raw['Банк'] || '',
      sourceType: raw.sourceType || raw.source_type || raw['Тип исходный'] || raw['Источник'] || '',
      bankCategory: raw.bankCategory || raw.bank_category || raw['Категория банка'] || '',
      category: raw.category || raw.account_category || raw['Категория учета'] || raw['Группа БДР'] || 'Прочие расходы',
      direction: raw.direction || raw.flow_type || raw['Направление'] || raw['Тип потока'] || (amount >= 0 ? 'Доход' : 'Расход'),
      amount,
      currency: raw.currency || raw['Валюта'] || 'RUB',
      includeTotals: bool(raw.includeTotals ?? raw.bdr_account ?? raw['Учет_БДР'] ?? raw['Включать в общие итоги?'], true),
      regular: bool(raw.regular ?? raw['Регулярная операция?'] ?? raw['Регулярный_бюджет'], false),
      discretionary: bool(raw.discretionary ?? raw['Дискреционная трата?'] ?? raw['Дискреционность'], true),
      description: raw.description || raw['Описание'] || '',
      status: raw.status || raw['Статус'] || '',
      account: raw.account || raw['Счет/карта'] || raw['Счёт/карта'] || '',
      mcc: raw.mcc || raw.MCC || raw['MCC'] || '',
      block: raw.block || raw['Блок учета'] || '',
      excludeReason: raw.excludeReason || raw.exclusion_reason || raw['Причина исключения'] || '',
      creditId: raw.creditId || '',
      manuallyEdited: Boolean(raw.manuallyEdited)
    };
  }
  function normalizeExistingOperations(s){
    (s.operations || []).forEach(op => {
      op.date = repairDate(op.date);
      op.month = monthOf(op.date);
      op.monthText = monthText(op.month);
      if(isMortgageLike(op) || creditCats.includes(op.category)) {
        if(isMortgageLike(op)) op.category = 'Ипотека/жильё: справочно';
        op.direction = op.category === 'Кредиты/ипотека' ? 'Расход' : 'Справочно';
        op.includeTotals = false;
        op.block = 'Кредиты';
        op.discretionary = false;
      }
    });
  }

  function inferBlock(category, direction, includeTotals){ if(!includeTotals) return 'Исключено'; if(direction === 'Доход') return 'Доходы'; if(direction === 'Справочно') return 'Справочно'; if(category === 'ЖКХ/квартплата') return 'Обязательные платежи'; return 'Расходы'; }
  function setOperation(op, category, direction, includeTotals, block){ op.category = category; op.direction = direction; op.includeTotals = includeTotals; op.block = block || inferBlock(category,direction,includeTotals); op.discretionary = direction === 'Расход' && !['ЖКХ/квартплата'].includes(category); return op; }
  function isMortgageLike(op){
    const text = clean([op.description, op.bankCategory, op.sourceType, op.category, op.block, op.account, op.status].join(' '));
    if(/ипотек|первоначальн|первоначальный взнос|кредитные средства|выдача кредита|зачисление кредита|лицевой счет|лицевой сч|эскроу|дду|жилье|жильё|квартира/.test(text)) return true;
    if(num(op.amount) > 1000000 && /(банк|зачисл|поступл|перевод|кредит)/.test(text)) return true;
    return false;
  }
  function matchesRule(text, rule){ if(!rule.pattern) return false; try { return rule.matchType === 'regex' ? new RegExp(rule.pattern,'i').test(text) : text.includes(clean(rule.pattern)); } catch(_) { return text.includes(clean(rule.pattern)); } }
  function applyRules(op, force=false){
    if(op.manuallyEdited && !force) return op;
    const text = clean([op.description, op.bankCategory, op.sourceType, op.bank, op.account].join(' '));
    if(isMortgageLike(op)) return setOperation(op,'Ипотека/жильё: справочно','Справочно',false,'Кредиты');
    if(abs(op.amount) === 1 && /(магнит|доставка|провер|тест|авторизац)/.test(text)) return setOperation(op,'Не учитывается','Техническая операция',false,'Исключено');
    if(/(сергей к|сергей николаевич|между своими|своей карты|своего счета|пополнение своей|перевод между|сбер.*т.?банк|т.?банк.*сбер)/.test(text)) return setOperation(op,'Не учитывается','Внутренний перевод',false,'Исключено');
    const customRule = [...state.rules].filter(r=>r.enabled).sort((a,b)=>(b.priority||0)-(a.priority||0)).find(r=>matchesRule(text,r));
    if(customRule) return setOperation(op, customRule.category, customRule.direction, customRule.includeTotals, inferBlock(customRule.category, customRule.direction, customRule.includeTotals));
    if(/внесение налич|пополнение налич|банкомат|atm/.test(text)) return setOperation(op,'Пополнение наличными','Справочно',false,'Доходы');
    if(/ипотек|погашение кредита|кредит/.test(text) && op.amount < 0) return setOperation(op,'Кредиты/ипотека','Расход',false,'Кредиты');
    if(/возврат|refund|отмена покупки/.test(text) || (op.amount > 0 && /расход/.test(clean(op.sourceType)))) return setOperation(op, mapExpense(text), 'Возврат', true, 'Расходы');
    if(op.amount >= 0) return setOperation(op, mapIncome(text), 'Доход', true, 'Доходы');
    const cat = mapExpense(text); return setOperation(op, cat, 'Расход', true, inferBlock(cat,'Расход',true));
  }
  function mapIncome(text){ if(/зарплат|аванс/.test(text)) return 'Зарплата'; if(/стипенд|пиму/.test(text)) return 'Стипендия'; if(/кэшбэк|cashback|бонус|процент/.test(text)) return 'Проценты и бонусы'; if(/перевод|зачисление от/.test(text)) return 'Поступления от людей'; return 'Прочие доходы'; }
  function mapExpense(text){ if(/супермаркет|пятероч|магнит|перекресток|ашан|лента|продукт/.test(text)) return 'Продукты и супермаркеты'; if(/wildberries|ozon|маркет|marketplace/.test(text)) return 'Маркетплейсы/покупки'; if(/кафе|ресторан|доставка|яндекс еда|delivery|самокат|вкусно|burger|kfc/.test(text)) return 'Доставка/Еда вне дома'; if(/такси|метро|транспорт|автобус|топливо|азс/.test(text)) return 'Транспорт'; if(/мтс|билайн|мегафон|tele2|интернет|подписк|apple|google|yandex plus|кинопоиск/.test(text)) return 'Связь, интернет, подписки'; if(/жкх|квартплат|epr_gis_zkh/.test(text)) return 'ЖКХ/квартплата'; if(/аптек|мед|клиник|стомат|космет|уход/.test(text)) return 'Здоровье, аптеки и уход'; if(/комисс|услуг|сервис/.test(text)) return 'Услуги/комиссии'; if(/страхов/.test(text)) return 'Страхование'; if(/налич|банкомат|atm/.test(text)) return 'Наличные'; if(/перевод/.test(text)) return 'Переводы другим людям'; if(/ремонт|дом|строй|леруа|мебел|hoff/.test(text)) return 'Ремонт/дом'; return 'Прочие расходы'; }

  function operationKey(op){ return [op.date, Math.round(num(op.amount)*100)/100, clean(op.bank), clean(op.description), clean(op.account), clean(op.sourceType)].join('|'); }
  async function parseFiles(files){ if(!files || !files.length) throw new Error('Сначала выбери файл.'); let rows=[]; for(const file of files) rows = rows.concat(await parseFile(file)); rows = rows.map(row=>applyRules(row)); markInternalPairs(rows); const existing = new Set(state.operations.map(op=>op.importKey || operationKey(op))); const seen = new Set(); let duplicates=0; const fresh=[]; for(const op of rows){ op.importKey = operationKey(op); if(existing.has(op.importKey) || seen.has(op.importKey)) duplicates++; else { seen.add(op.importKey); fresh.push(op); } } return { id:uid(), date:new Date().toISOString(), files:[...files].map(file=>file.name), operations:fresh, duplicates, stats:previewStats(fresh, duplicates) }; }
  async function parseFile(file){ const name=file.name.toLowerCase(); if(name.endsWith('.json')) return JSON.parse(await file.text()).map(normalizeOperation); if(name.endsWith('.js')){ const text=await file.text(); const match=text.match(/(?:window\.)?operations\s*=\s*([\s\S]*?);?\s*$/); return JSON.parse(match ? match[1] : text).map(normalizeOperation); } if(name.endsWith('.csv') || name.endsWith('.txt')) return parseCsv(await file.text(), name); if(!window.XLSX) throw new Error('Не загрузилась библиотека XLSX. Обнови страницу и попробуй снова.'); const wb = XLSX.read(await file.arrayBuffer(), { type:'array', cellDates:true }); let out=[]; wb.SheetNames.forEach(sheetName => { const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header:1, raw:false, defval:'' }); out = out.concat(parseSheet(rows, name)); }); return out; }
  function parseCsv(text, filename){ const sep = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ','; const lines = text.split(/\r?\n/).filter(Boolean); const headers = splitLine(lines.shift(), sep); return lines.map(line=>rowToOperation(Object.fromEntries(splitLine(line,sep).map((value,idx)=>[headers[idx] || 'col'+idx, value])), filename)).filter(Boolean); }
  function splitLine(line,sep){ const out=[]; let current=''; let quote=false; for(const ch of line){ if(ch === '"'){ quote=!quote; continue; } if(ch === sep && !quote){ out.push(current); current=''; continue; } current += ch; } out.push(current); return out; }
  function parseSheet(rows,filename){ const headerIndex = rows.findIndex(row => { const text = clean(row.join(' ')); return row.filter(Boolean).length >= 3 && ['дата','сумма','описан','операц','назнач','категор','карта','счет','счёт'].filter(word=>text.includes(word)).length >= 2; }); if(headerIndex < 0) return []; const headers = rows[headerIndex].map(x=>String(x).trim()); return rows.slice(headerIndex+1).map(row=>Object.fromEntries(headers.map((header,idx)=>[header,row[idx]]))).map(obj=>rowToOperation(obj, filename)).filter(Boolean); }
  function val(obj, aliases){ const entries=Object.entries(obj); for(const alias of aliases){ const found = entries.find(([key])=>clean(key)===clean(alias) || clean(key).includes(clean(alias))); if(found) return found[1]; } return ''; }
  function rowToOperation(obj,filename){ const bank=/сбер|sber/.test(filename)?'Сбер':/тбанк|тинькофф|tinkoff|t-bank/.test(filename)?'Т-Банк':val(obj,['Банк']); const sourceType=/доход/.test(filename)?'Доходы файл':/расход/.test(filename)?'Расходы файл':val(obj,['Тип исходный','Источник'])||'Банковская выгрузка'; const date=dateISO(val(obj,['Дата','Дата операции','Дата платежа','Дата и время','date'])); const description=String(val(obj,['Описание','Назначение платежа','Операция','Детали операции','Контрагент','Получатель','Плательщик','Место операции','description'])||'').trim(); let amount=num(val(obj,['Сумма','Сумма операции','Сумма платежа','Сумма в валюте операции','amount','Приход','Расход'])); const incomeValue=num(val(obj,['Приход','Зачисления','Поступления'])); const expenseValue=num(val(obj,['Расход','Списания'])); if(incomeValue) amount=Math.abs(incomeValue); if(expenseValue) amount=-Math.abs(expenseValue); if(/расход/.test(filename) && amount>0) amount=-Math.abs(amount); if(/доход/.test(filename) && amount<0) amount=Math.abs(amount); if(!date && !description && !amount) return null; return normalizeOperation({ date, month:monthOf(date), monthText:monthText(monthOf(date)), bank, sourceType, bankCategory:val(obj,['Категория','Категория банка']), category:val(obj,['Категория учета','Группа БДР']), direction:val(obj,['Направление','Тип потока']), amount, currency:val(obj,['Валюта'])||'RUB', description, account:val(obj,['Счет','Счёт','Карта','Номер карты','Счет/карта','Счёт/карта']), mcc:val(obj,['MCC']), status:val(obj,['Статус']), includeTotals:val(obj,['Учет_БДР'])||undefined }); }
  function markInternalPairs(rows){ for(let i=0;i<rows.length;i++){ for(let j=i+1;j<rows.length;j++){ const a=rows[i], b=rows[j]; if(a.bank===b.bank) continue; if(Math.abs(abs(a.amount)-abs(b.amount))>2) continue; if(Math.abs(new Date(a.date)-new Date(b.date))>3*86400000) continue; if(a.amount*b.amount < 0){ setOperation(a,'Не учитывается','Внутренний перевод',false,'Исключено'); setOperation(b,'Не учитывается','Внутренний перевод',false,'Исключено'); } } } }
  function previewStats(rows,duplicates){ const s=summarize(rows); return { total:rows.length, newRows:rows.length, duplicates, excluded:rows.filter(op=>!op.includeTotals).length, review:rows.filter(op=>['Прочие расходы','Прочие доходы'].includes(op.category)).length, income:s.ordinaryIncome, expense:s.allSpending, credits:s.creditInfo, mortgage:s.mortgageInfo }; }

  function summarize(rows){
    const s={ ordinaryIncome:0, stableIncome:0, routine:0, zhkh:0, large:0, transfers:0, allSpending:0, creditInfo:0, mortgageInfo:0, byIncome:{}, byRoutine:{} };
    rows.forEach(op=>{
      const cat=op.category, amount=num(op.amount), amountAbs=abs(amount), dir=op.direction;
      if(creditCats.includes(cat)){ if(cat==='Кредиты/ипотека') s.creditInfo += amountAbs; else s.mortgageInfo += amountAbs; return; }
      if(op.includeTotals === false || excludedCats.includes(cat) || amountAbs <= 0.009) return;
      if(dir === 'Доход'){
        if(ordinaryIncomeCats.includes(cat)){ s.ordinaryIncome += amount; s.byIncome[cat]=(s.byIncome[cat]||0)+amount; }
        if(stableCats.includes(cat)) s.stableIncome += amount;
      }
      if(dir === 'Расход'){
        if(routineCats.includes(cat)){ s.routine += amountAbs; s.byRoutine[cat]=(s.byRoutine[cat]||0)+amountAbs; }
        if(cat === 'ЖКХ/квартплата') s.zhkh += amountAbs;
        if(cat === 'Крупные разовые расходы') s.large += amountAbs;
        if(cat === 'Переводы другим людям') s.transfers += amountAbs;
      }
      if(dir === 'Возврат' && routineCats.includes(cat)){ s.routine -= amountAbs; s.byRoutine[cat]=(s.byRoutine[cat]||0)-amountAbs; }
    });
    return s;
  }
  function months(){ const values=[...new Set(state.operations.map(op=>op.month).filter(m=>/^\d{4}-\d{2}$/.test(m)))].sort(); return values.length ? values : ['Нет данных']; }
  function rowsForMonth(month){ return state.operations.filter(op=>month === 'all' || op.month === month); }
  function currentMonthValue(){ return document.getElementById('monthPick')?.value || new Date().toISOString().slice(0,7); }
  function table(headers, rows, empty='Нет данных'){ if(!rows.length) return `<div class="empty">${empty}</div>`; return `<div class="scroll"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`; }
  function categoryEntries(obj){ return Object.entries(obj).filter(([,value])=>Number(value)>0.009).sort((a,b)=>b[1]-a[1]).map(([category,value],index)=>({ category, value, color:palette[index % palette.length] })); }

  function pieSvg(entries, selectedCategory, mode){ const total=entries.reduce((sum,item)=>sum+item.value,0); if(!total) return '<div class="empty">Нет данных для диаграммы</div>'; let offset=0; const circles=entries.map(item=>{ const part=item.value/total*100; const selected=selectedCategory===item.category; const dimmed=selectedCategory&&selectedCategory!==item.category; const dash=`${part} ${100-part}`; const currentOffset=offset; offset-=part; return `<circle data-chart-mode="${mode}" data-chart-cat="${esc(item.category)}" cx="90" cy="90" r="67" fill="none" stroke="${item.color}" stroke-width="${selected?31:24}" pathLength="100" stroke-dasharray="${dash}" stroke-dashoffset="${currentOffset}" transform="rotate(-90 90 90)" opacity="${dimmed?.22:1}" style="cursor:pointer;transition:.18s"></circle>`; }).join(''); const active=entries.find(item=>item.category===selectedCategory); const value=active?active.value:total; return `<svg viewBox="0 0 180 180" width="100%" height="210"><circle cx="90" cy="90" r="67" fill="none" stroke="#eee6d8" stroke-width="24"></circle>${circles}<circle cx="90" cy="90" r="48" fill="#fffaf2"></circle><text x="90" y="82" text-anchor="middle" font-size="11" fill="#7a746b" font-weight="800">${mode==='expense'?'РАСХОДЫ':'ДОХОДЫ'}</text><text x="90" y="103" text-anchor="middle" font-size="18" fill="#171717" font-weight="900">${money(value).replace(/\s?₽/,'')}</text></svg>`; }
  function operationsForCategory(mode,category){ return state.operations.filter(op=>op.category===category && op.includeTotals!==false && abs(op.amount)>0.009 && (mode==='income' ? op.direction==='Доход' : ['Расход','Возврат'].includes(op.direction))).sort((a,b)=>String(b.date||'').localeCompare(String(a.date||''))); }
  function drilldownBlock(mode,category){ const ops=operationsForCategory(mode,category); if(!ops.length) return '<div class="empty" style="margin:8px 0 12px">Операций для раскрытия нет</div>'; return `<div style="margin:8px 0 12px;padding:12px;border-radius:20px;background:#fffaf2;box-shadow:0 10px 24px rgba(24,20,15,.08);display:grid;gap:8px">${ops.map(op=>`<button data-edit-op="${esc(op.id)}" style="width:100%;border:0;display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:9px;align-items:center;padding:10px;border-radius:16px;background:#fff;color:#171717;box-shadow:inset 0 0 0 1px rgba(23,23,23,.08);text-align:left;font:inherit;cursor:pointer"><span style="font-size:12px;color:#7a746b;white-space:nowrap">${displayDate(op.date)}</span><span style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(op.description||'Без описания')}</span><b style="white-space:nowrap;color:${num(op.amount)<0?'#b42318':'#087f5b'}">${money(op.amount)}</b></button>`).join('')}</div>`; }
  function categoryList(entries, selectedCategory, mode, total){ if(!entries.length) return '<div class="empty">Нет данных</div>'; return entries.map(item=>{ const pct=total?Math.round(item.value/total*100):0; const active=selectedCategory===item.category; const dimmed=selectedCategory&&selectedCategory!==item.category; return `<div data-list-mode="${mode}" data-list-cat="${esc(item.category)}" style="cursor:pointer;margin:8px 0;padding:12px;border-radius:18px;background:${active?'#111':'#fff'};color:${active?'#fff':'#171717'};opacity:${dimmed?.55:1};box-shadow:${active?'0 12px 28px rgba(17,17,17,.18)':'inset 0 0 0 1px rgba(23,23,23,.08)'};transition:.18s"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${item.color};margin-right:8px"></span>${esc(item.category)}</span><b>${money(item.value)}</b></div><div class="bar" style="margin-top:9px;background:${active?'rgba(255,255,255,.22)':'#eee6d8'}"><span style="width:${pct}%;background:${active?'#c8a96a':item.color}"></span></div><div class="small" style="margin-top:5px;color:${active?'rgba(255,255,255,.7)':'#7a746b'}">${pct}%</div></div>${active?drilldownBlock(mode,item.category):''}`; }).join(''); }
  function bindChartInteractions(){ document.querySelectorAll('[data-chart-cat],[data-list-cat]').forEach(el=>{ el.onclick=()=>{ const mode=el.dataset.chartMode||el.dataset.listMode; const category=el.dataset.chartCat||el.dataset.listCat; if(mode==='expense') selectedExpenseCategory = selectedExpenseCategory===category ? null : category; if(mode==='income') selectedIncomeCategory = selectedIncomeCategory===category ? null : category; renderDashboard(); }; }); document.querySelectorAll('[data-edit-op]').forEach(btn=>{ btn.onclick=(event)=>{ event.stopPropagation(); openEditor(btn.dataset.editOp); }; }); }

  function merchantKey(description){ const words=clean(description).replace(/\+?\d[\d\s()\-]{5,}/g,' ').replace(/[0-9]+/g,' ').replace(/[.,;:!?"'`~()[\]{}<>/\\|_+=*№#%&^$@]/g,' ').split(' ').filter(w=>w.length>1 && !['оплата','покупка','перевод','платеж','заказ','карта','счет','tinkoff','sber'].includes(w)); return words.slice(0,3).join(' '); }
  function options(values,selected){ return values.map(v=>`<option value="${esc(v)}" ${v===selected?'selected':''}>${esc(v)}</option>`).join(''); }
  function openEditor(id){ const op=state.operations.find(item=>String(item.id)===String(id)); if(!op) return; const key=merchantKey(op.description); const similarCount=state.operations.filter(item=>merchantKey(item.description)===key).length; document.querySelectorAll('.bdr-sheet').forEach(x=>x.remove()); const sheet=document.createElement('div'); sheet.className='bdr-sheet'; sheet.style.cssText='position:fixed;inset:auto 0 0 0;z-index:9999;background:#fffaf2;border-radius:28px 28px 0 0;box-shadow:0 -22px 60px rgba(24,20,15,.24);padding:18px;display:grid;gap:12px'; sheet.innerHTML=`<div style="width:42px;height:5px;border-radius:999px;background:#d8cbb8;margin:0 auto 4px"></div><div style="font-weight:950;font-size:18px">Редактировать операцию</div><div style="color:#7a746b;font-size:13px">${displayDate(op.date)} · ${esc(op.description||'Без описания')}</div><label style="display:grid;gap:6px;font-size:13px;color:#7a746b">Категория<select id="sheetCat">${options(allCats,op.category)}</select></label><label style="display:grid;gap:6px;font-size:13px;color:#7a746b">Направление<select id="sheetDir">${options(directions,op.direction)}</select></label><label style="display:grid;gap:6px;font-size:13px;color:#7a746b">Включать в итоги<select id="sheetInc"><option value="true" ${op.includeTotals!==false?'selected':''}>Да</option><option value="false" ${op.includeTotals===false?'selected':''}>Нет</option></select></label><label style="display:flex;gap:10px;align-items:flex-start;padding:12px;border-radius:18px;background:#fff;box-shadow:inset 0 0 0 1px rgba(23,23,23,.08);font-size:14px"><input id="sheetSimilar" type="checkbox" style="width:auto;margin-top:2px"><span><b>Применить ко всем похожим</b><br><span style="color:#7a746b;font-size:12px">${key?`Шаблон: «${esc(key)}». Найдено: ${similarCount}`:'Похожие операции не найдены'}; будет создано правило.</span></span></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><button id="sheetCancel">Отмена</button><button id="sheetSave" class="primary">Сохранить</button></div>`; document.body.appendChild(sheet); document.getElementById('sheetCancel').onclick=()=>sheet.remove(); document.getElementById('sheetSave').onclick=()=>{ const category=document.getElementById('sheetCat').value; const direction=document.getElementById('sheetDir').value; const includeTotals=document.getElementById('sheetInc').value==='true'; const applySimilar=document.getElementById('sheetSimilar').checked && key; let changed=0; if(applySimilar){ state.operations.forEach(item=>{ if(merchantKey(item.description)===key){ item.category=category; item.direction=direction; item.includeTotals=includeTotals; item.manuallyEdited=true; changed++; } }); const exists=state.rules.some(rule=>String(rule.pattern||'').toLowerCase()===key.toLowerCase()); if(!exists) state.rules.push({id:'rule_'+Date.now(),enabled:true,name:`${key} → ${category}`,matchType:'contains',pattern:key,category,direction,includeTotals,priority:95}); } else { op.category=category; op.direction=direction; op.includeTotals=includeTotals; op.manuallyEdited=true; changed=1; } saveState(); sheet.remove(); render(); alert(applySimilar?`Сохранено. Обновлено похожих операций: ${changed}. Правило создано.`:'Сохранено'); }; }

  function activate(tab){ activeTab=tab; document.querySelectorAll('.tab,.section').forEach(el=>el.classList.remove('active')); document.querySelector(`[data-tab="${tab}"]`)?.classList.add('active'); document.getElementById(tab)?.classList.add('active'); }
  function bindTabs(){ document.querySelectorAll('.tab').forEach(btn=>{ btn.onclick=()=>activate(btn.dataset.tab); }); }
  function render(){ renderDashboard(); renderCurrent(); renderOperations(); renderCredits(); renderManage(); bindTabs(); activate(activeTab); }

  function dashboardSummary(){ const total=summarize(state.operations); const ms=months().filter(m=>m!=='Нет данных'); const div=ms.length||1; if(dashboardMode==='avg') return { ordinaryIncome: total.ordinaryIncome/div, stableIncome: total.stableIncome/div, routine: total.routine/div, large: total.large/div, label:'Среднемесячно' }; return { ...total, label:'Итого за период' }; }
  function dashboardModeSwitch(){ return `<div style="display:flex;gap:6px;background:#f0eadf;border-radius:999px;padding:4px;margin-bottom:12px"><button id="modeTotal" style="padding:8px 10px;box-shadow:none;background:${dashboardMode==='total'?'#111':'transparent'};color:${dashboardMode==='total'?'#fff':'#5e5447'}">Итого</button><button id="modeAvg" style="padding:8px 10px;box-shadow:none;background:${dashboardMode==='avg'?'#111':'transparent'};color:${dashboardMode==='avg'?'#fff':'#5e5447'}">В месяц</button></div>`; }
  function renderDashboard(){ const s=summarize(state.operations); const view=dashboardSummary(); const available=s.stableIncome-s.routine-s.zhkh-num(state.settings.minSavings); const needCut=Math.max(0,s.routine+s.zhkh+num(state.settings.minSavings)-s.stableIncome); const expenseEntries=categoryEntries(s.byRoutine); const expenseTotal=expenseEntries.reduce((sum,item)=>sum+item.value,0); const incomeEntries=categoryEntries(s.byIncome); const incomeTotal=incomeEntries.reduce((sum,item)=>sum+item.value,0); document.getElementById('dashboard').innerHTML=`<div class="hero"><div class="hero-label">Свободный остаток</div><div class="hero-value">${money(available)}</div><div class="hero-sub"><span class="chip">${state.operations.length} операций</span><span class="chip">Рутина ${money(s.routine)}</span><span class="chip">ЖКХ ${money(s.zhkh)}</span></div></div><div class="card white"><h3>${view.label}</h3>${dashboardModeSwitch()}<div class="grid"><div><div class="kpi-title">Обычные доходы</div><div class="value">${money(view.ordinaryIncome)}</div></div><div><div class="kpi-title">Стабильные доходы</div><div class="value">${money(view.stableIncome)}</div></div><div><div class="kpi-title">Рутина</div><div class="value">${money(view.routine)}</div></div><div><div class="kpi-title">Нужно сократить</div><div class="value ${needCut?'bad':'good'}">${money(needCut)}</div></div></div></div><div class="grid2"><div class="card"><h3>Структура расходов</h3>${pieSvg(expenseEntries,selectedExpenseCategory,'expense')}<div>${categoryList(expenseEntries,selectedExpenseCategory,'expense',expenseTotal)}</div></div><div class="card"><h3>Структура доходов</h3>${pieSvg(incomeEntries,selectedIncomeCategory,'income')}<div>${categoryList(incomeEntries,selectedIncomeCategory,'income',incomeTotal)}</div></div></div>`; document.getElementById('modeTotal').onclick=()=>{ dashboardMode='total'; localStorage.setItem('bdr.dashboard.mode',dashboardMode); renderDashboard(); }; document.getElementById('modeAvg').onclick=()=>{ dashboardMode='avg'; localStorage.setItem('bdr.dashboard.mode',dashboardMode); renderDashboard(); }; bindChartInteractions(); }

  function currentForecast(month, ops){ const monthOps=ops.filter(op=>op.month===month); const fact=summarize(monthOps); const daysIn=new Date(Number(month.slice(0,4)), Number(month.slice(5,7)), 0).getDate()||30; const maxDay=Math.max(1,...monthOps.map(op=>Number(String(op.date).slice(8,10))||1)); const nowMonth=new Date().toISOString().slice(0,7); const elapsed=month===nowMonth?new Date().getDate():maxDay; const forecast=elapsed>0?fact.routine/elapsed*daysIn:fact.routine; const otherMonths=months().filter(m=>/^\d{4}-\d{2}$/.test(m)&&m!==month); const avg=otherMonths.length?otherMonths.reduce((sum,m)=>sum+summarize(state.operations.filter(op=>op.month===m)).routine,0)/otherMonths.length:s.routine; return { fact, forecast, avg, diffAvg: forecast-avg, elapsed, daysIn }; }
  function renderCurrent(){ const ms=months(); const selected=ms.includes(currentMonthValue())?currentMonthValue():ms[0]; const s=summarize(rowsForMonth(selected)); const f=currentForecast(selected,state.operations); document.getElementById('current').innerHTML=`<div class="toolbar"><select id="monthPick">${ms.map(m=>`<option ${m===selected?'selected':''}>${m}</option>`).join('')}</select></div><div class="card white"><h3>Прогноз месяца</h3><div class="grid"><div><div class="kpi-title">Факт рутины</div><div class="value">${money(f.fact.routine)}</div></div><div><div class="kpi-title">Прогноз</div><div class="value">${money(f.forecast)}</div></div><div><div class="kpi-title">Отклонение от среднего</div><div class="value ${f.diffAvg>0?'bad':'good'}">${f.diffAvg>0?'+':''}${money(f.diffAvg)}</div></div><div><div class="kpi-title">Дней</div><div class="value">${f.elapsed}/${f.daysIn}</div></div></div></div><div class="grid"><div class="card"><div class="kpi-title">Доходы</div><div class="value">${money(s.ordinaryIncome)}</div></div><div class="card"><div class="kpi-title">Стабильные</div><div class="value">${money(s.stableIncome)}</div></div><div class="card"><div class="kpi-title">Рутина</div><div class="value">${money(s.routine)}</div></div><div class="card"><div class="kpi-title">ЖКХ</div><div class="value">${money(s.zhkh)}</div></div></div><div class="grid2"><div class="card"><h3>Доходы</h3>${table(['Категория','Сумма'],Object.entries(s.byIncome).map(([c,v])=>`<tr><td>${esc(c)}</td><td>${money(v)}</td></tr>`))}</div><div class="card"><h3>Расходы рутины</h3>${table(['Категория','Сумма'],Object.entries(s.byRoutine).map(([c,v])=>`<tr><td>${esc(c)}</td><td>${money(v)}</td></tr>`))}</div></div>`; document.getElementById('monthPick').onchange=render; }

  function operationCards(ops){ if(!ops.length) return '<div class="empty">Операций нет. Зайди в Управление и примени импорт.</div>'; return `<div style="display:grid;gap:10px">${ops.map(op=>`<div style="background:#fff;border:1px solid rgba(23,23,23,.08);border-radius:22px;padding:14px;box-shadow:0 10px 24px rgba(24,20,15,.06)"><div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div style="min-width:0"><div class="small muted">${displayDate(op.date)} · ${esc(op.bank||'Банк не указан')}</div><div style="font-weight:900;font-size:16px;margin-top:4px;white-space:normal;overflow-wrap:anywhere">${esc(op.description||'Без описания')}</div></div><div style="font-weight:950;font-size:18px;white-space:nowrap;color:${num(op.amount)<0?'#b42318':'#087f5b'}">${money(op.amount)}</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px"><div>${selectHtml('cat_'+op.id,allCats,op.category)}</div><div>${selectHtml('dir_'+op.id,directions,op.direction)}</div><div>${selectHtml('inc_'+op.id,['Да','Нет'],op.includeTotals?'Да':'Нет')}</div><div><span class="pill">${esc(op.block||'Блок')}</span></div></div></div>`).join('')}</div>`; }
  function renderOperations(){ const rows=filteredOperations().slice(0,700); document.getElementById('operations').innerHTML=`<div class="card"><h3>Операции</h3><div class="toolbar"><select id="fMonth"><option value="all">Все месяцы</option>${months().map(m=>`<option>${m}</option>`).join('')}</select><select id="fCat"><option value="all">Все категории</option>${allCats.map(c=>`<option>${c}</option>`).join('')}</select><input id="fSearch" placeholder="Поиск по описанию"><button id="fBtn" class="primary">Показать</button></div><p class="muted small">Карточки редактируются сразу: категория, направление и включение в итоги сохраняются в браузере.</p>${operationCards(rows)}</div>`; document.getElementById('fBtn').onclick=renderOperations; state.operations.forEach(bindOperationEditor); }
  function filteredOperations(){ const month=document.getElementById('fMonth')?.value||'all'; const category=document.getElementById('fCat')?.value||'all'; const query=clean(document.getElementById('fSearch')?.value||''); return state.operations.filter(op=>(month==='all'||op.month===month)&&(category==='all'||op.category===category)&&(!query||clean(op.description).includes(query))); }
  function selectHtml(id,options,value){ return `<select id="${id}">${options.map(opt=>`<option ${opt===value?'selected':''}>${opt}</option>`).join('')}</select>`; }
  function bindOperationEditor(op){ const cat=document.getElementById('cat_'+op.id); const dir=document.getElementById('dir_'+op.id); const inc=document.getElementById('inc_'+op.id); if(cat)cat.onchange=()=>{ op.category=cat.value; op.manuallyEdited=true; saveState(); render(); }; if(dir)dir.onchange=()=>{ op.direction=dir.value; op.manuallyEdited=true; saveState(); render(); }; if(inc)inc.onchange=()=>{ op.includeTotals=inc.value==='Да'; op.manuallyEdited=true; saveState(); render(); }; }
  function renderCredits(){ const creditOps=state.operations.filter(op=>creditCats.includes(op.category)); document.getElementById('credits').innerHTML=`<div class="card"><h3>Кредиты</h3><p class="muted">Кредитные и ипотечные операции отделены от общих расчётов.</p>${table(['Дата','Описание','Сумма'],creditOps.map(op=>`<tr><td>${displayDate(op.date)}</td><td>${esc(op.description)}</td><td>${money(op.amount)}</td></tr>`),'Кредитных операций нет')}</div>`; }
  function renderManage(){ const preview=pendingImport?renderPreview(pendingImport):'<p class="muted">После разбора появится предпросмотр. Нажми «Применить импорт», и операции появятся во вкладке «Операции».</p>'; document.getElementById('manage').innerHTML=`<div class="grid2"><div class="card"><h3>Импорт банков</h3><div class="bank-grid"><div class="bank-card"><div class="bank-name">Т-Банк</div><p class="muted">Загрузка XLSX</p></div><div class="bank-card"><div class="bank-name">Сбер Доходы</div><p class="muted">Загрузка XLSX</p></div><div class="bank-card"><div class="bank-name">Сбер Расходы</div><p class="muted">Загрузка XLSX</p></div></div><br><div class="drop"><b>Выбери 1–3 банковских файла</b><br><br><input id="files" type="file" multiple accept=".xlsx,.xls,.json,.csv,.js,.txt"></div><div class="toolbar"><button id="preview" class="primary">Разобрать файлы</button><button id="apply" ${pendingImport?'':'disabled'}>Применить импорт</button><button id="quick" ${pendingImport?'':'disabled'}>Применить и открыть операции</button></div><div>${preview}</div></div><div class="card ai"><h3>ИИ-помощник</h3><p class="muted">Пока локально: ищет повторяющиеся непонятные операции и предлагает правила.</p><button id="suggest" class="primary">Найти подсказки</button><div>${renderSuggestions()}</div></div></div><div class="card"><h3>Правила категоризации</h3>${renderRuleForm()}${renderRulesTable()}</div><div class="card"><h3>Резервная копия</h3><div class="toolbar"><button id="exportDb">Скачать базу JSON</button><button id="clearDb" class="danger">Очистить локальную базу</button></div></div>`; document.getElementById('preview').onclick=async()=>{ try{ pendingImport=await parseFiles(document.getElementById('files').files); render(); } catch(err){ alert(err.message||String(err)); } }; document.getElementById('apply').onclick=applyImport; document.getElementById('quick').onclick=()=>{ applyImport(); activate('operations'); }; document.getElementById('suggest').onclick=()=>{ state.suggestions=buildSuggestions(); saveState(); render(); }; document.getElementById('addRule').onclick=addRuleFromForm; document.getElementById('exportDb').onclick=()=>download('bdr-backup.json',JSON.stringify(state,null,2),'application/json'); document.getElementById('clearDb').onclick=()=>{ if(confirm('Очистить локальную базу приложения в этом браузере?')){ localStorage.removeItem(STORE); LEGACY.forEach(k=>localStorage.removeItem(k)); location.reload(); } }; state.rules.forEach(rule=>{ const btn=document.getElementById('del_'+rule.id); if(btn) btn.onclick=()=>{ state.rules=state.rules.filter(r=>r.id!==rule.id); saveState(); render(); }; }); (state.suggestions||[]).forEach(s=>{ const btn=document.getElementById('mk_'+s.id); if(btn) btn.onclick=()=>{ state.rules.push(mkRule('Правило: '+s.pattern,'contains',s.pattern,'Прочие расходы','Расход',true,70)); saveState(); render(); }; }); }
  function renderPreview(p){ const s=p.stats; return table(['Показатель','Значение'],[['Файлы',p.files.join(', ')],['Новые операции',s.newRows],['Дубли',s.duplicates],['Исключено',s.excluded],['Требует проверки',s.review],['Доходы',money(s.income)],['Расходы',money(s.expense)],['Кредиты/ипотека',money(s.credits)],['Ипотека справочно',money(s.mortgage)]].map(([a,b])=>`<tr><td>${esc(a)}</td><td>${esc(b)}</td></tr>`)); }
  function applyImport(){ if(!pendingImport) return; state.operations=state.operations.concat(pendingImport.operations); normalizeExistingOperations(state); state.imports.push({date:new Date().toISOString(),files:pendingImport.files,count:pendingImport.operations.length}); pendingImport=null; saveState(); render(); }
  function renderRuleForm(){ return `<div class="rule-card"><div class="toolbar"><input id="rName" placeholder="Название"><select id="rType"><option value="contains">Текст содержит</option><option value="regex">Регулярное выражение</option></select><input id="rPattern" placeholder="Например: новый работодатель"><select id="rCat">${allCats.map(c=>`<option>${c}</option>`).join('')}</select><select id="rDir">${directions.map(d=>`<option>${d}</option>`).join('')}</select><select id="rInc"><option value="true">Включать</option><option value="false">Не учитывать</option></select><button id="addRule" class="primary">Создать правило</button></div></div>`; }
  function addRuleFromForm(){ state.rules.push(mkRule(document.getElementById('rName').value||document.getElementById('rPattern').value,document.getElementById('rType').value,document.getElementById('rPattern').value,document.getElementById('rCat').value,document.getElementById('rDir').value,document.getElementById('rInc').value==='true',80)); saveState(); render(); }
  function renderRulesTable(){ return table(['Название','Условие','Категория','Направление',''],state.rules.map(rule=>`<tr><td>${esc(rule.name)}</td><td>${esc(rule.matchType)}: ${esc(rule.pattern)}</td><td>${esc(rule.category)}</td><td>${esc(rule.direction)}</td><td><button id="del_${rule.id}" class="danger">Удалить</button></td></tr>`),'Правил нет'); }
  function buildSuggestions(){ const groups={}; state.operations.filter(op=>['Прочие расходы','Прочие доходы'].includes(op.category)).forEach(op=>{ const key=merchantKey(op.description); if(!key)return; groups[key]=groups[key]||{id:uid(),pattern:key,count:0,total:0,sample:op.description}; groups[key].count++; groups[key].total+=abs(op.amount); }); return Object.values(groups).filter(g=>g.count>=2).sort((a,b)=>b.total-a.total).slice(0,10); }
  function renderSuggestions(){ return table(['Подсказка','Повторов','Сумма',''],(state.suggestions||[]).map(s=>`<tr><td>${esc(s.pattern)}<br><span class="muted small">${esc(s.sample)}</span></td><td>${s.count}</td><td>${money(s.total)}</td><td><button id="mk_${s.id}">Создать правило</button></td></tr>`),'Подсказок пока нет'); }
  function download(name,content,type){ const blob=new Blob([content],{type}); const link=document.createElement('a'); link.href=URL.createObjectURL(blob); link.download=name; link.click(); URL.revokeObjectURL(link.href); }

  saveState();
  render();
})();