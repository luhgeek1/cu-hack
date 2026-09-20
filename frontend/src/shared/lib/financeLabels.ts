export interface CategoryMeta {
  label: string;
  color: string;
  icon?: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  groceries: { label: 'Супермаркеты', color: '#10b981' },
  restaurants: { label: 'Рестораны и кафе', color: '#f59e0b' },
  transport: { label: 'Транспорт', color: '#06b6d4' },
  electronics: { label: 'Техника и электроника', color: '#8b5cf6' },
  household: { label: 'Товары для дома', color: '#ec4899' },
  subscriptions: { label: 'Подписки и сервисы', color: '#6366f1' },
  shopping: { label: 'Одежда и шопинг', color: '#3b82f6' },
  health: { label: 'Здоровье и аптеки', color: '#14b8a6' },
  cash: { label: 'Снятие наличных', color: '#64748b' },
  other: { label: 'Прочее', color: '#71717a' },
};

export const getCategoryMeta = (category: string): CategoryMeta => {
  return CATEGORY_META[category] || { label: category || 'Прочее', color: '#71717a' };
};

export const EXCLUSION_LABELS: Record<string, { label: string; desc: string }> = {
  own_transfer: {
    label: 'Переводы себе',
    desc: 'Переводы между своими счетами в разных банках не уменьшают ваш капитал',
  },
  marketplace_transfer: {
    label: 'Пополнение маркетплейса',
    desc: 'Пополнение Ozon-карты — это перемещение средств; траты учитываются при покупках',
  },
  shared_expense_reimbursement: {
    label: 'Компенсации за общий чек',
    desc: 'Друзья перевели свою долю за ужин/поездку, реальный расход — только ваша часть',
  },
  shared_expense: {
    label: 'Компенсации за общий чек',
    desc: 'Друзья перевели свою долю за ужин/поездку, реальный расход — только ваша часть',
  },
  refund: {
    label: 'Возвраты товаров',
    desc: 'Возврат денег от магазина уменьшает траты, а не считается новым доходом',
  },
  debt_given: {
    label: 'Деньги в долг',
    desc: 'Временная передача денег не является расходом бюджета',
  },
  debt_repayment: {
    label: 'Возврат долга',
    desc: 'Возвращенные вам долги не являются чистым доходом',
  },
  cash_withdrawal: {
    label: 'Снятие наличных',
    desc: 'Наличные учтены в момент снятия в банкомате',
  },
};

export const getExclusionInfo = (type: string) => {
  return EXCLUSION_LABELS[type] || {
    label: type.replace(/_/g, ' '),
    desc: 'Операция исключена из расходов для предотвращения искажения бюджета',
  };
};

export const BANK_NAMES: Record<string, string> = {
  tbank: 'Т-Банк',
  sber: 'Сбер',
  alfa: 'Альфа-Банк',
  ozon: 'Ozon Банк',
};

export const getBankName = (code: string) => BANK_NAMES[code] || code;
