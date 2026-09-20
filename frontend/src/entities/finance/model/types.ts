export type BankId = "tbank" | "sber" | "alfa" | "ozon";

export type Account = {
  id: string;
  bank: BankId;
  bankName: string;
  name: string;
  mask: string;
  currency: "RUB";
  balance: number;
  lastSyncAt: string;
};

export type Transaction = {
  id: string;
  accountId: string;
  /** Всегда положительное число, знак задаёт direction */
  amount: number;
  direction: "debit" | "credit";
  timestamp: string;
  merchant?: string;
  description?: string;
};

export type EventType =
  | "EXPENSE"
  | "INCOME"
  | "OWN_TRANSFER"
  | "DEBT_GIVEN"
  | "DEBT_REPAYMENT"
  | "REFUND"
  | "SHARED_EXPENSE"
  | "MARKETPLACE_TRANSFER"
  | "CASH_WITHDRAWAL"
  | "UNKNOWN";

export type EventStatus = "auto" | "needs_attention" | "confirmed";

export type Category =
  | "Продукты"
  | "Кафе"
  | "Транспорт"
  | "Дом"
  | "Здоровье"
  | "Развлечения"
  | "Подписки"
  | "Одежда"
  | "Наличные"
  | "Прочее";

export type ResolutionOption = {
  id: string;
  label: string;
  /** Во что превращается событие после выбора */
  type: EventType;
  effectiveExpense: number;
  effectiveIncome: number;
  hint: string;
};

export type FinancialEvent = {
  id: string;
  type: EventType;
  title: string;
  subtitle?: string;
  category?: Category;
  /** Сумма события «как в банке» */
  amount: number;
  effectiveExpense: number;
  effectiveIncome: number;
  confidence: number;
  status: EventStatus;
  timestamp: string;
  transactionIds: string[];
  /** Почему движок решил именно так — одна строка */
  reason?: string;
  question?: string;
  options?: ResolutionOption[];
  /** Для долгов: сколько ещё не вернули */
  debtOutstanding?: number;
  /** Событие, поведение которого задаёт настройка в профиле */
  policyKey?: "cash";
};

export type PeriodKey = "day" | "week" | "month" | "year";

export type CategoryTotal = {
  category: Category;
  amount: number;
  share: number;
};

export type ExcludedReason = {
  type: EventType;
  label: string;
  amount: number;
};

export type PeriodSummary = {
  key: PeriodKey;
  label: string;
  from: Date;
  to: Date;
  bankSpent: number;
  realExpense: number;
  realIncome: number;
  excluded: number;
  excludedBreakdown: ExcludedReason[];
  categories: CategoryTotal[];
  needsAttention: number;
  previousRealExpense: number;
  series: { label: string; value: number; from: Date; to: Date }[];
};
