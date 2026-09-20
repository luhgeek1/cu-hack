import type {
  AccountDto,
  AttentionItemDto,
  BackendCategory,
  ComparisonDto,
  FinancialEventDto,
  PeriodSummaryDto,
  ResolveAction,
} from "../api/dto";
import { periodRange } from "./period";
import type {
  Account,
  Category,
  EventType,
  ExcludedReason,
  FinancialEvent,
  PeriodKey,
  PeriodSummary,
  ResolutionOption,
} from "./types";

const rub = (minor: number): number => minor / 100;

export const CATEGORY_LABELS: Record<BackendCategory, Category> = {
  groceries: "Продукты",
  restaurants: "Кафе",
  transport: "Транспорт",
  electronics: "Техника",
  household: "Дом",
  subscriptions: "Подписки",
  health: "Здоровье",
  shopping: "Покупки",
  cash: "Наличные",
  other: "Прочее",
};

/** Ключи приходят и как типы событий, и как отдельные причины вычета */
const EXCLUDED_LABELS: Record<string, string> = {
  own_transfer: "Переводы между своими счетами",
  marketplace_transfer: "Пополнение карт маркетплейсов",
  shared_expense_reimbursement: "Скинулись друзья",
  shared_expense: "Скинулись друзья",
  debt_given: "Дали в долг",
  debt_repayment: "Возвраты долга",
  refund: "Возвраты покупок",
  cash_withdrawal: "Наличные",
  unknown: "Ждёт уточнения",
};

export const BANK_NAMES: Record<string, string> = {
  tbank: "Т-Банк",
  sber: "Сбер",
  alfa: "Альфа",
  ozon: "Ozon Банк",
  cash: "Наличные",
};

export const mapCategory = (category: BackendCategory | null | undefined): Category | undefined =>
  category ? CATEGORY_LABELS[category] : undefined;

export const mapEvent = (dto: FinancialEventDto): FinancialEvent => ({
  id: dto.id,
  type: dto.type.toUpperCase() as EventType,
  title: dto.title,
  subtitle: mapCategory(dto.category),
  category: mapCategory(dto.category),
  amount: rub(dto.bank_outflow_minor || dto.bank_inflow_minor),
  effectiveExpense: rub(dto.expense_impact_minor),
  effectiveIncome: rub(dto.income_impact_minor),
  confidence: dto.confidence,
  status: dto.status,
  timestamp: dto.occurred_at,
  transactionIds: dto.contributions.map((item) => item.transaction_id),
  reason: dto.reason,
  debtOutstanding: dto.remaining_minor ? rub(dto.remaining_minor) : undefined,
});

/** Вариант ответа пользователя: id склеен из действия и связанного события */
export const optionId = (action: string, relatedEventId: string | null): string =>
  `${action}:${relatedEventId ?? ""}`;

const optionHint = (action: ResolveAction | "later"): string => {
  switch (action) {
    case "income":
      return "Попадёт в доходы";
    case "expense":
      return "Попадёт в траты";
    case "own_transfer":
      return "Не доход и не трата";
    case "debt_given":
      return "Деньги вернутся";
    case "debt_repayment":
      return "Возврат долга";
    case "shared_expense_repayment":
      return "Уменьшит трату";
    case "refund":
      return "Уменьшит трату";
    default:
      return "Решить позже";
  }
};

export const mapAttentionItem = (dto: AttentionItemDto): FinancialEvent => {
  const event = mapEvent(dto.event);
  const options: ResolutionOption[] = dto.options.map((option) => ({
    id: optionId(option.action, option.related_event_id),
    label: option.label,
    action: option.action,
    relatedEventId: option.related_event_id,
    hint: optionHint(option.action as ResolveAction | "later"),
  }));

  return {
    ...event,
    status: "needs_attention",
    question: dto.question,
    subtitle: event.title,
    options,
  };
};

const ACCOUNT_TYPES: Record<string, string> = {
  card: "карта",
  cash: "наличные",
  marketplace: "маркетплейс",
  savings: "накопительный",
  checking: "счёт",
};

export const mapAccount = (dto: AccountDto): Account => ({
  id: dto.id,
  bank: dto.bank,
  bankName: BANK_NAMES[dto.bank] ?? dto.name,
  name: dto.name,
  mask: ACCOUNT_TYPES[dto.account_type] ?? dto.account_type,
  currency: "RUB",
  balance: rub(dto.balance_minor),
  lastSyncAt: dto.last_synced_at,
});

type SeriesPoint = PeriodSummary["series"][number];

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const DAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

/** Бэкенд отдаёт дневной ряд; год сворачиваем в месяцы, остальное — день в день */
const buildSeries = (key: PeriodKey, timeline: PeriodSummaryDto["timeline"]): SeriesPoint[] => {
  const points = timeline.map((point) => {
    const from = new Date(`${point.date}T00:00:00`);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { from, to, value: rub(point.expense_minor) };
  });

  if (key === "year") {
    const months = new Map<number, SeriesPoint>();
    points.forEach((point) => {
      const month = point.from.getMonth();
      const existing = months.get(month);
      if (existing) {
        existing.value += point.value;
        existing.to = point.to;
        return;
      }
      months.set(month, {
        label: MONTHS_SHORT[month],
        value: point.value,
        from: new Date(point.from.getFullYear(), month, 1),
        to: new Date(point.from.getFullYear(), month + 1, 1),
        inRange: true,
      });
    });

    const year = points[0]?.from.getFullYear() ?? new Date().getFullYear();
    return [...Array(12).keys()].map(
      (month) =>
        months.get(month) ?? {
          label: MONTHS_SHORT[month],
          value: 0,
          from: new Date(year, month, 1),
          to: new Date(year, month + 1, 1),
          inRange: true,
        }
    );
  }

  return points.map((point) => ({
    label: String(point.from.getDate()),
    caption: key === "week" ? DAYS_SHORT[point.from.getDay()] : undefined,
    value: point.value,
    from: point.from,
    to: point.to,
    inRange: true,
  }));
};


export const mapSummary = (
  key: PeriodKey,
  anchor: Date,
  summary: PeriodSummaryDto,
  comparison: ComparisonDto
): PeriodSummary => {
  const realExpense = rub(summary.real_expense_minor);

  const categories = summary.categories
    .filter((row) => row.expense_minor > 0)
    .map((row) => ({
      category: CATEGORY_LABELS[row.category],
      amount: rub(row.expense_minor),
      share: realExpense > 0 ? rub(row.expense_minor) / realExpense : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const excludedBreakdown: ExcludedReason[] = summary.excluded_breakdown
    .map((row) => ({
      type: row.type.toUpperCase() as EventType,
      label: EXCLUDED_LABELS[row.type] ?? "Прочее",
      amount: rub(row.amount_minor),
    }))
    .sort((a, b) => b.amount - a.amount);

  return {
    key,
    label: periodRange(key, anchor).label,
    from: new Date(`${summary.start_date}T00:00:00`),
    to: new Date(`${summary.end_date}T23:59:59`),
    bankSpent: rub(summary.bank_outflow_minor),
    realExpense,
    realIncome: rub(summary.real_income_minor),
    excluded: rub(summary.excluded_minor),
    excludedBreakdown,
    categories,
    needsAttention: summary.needs_attention_count,
    previousRealExpense: rub(comparison.previous_expense_minor),
    series: buildSeries(key, summary.timeline),
  };
};

export const emptySummary = (key: PeriodKey, anchor: Date): PeriodSummary => {
  const range = periodRange(key, anchor);
  return {
    key,
    label: range.label,
    from: range.from,
    to: range.to,
    bankSpent: 0,
    realExpense: 0,
    realIncome: 0,
    excluded: 0,
    excludedBreakdown: [],
    categories: [],
    needsAttention: 0,
    previousRealExpense: 0,
    series: [],
  };
};
