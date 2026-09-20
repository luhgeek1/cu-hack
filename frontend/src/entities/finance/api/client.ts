import apiProtected from "@/shared/api/axiosInstance";

import type {
  AccountDto,
  AnalyticsDto,
  AttentionItemDto,
  BankDto,
  DashboardDto,
  EventDetailDto,
  FinancialEventDto,
  ImportResultDto,
  IntegrationDto,
  PageDto,
  ResolveAction,
  ResolveResultDto,
  SpendingAdviceDto,
  StatementPreviewDto,
  StatementResultDto,
} from "./dto";

export type PeriodParam = "day" | "week" | "month" | "year";

/** Бэкенд считает в Europe/Moscow, если не сказано иное */
const TZ = "Europe/Moscow";

/** Дата без времени — бэкенд ждёт YYYY-MM-DD */
export const isoDate = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const getDashboard = async (period: PeriodParam, date: Date): Promise<DashboardDto> => {
  const { data } = await apiProtected.get<DashboardDto>("/dashboard", {
    params: { period, date: isoDate(date), timezone: TZ },
  });
  return data;
};

/** Произвольный диапазон: бэкенд принимает start_date/end_date вместо period */
export const getDashboardRange = async (from: Date, to: Date): Promise<DashboardDto> => {
  const { data } = await apiProtected.get<DashboardDto>("/dashboard", {
    params: { start_date: isoDate(from), end_date: isoDate(to), timezone: TZ },
  });
  return data;
};

export const getAnalyticsRange = async (from: Date, to: Date): Promise<AnalyticsDto> => {
  const { data } = await apiProtected.get<AnalyticsDto>("/analytics", {
    params: { start_date: isoDate(from), end_date: isoDate(to), timezone: TZ },
  });
  return data;
};

export const getAnalytics = async (period: PeriodParam, date: Date): Promise<AnalyticsDto> => {
  const { data } = await apiProtected.get<AnalyticsDto>("/analytics", {
    params: { period, date: isoDate(date), timezone: TZ },
  });
  return data;
};

export const getEvents = async (params: {
  startDate: Date;
  endDate: Date;
  status?: "auto" | "needs_attention" | "confirmed";
  limit?: number;
}): Promise<PageDto<FinancialEventDto>> => {
  const { data } = await apiProtected.get<PageDto<FinancialEventDto>>("/events", {
    params: {
      start_date: isoDate(params.startDate),
      end_date: isoDate(params.endDate),
      status: params.status,
      timezone: TZ,
      limit: params.limit ?? 200,
    },
  });
  return data;
};

export const getEventDetail = async (id: string): Promise<EventDetailDto> => {
  const { data } = await apiProtected.get<EventDetailDto>(`/events/${id}`);
  return data;
};

export const getAttention = async (): Promise<PageDto<AttentionItemDto>> => {
  const { data } = await apiProtected.get<PageDto<AttentionItemDto>>("/attention", {
    params: { limit: 50 },
  });
  return data;
};

export const resolveEvent = async (
  eventId: string,
  payload: { action: ResolveAction; related_event_id?: string | null }
): Promise<ResolveResultDto> => {
  const { data } = await apiProtected.post<ResolveResultDto>(`/events/${eventId}/resolve`, {
    action: payload.action,
    ...(payload.related_event_id ? { related_event_id: payload.related_event_id } : {}),
  });
  return data;
};

export const getAccounts = async (): Promise<AccountDto[]> => {
  const { data } = await apiProtected.get<AccountDto[]>("/accounts");
  return data;
};

export const createAccount = async (payload: {
  external_id: string;
  bank: string;
  name: string;
  account_type: string;
  opening_balance_minor?: number;
}): Promise<AccountDto> => {
  const { data } = await apiProtected.post<AccountDto>("/accounts", {
    currency: "RUB",
    opening_balance_minor: 0,
    ...payload,
  });
  return data;
};

export const getBanks = async (): Promise<BankDto[]> => {
  const { data } = await apiProtected.get<BankDto[]>("/banks");
  return data;
};

/** Демо-провайдеры: один банк */
export const syncBank = async (provider: string, month: Date): Promise<ImportResultDto> => {
  const { data } = await apiProtected.post<ImportResultDto>(`/banks/${provider}/sync`, {
    month: isoDate(new Date(month.getFullYear(), month.getMonth(), 1)),
  });
  return data;
};

export const connectBank = async (provider: string, month: Date): Promise<ImportResultDto> => {
  const { data } = await apiProtected.post<ImportResultDto>(`/banks/${provider}/connect-and-sync`, {
    month: isoDate(new Date(month.getFullYear(), month.getMonth(), 1)),
  });
  return data;
};

/** Все четыре демо-банка одним запросом, идемпотентно */
export const loadDemo = async (month: Date): Promise<ImportResultDto> => {
  const { data } = await apiProtected.post<ImportResultDto>("/demo/load", {
    month: isoDate(new Date(month.getFullYear(), month.getMonth(), 1)),
  });
  return data;
};

export const previewStatement = async (accountId: string, file: File): Promise<StatementPreviewDto> => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiProtected.post<StatementPreviewDto>("/imports/tbank/preview", form, {
    params: { account_id: accountId },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const importStatement = async (accountId: string, file: File): Promise<StatementResultDto> => {
  const form = new FormData();
  form.append("file", file);
  const { data } = await apiProtected.post<StatementResultDto>("/imports/tbank", form, {
    params: { account_id: accountId },
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

/** Готовые операции из файла — бэкенд принимает не больше 2000 за раз */
export const importTransactions = async (
  transactions: Record<string, unknown>[]
): Promise<ImportResultDto> => {
  const { data } = await apiProtected.post<ImportResultDto>("/imports", { transactions });
  return data;
};

export const getIntegrations = async (): Promise<IntegrationDto[]> => {
  const { data } = await apiProtected.get<IntegrationDto[]>("/integrations");
  return data;
};

export type DigestDto = {
  date: string;
  outstanding_debt_minor: number;
  message: string;
};

export const getDigest = async (date: Date): Promise<DigestDto> => {
  const { data } = await apiProtected.get<DigestDto>("/digest", {
    params: { date: isoDate(date), timezone: TZ },
  });
  return data;
};

/** Советы по тратам: модель или детерминированный разбор на бэкенде */
export const getInsights = async (period: PeriodParam, date: Date): Promise<SpendingAdviceDto> => {
  const { data } = await apiProtected.get<SpendingAdviceDto>("/insights", {
    params: { period, date: isoDate(date), timezone: TZ },
  });
  return data;
};
