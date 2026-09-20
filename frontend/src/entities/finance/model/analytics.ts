import { accountsById, transactionsById } from "./dataset";
import type {
  BankId,
  Category,
  CategoryTotal,
  EventType,
  ExcludedReason,
  FinancialEvent,
  PeriodKey,
  PeriodSummary,
} from "./types";

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const DAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

export const EXCLUDED_LABELS: Partial<Record<EventType, string>> = {
  OWN_TRANSFER: "Переводы между своими счетами",
  MARKETPLACE_TRANSFER: "Пополнение карт маркетплейсов",
  SHARED_EXPENSE: "Скинулись друзья",
  DEBT_GIVEN: "Дали в долг",
  REFUND: "Возвраты покупок",
  CASH_WITHDRAWAL: "Наличные в кошельке",
  UNKNOWN: "Не определено",
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Неделя начинается с понедельника */
const startOfWeek = (date: Date) => {
  const day = startOfDay(date);
  const shift = (day.getDay() + 6) % 7;
  return addDays(day, -shift);
};

export type Range = { from: Date; to: Date; label: string };

export const periodRange = (key: PeriodKey, anchor: Date): Range => {
  switch (key) {
    case "day": {
      const from = startOfDay(anchor);
      return {
        from,
        to: addDays(from, 1),
        label: `${from.getDate()} ${MONTHS[from.getMonth()]}`,
      };
    }
    case "week": {
      const from = startOfWeek(anchor);
      const to = addDays(from, 7);
      const last = addDays(to, -1);
      return {
        from,
        to,
        label: `${from.getDate()}–${last.getDate()} ${MONTHS_SHORT[last.getMonth()]}`,
      };
    }
    case "year": {
      const from = new Date(anchor.getFullYear(), 0, 1);
      return { from, to: new Date(anchor.getFullYear() + 1, 0, 1), label: String(anchor.getFullYear()) };
    }
    case "month":
    default: {
      const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      return {
        from,
        to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1),
        label: MONTHS[anchor.getMonth()],
      };
    }
  }
};

const previousAnchor = (key: PeriodKey, anchor: Date): Date => {
  switch (key) {
    case "day":
      return addDays(anchor, -1);
    case "week":
      return addDays(anchor, -7);
    case "year":
      return new Date(anchor.getFullYear() - 1, anchor.getMonth(), 1);
    case "month":
    default:
      return new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1);
  }
};

export type BankFilter = BankId | "all";

/** Событие относится к банку, если хотя бы одна его операция прошла по счёту этого банка */
export const touchesBank = (event: FinancialEvent, bank: BankFilter) => {
  if (bank === "all") return true;
  return event.transactionIds.some((id) => {
    const item = transactionsById.get(id);
    if (!item) return false;
    return accountsById.get(item.accountId)?.bank === bank;
  });
};

const inRange = (event: FinancialEvent, range: Range) => {
  const time = new Date(event.timestamp).getTime();
  return time >= range.from.getTime() && time < range.to.getTime();
};

const debitSum = (event: FinancialEvent) =>
  event.transactionIds.reduce((sum, id) => {
    const item = transactionsById.get(id);
    if (!item || item.direction !== "debit") return sum;
    return sum + item.amount;
  }, 0);

const sumExpense = (events: FinancialEvent[]) =>
  events.reduce((sum, event) => sum + event.effectiveExpense, 0);

const buildSeries = (key: PeriodKey, range: Range, events: FinancialEvent[]) => {
  const buckets: { label: string; from: Date; to: Date }[] = [];

  if (key === "year") {
    for (let month = 0; month < 12; month += 1) {
      const from = new Date(range.from.getFullYear(), month, 1);
      buckets.push({ label: MONTHS_SHORT[month], from, to: new Date(range.from.getFullYear(), month + 1, 1) });
    }
  } else if (key === "month") {
    let cursor = startOfWeek(range.from);
    while (cursor < range.to) {
      const to = addDays(cursor, 7);
      buckets.push({ label: `${cursor.getDate()}–${addDays(to, -1).getDate()}`, from: cursor, to });
      cursor = to;
    }
  } else {
    const days = key === "week" ? 7 : 1;
    for (let i = 0; i < days; i += 1) {
      const from = addDays(range.from, i);
      buckets.push({ label: DAYS_SHORT[from.getDay()], from, to: addDays(from, 1) });
    }
  }

  return buckets.map((bucket) => ({
    ...bucket,
    value: sumExpense(
      events.filter((event) => {
        const time = new Date(event.timestamp).getTime();
        return time >= bucket.from.getTime() && time < bucket.to.getTime();
      })
    ),
  }));
};

export const summarize = (
  events: FinancialEvent[],
  key: PeriodKey,
  anchor: Date,
  bank: BankFilter = "all"
): PeriodSummary => {
  const range = periodRange(key, anchor);
  const pool = bank === "all" ? events : events.filter((event) => touchesBank(event, bank));
  const scoped = pool.filter((event) => inRange(event, range));

  const realExpense = sumExpense(scoped);
  const realIncome = scoped.reduce((sum, event) => sum + event.effectiveIncome, 0);
  const bankSpent = scoped.reduce((sum, event) => sum + debitSum(event), 0);

  const excludedMap = new Map<EventType, number>();
  scoped.forEach((event) => {
    const delta = debitSum(event) - event.effectiveExpense;
    if (delta <= 0) return;
    excludedMap.set(event.type, (excludedMap.get(event.type) ?? 0) + delta);
  });

  const excludedBreakdown: ExcludedReason[] = [...excludedMap.entries()]
    .map(([type, amount]) => ({ type, label: EXCLUDED_LABELS[type] ?? "Прочее", amount }))
    .sort((a, b) => b.amount - a.amount);

  const categoryMap = new Map<Category, number>();
  scoped.forEach((event) => {
    if (event.effectiveExpense <= 0) return;
    const category: Category = event.category ?? (event.type === "CASH_WITHDRAWAL" ? "Наличные" : "Прочее");
    categoryMap.set(category, (categoryMap.get(category) ?? 0) + event.effectiveExpense);
  });

  const categories: CategoryTotal[] = [...categoryMap.entries()]
    .map(([category, amount]) => ({
      category,
      amount,
      share: realExpense > 0 ? amount / realExpense : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const previousRange = periodRange(key, previousAnchor(key, anchor));
  const previousRealExpense = sumExpense(pool.filter((event) => inRange(event, previousRange)));

  return {
    key,
    label: range.label,
    from: range.from,
    to: range.to,
    bankSpent,
    realExpense,
    realIncome,
    excluded: Math.max(bankSpent - realExpense, 0),
    excludedBreakdown,
    categories,
    needsAttention: scoped.filter((event) => event.status === "needs_attention").length,
    previousRealExpense,
    series: buildSeries(key, range, scoped),
  };
};

export const eventsInPeriod = (
  events: FinancialEvent[],
  key: PeriodKey,
  anchor: Date,
  bank: BankFilter = "all"
) => {
  const range = periodRange(key, anchor);
  return events.filter((event) => inRange(event, range) && touchesBank(event, bank));
};

export { MONTHS, MONTHS_SHORT };
