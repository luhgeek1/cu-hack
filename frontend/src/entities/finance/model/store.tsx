import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import * as api from "../api/client";
import type { ResolveAction } from "../api/dto";
import { emptySummary, mapAccount, mapAttentionItem, mapEvent, mapSummary } from "./mappers";
import { periodRange } from "./period";
import type { Account, FinancialEvent, PeriodKey, PeriodSummary } from "./types";

export type DateRange = { from: Date; to: Date };

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Сдвиг якоря на шаг периода: день, неделя, месяц или год */
const shiftDate = (key: PeriodKey, anchor: Date, step: number): Date => {
  switch (key) {
    case "day":
      return addDays(anchor, step);
    case "week":
      return addDays(anchor, step * 7);
    case "year":
      return new Date(anchor.getFullYear() + step, anchor.getMonth(), 1);
    case "month":
    default:
      return new Date(anchor.getFullYear(), anchor.getMonth() + step, 1);
  }
};

type FinanceContextValue = {
  today: Date;
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
  /** Какой именно период показываем: якорная дата внутри него */
  anchor: Date;
  /** Перейти к конкретной дате — календарь и тап по соседнему дню */
  setAnchor: (date: Date) => void;
  /** Диапазон, выбранный календарём; пока задан, сегменты периода не действуют */
  range: DateRange | null;
  setRange: (range: DateRange | null) => void;
  /** Листание периодов: −1 назад, +1 вперёд */
  shiftPeriod: (step: number) => void;
  /** Вперёд нельзя уйти дальше периода, в котором мы живём */
  canGoForward: boolean;
  summary: PeriodSummary;
  /** Последние события с дашборда */
  events: FinancialEvent[];
  accounts: Account[];
  totalBalance: number;
  lastSyncedAt: string | null;
  needsAttention: FinancialEvent[];
  outstandingDebt: number;
  cashPolicy: string;
  isLoading: boolean;
  isSyncing: boolean;
  isEmpty: boolean;
  error: unknown;
  resolve: (eventId: string, optionId: string) => void;
  /** Свободный ответ пользователя: сопоставляем с доступными вариантами */
  resolveCustom: (eventId: string, text: string) => void;
  /** Списочное событие + вопрос и варианты из /attention, если они там есть */
  withAttention: (event: FinancialEvent) => FinancialEvent;
  refresh: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

/** Всё финансовое в приложении приходит из бэкенда через эти запросы */
export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [period, setPeriodState] = useState<PeriodKey>("month");
  const today = useMemo(() => new Date(), []);
  const [anchor, setAnchorState] = useState<Date>(() => startOfDay(new Date()));
  const [range, setRangeState] = useState<DateRange | null>(null);
  /** Период уже выбран осознанно — импортом или самим пользователем. Больше его не трогаем */
  const anchorChosen = useRef(false);

  const setAnchor = useCallback((date: Date) => {
    anchorChosen.current = true;
    setRangeState(null);
    setAnchorState(startOfDay(date));
  }, []);

  const setRange = useCallback((next: DateRange | null) => {
    anchorChosen.current = true;
    setRangeState(next);
  }, []);

  // Календарь и сегменты — взаимоисключающие способы задать период.
  // Смена шкалы не выбирает дату, поэтому якорь тут не закрепляем.
  const setPeriod = useCallback((next: PeriodKey) => {
    setRangeState(null);
    setPeriodState(next);
  }, []);

  const shiftPeriod = useCallback(
    (step: number) => {
      anchorChosen.current = true;
      setRangeState((current) => {
        if (!current) return current;
        const span = Math.round((current.to.getTime() - current.from.getTime()) / 86_400_000) + 1;
        return { from: addDays(current.from, step * span), to: addDays(current.to, step * span) };
      });
      setAnchorState((current) => (range ? current : shiftDate(period, current, step)));
    },
    [period, range]
  );

  /**
   * Выписку почти всегда загружают за прошедший период. Пока якорь стоит на
   * сегодняшнем дне, такой импорт не виден: и месяц, и год отдают нули.
   * Поэтому при первом заходе открываем период последней операции —
   * но только если в текущем месяце данных нет и период ещё никто не выбирал.
   */
  const latestOperation = useQuery({
    queryKey: ["finance", "latest-operation"],
    queryFn: api.getLatestTransactionDate,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (anchorChosen.current || !latestOperation.data) return;
    const latest = startOfDay(new Date(latestOperation.data));
    if (Number.isNaN(latest.getTime()) || latest >= startOfMonth(today)) return;
    anchorChosen.current = true;
    setAnchorState(latest);
  }, [latestOperation.data, today]);

  const canGoForward = useMemo(() => {
    if (range) return range.to < startOfDay(today);
    return periodRange(period, anchor).to < startOfDay(today);
  }, [anchor, period, range, today]);

  const dashboard = useQuery({
    queryKey: range
      ? ["finance", "dashboard", "range", range.from.toDateString(), range.to.toDateString()]
      : ["finance", "dashboard", period, anchor.toDateString()],
    queryFn: () =>
      range ? api.getDashboardRange(range.from, range.to) : api.getDashboard(period, anchor),
    staleTime: 30_000,
  });

  const attention = useQuery({
    queryKey: ["finance", "attention"],
    queryFn: api.getAttention,
    staleTime: 30_000,
  });

  const digest = useQuery({
    queryKey: ["finance", "digest"],
    queryFn: () => api.getDigest(today),
    staleTime: 60_000,
  });

  const resolveMutation = useMutation({
    mutationFn: (payload: { eventId: string; action: ResolveAction; relatedEventId: string | null }) =>
      api.resolveEvent(payload.eventId, {
        action: payload.action,
        related_event_id: payload.relatedEventId,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: () => {
      toast.error("Не удалось сохранить решение");
    },
  });

  const needsAttention = useMemo(
    () => (attention.data?.items ?? []).map(mapAttentionItem),
    [attention.data]
  );

  /**
   * В /events и /dashboard вопрос и варианты не приходят — они живут только
   * в /attention. Без этого карточка события превращалась в тупик:
   * «требует внимания», а решить нечем.
   */
  const withAttention = useCallback(
    (event: FinancialEvent): FinancialEvent => {
      if (event.status !== "needs_attention" || event.options?.length) return event;

      const item = needsAttention.find((candidate) => candidate.id === event.id);
      if (!item) return event;

      return { ...event, question: item.question, subtitle: item.subtitle, options: item.options };
    },
    [needsAttention]
  );

  const resolve = useCallback(
    (eventId: string, id: string) => {
      const event = needsAttention.find((item) => item.id === eventId);
      const option = event?.options?.find((item) => item.id === id);
      if (!option) return;

      // «Позже» — это отказ отвечать, запрос не нужен
      if (option.action === "later") return;

      resolveMutation.mutate({
        eventId,
        action: option.action as ResolveAction,
        relatedEventId: option.relatedEventId,
      });
    },
    [needsAttention, resolveMutation]
  );

  /**
   * У бэкенда нет разбора произвольного текста, поэтому свой вариант
   * сопоставляем с предложенными действиями по ключевым словам.
   * Если уверенного совпадения нет — честно просим выбрать вариант.
   */
  const resolveCustom = useCallback(
    (eventId: string, text: string) => {
      const event = needsAttention.find((item) => item.id === eventId);
      if (!event?.options?.length) return;

      const query = text.trim().toLowerCase();
      const KEYWORDS: Record<string, string[]> = {
        income: ["доход", "зарплат", "премия", "кэшбэк", "подарок"],
        expense: ["трата", "расход", "покупка", "потратил"],
        own_transfer: ["себе", "свой счет", "свой счёт", "перевод себе", "между счет"],
        debt_given: ["в долг", "занял", "одолжил"],
        debt_repayment: ["вернул долг", "отдал долг", "долг"],
        shared_expense_repayment: ["скинул", "общий", "за ужин", "за обед", "доля", "компенс"],
        refund: ["возврат", "вернули товар", "отмена"],
      };

      const byLabel = event.options.find(
        (option) => query.length > 2 && option.label.toLowerCase().includes(query)
      );

      const byKeyword = event.options.find((option) =>
        (KEYWORDS[option.action] ?? []).some((word) => query.includes(word))
      );

      const match = byLabel ?? byKeyword;

      if (!match) {
        toast.error("Не понял ответ — выберите вариант выше");
        return;
      }

      toast.success(`Записали как «${match.label}»`);
      resolve(eventId, match.id);
    },
    [needsAttention, resolve]
  );

  const summary = useMemo(
    () =>
      dashboard.data
        ? mapSummary(
            period,
            anchor,
            dashboard.data.summary,
            dashboard.data.comparison,
            range ?? undefined,
            dashboard.data.recent_events
          )
        : emptySummary(period, anchor),
    [anchor, dashboard.data, period, range]
  );

  const value = useMemo<FinanceContextValue>(() => {
    const accounts = (dashboard.data?.accounts ?? []).map(mapAccount);

    return {
      today,
      period,
      setPeriod,
      anchor,
      setAnchor,
      range,
      setRange,
      shiftPeriod,
      canGoForward,
      summary,
      events: (dashboard.data?.recent_events ?? []).map(mapEvent),
      accounts,
      totalBalance: (dashboard.data?.total_balance_minor ?? 0) / 100,
      lastSyncedAt: dashboard.dataUpdatedAt
        ? new Date(dashboard.dataUpdatedAt).toISOString()
        : new Date().toISOString(),
      needsAttention,
      outstandingDebt: (digest.data?.outstanding_debt_minor ?? 0) / 100,
      cashPolicy: dashboard.data?.cash_policy ?? "expense_on_withdrawal",
      isLoading: dashboard.isLoading,
      isSyncing: dashboard.isFetching || resolveMutation.isPending,
      isEmpty: Boolean(dashboard.data) && accounts.length === 0,
      error: dashboard.error,
      resolve,
      resolveCustom,
      withAttention,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
    };
  }, [
    anchor,
    setAnchor,
    canGoForward,
    range,
    setRange,
    setPeriod,
    shiftPeriod,
    dashboard.data,
    dashboard.dataUpdatedAt,
    dashboard.isLoading,
    dashboard.isFetching,
    dashboard.error,
    digest.data,
    needsAttention,
    period,
    resolve,
    resolveCustom,
    withAttention,
    resolveMutation.isPending,
    summary,
    today,
    queryClient,
  ]);

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = (): FinanceContextValue => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance должен использоваться внутри <FinanceProvider>");
  }
  return context;
};
