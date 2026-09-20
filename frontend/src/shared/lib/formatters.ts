export const formatMoney = (minorUnits?: number | null): string => {
  const value = (minorUnits ?? 0) / 100;
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
};

export const formatMoneyDelta = (minorUnits?: number | null): string => {
  const units = minorUnits ?? 0;
  const formatted = formatMoney(units);
  if (units > 0) return `+${formatted}`;
  return formatted;
};

export const getEventAmount = (event: any): number => {
  if (!event) return 0;
  if (typeof event.amount_minor === 'number') return event.amount_minor;
  if (event.bank_outflow_minor) return -event.bank_outflow_minor;
  if (event.bank_inflow_minor) return event.bank_inflow_minor;
  if (event.expense_impact_minor) return -event.expense_impact_minor;
  if (event.income_impact_minor) return event.income_impact_minor;
  return 0;
};

