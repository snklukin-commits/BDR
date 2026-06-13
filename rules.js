window.BDR_RULES = {
  normalizeAmount(value) {
    if (typeof value === 'number') return value;
    if (value == null) return 0;
    return Number(String(value).replace(/\s/g, '').replace(',', '.')) || 0;
  },

  getCategory(op) {
    return op.group || op.bdrGroup || op['Группа БДР'] || op.account_category || op.bank_category || op.category || 'Без категории';
  },

  getFlowType(op) {
    return op.flow_type || op.flowType || op['Тип потока'] || op.type || '';
  },

  shouldInclude(op) {
    const flag = op.bdr_account ?? op.bdrAccount ?? op['Учет_БДР'];
    if (String(flag).toLowerCase() === 'нет') return false;
    const reason = String(op.exclusion_reason || op['Причина исключения'] || '').toLowerCase();
    if (reason.includes('внутрен')) return false;
    return true;
  },

  classify(op) {
    const amount = this.normalizeAmount(op.amount ?? op['Сумма']);
    const flow = String(this.getFlowType(op)).toLowerCase();
    if (flow.includes('доход')) return 'income';
    if (flow.includes('возврат')) return 'refund';
    if (flow.includes('расход')) return 'expense';
    return amount >= 0 ? 'income' : 'expense';
  },

  monthKey(op) {
    const raw = op.month || op['Месяц'] || op.date || op['Дата'];
    if (!raw) return 'Без месяца';
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return String(raw).slice(0, 7);
  }
};