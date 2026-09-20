/** Контракт бэкенда: snake_case, деньги в копейках. Источник — /api/openapi.json */

export type BackendEventType =
  | "expense"
  | "income"
  | "own_transfer"
  | "marketplace_transfer"
  | "debt_given"
  | "debt_repayment"
  | "shared_expense"
  | "refund"
  | "cash_withdrawal"
  | "unknown";

export type BackendStatus = "auto" | "needs_attention" | "confirmed";

export type BackendCategory =
  | "groceries"
  | "restaurants"
  | "transport"
  | "electronics"
  | "household"
  | "subscriptions"
  | "health"
  | "shopping"
  | "cash"
  | "other";

export type ResolveAction =
  | "expense"
  | "income"
  | "own_transfer"
  | "debt_given"
  | "debt_repayment"
  | "shared_expense_repayment"
  | "refund";

export type ContributionDto = {
  transaction_id: string;
  occurred_at: string;
  amount_minor: number;
  expense_minor: number;
  income_minor: number;
  role: string;
  category: BackendCategory;
  category_allocations?: Record<string, number>;
};

export type FinancialEventDto = {
  id: string;
  type: BackendEventType;
  status: BackendStatus;
  title: string;
  occurred_at: string;
  currency: string;
  category: BackendCategory;
  confidence: number;
  reason: string;
  related_event_id: string | null;
  remaining_minor: number | null;
  contributions: ContributionDto[];
  funding_links: { event_id: string; amount_minor: number }[];
  expense_impact_minor: number;
  income_impact_minor: number;
  bank_outflow_minor: number;
  bank_inflow_minor: number;
};

export type TransactionDto = {
  id: string;
  external_id: string;
  account_id: string;
  amount_minor: number;
  occurred_at: string;
  currency: string;
  description: string;
  merchant: string | null;
  counterparty: string | null;
  category: BackendCategory | null;
  card_last4: string | null;
  source: string;
};

export type EventDetailDto = {
  event: FinancialEventDto;
  transactions: TransactionDto[];
  related_events: FinancialEventDto[];
  nodes: { id: string; kind: string; label: string; amount_minor: number }[];
  edges: { source: string; target: string; role: string; amount_minor: number | null }[];
};

export type ResolutionOptionDto = {
  action: ResolveAction;
  label: string;
  related_event_id: string | null;
};

export type AttentionItemDto = {
  event: FinancialEventDto;
  question: string;
  options: ResolutionOptionDto[];
};

export type PeriodSummaryDto = {
  start_date: string;
  end_date: string;
  timezone: string;
  currency: string;
  bank_outflow_minor: number;
  bank_inflow_minor: number;
  real_expense_minor: number;
  real_income_minor: number;
  net_income_minor: number;
  excluded_minor: number;
  unresolved_inflow_minor: number;
  needs_attention_count: number;
  is_provisional: boolean;
  excluded_breakdown: { type: BackendEventType; amount_minor: number; event_ids: string[] }[];
  categories: { category: BackendCategory; expense_minor: number }[];
  timeline: { date: string; expense_minor: number; income_minor: number }[];
};

export type ComparisonDto = {
  previous_start_date: string;
  previous_end_date: string;
  previous_expense_minor: number;
  previous_income_minor: number;
  expense_delta_minor: number;
  income_delta_minor: number;
  expense_change_percent: number | null;
};

export type AccountDto = {
  id: string;
  external_id: string;
  bank: string;
  name: string;
  account_type: string;
  currency: string;
  opening_balance_minor: number;
  balance_minor: number;
  last_synced_at: string | null;
};

export type DashboardDto = {
  summary: PeriodSummaryDto;
  comparison: ComparisonDto;
  cash_policy: string;
  accounting_policy: string;
  last_synced_at: string | null;
  total_balance_minor: number;
  accounts: AccountDto[];
  recent_events: FinancialEventDto[];
  attention_preview: AttentionItemDto[];
};

export type AnalyticsDto = {
  summary: PeriodSummaryDto;
  comparison: ComparisonDto;
  cash_policy: string;
  accounting_policy: string;
  last_synced_at: string | null;
};

export type PageDto<T> = { items: T[]; total: number; limit: number; offset: number };

export type ImportResultDto = {
  imported_count: number;
  duplicate_count: number;
  event_count: number;
  needs_attention_count: number;
  synced_at: string;
};

export type StatementPreviewDto = {
  format: string;
  account_fingerprint: string;
  account_last4: string;
  start_date: string;
  end_date: string;
  reported_inflow_minor: number;
  reported_outflow_minor: number;
  computed_inflow_minor: number;
  computed_outflow_minor: number;
  totals_match: boolean;
  transactions: unknown[];
  warnings: string[];
};

export type StatementResultDto = { import_result: ImportResultDto; statement: StatementPreviewDto };

export type BankDto = {
  code: string;
  name: string;
  mode: string;
  connected: boolean;
  last_synced_at: string | null;
};

export type IntegrationDto = {
  code: string;
  name: string;
  mode: string;
  live_sync_available: boolean;
  imported_orders_count: number;
  linked_orders_count: number;
};

export type ResolveResultDto = {
  event: FinancialEventDto;
  needs_attention_count: number;
  refresh: string[];
};
