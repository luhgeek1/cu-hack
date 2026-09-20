import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import * as api from "../api/client";
import type { ResolveAction } from "../api/dto";
import { emptySummary, mapAccount, mapAttentionItem, mapEvent, mapSummary } from "./mappers";
import type { Account, FinancialEvent, PeriodKey, PeriodSummary } from "./types";

type FinanceContextValue = {
  today: Date;
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
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
  refresh: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

/** Всё финансовое в приложении приходит из бэкенда через эти запросы */
export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<PeriodKey>("month");
  const today = useMemo(() => new Date(), []);

  const dashboard = useQuery({
    queryKey: ["finance", "dashboard", period],
    queryFn: () => api.getDashboard(period, today),
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
        ? mapSummary(period, today, dashboard.data.summary, dashboard.data.comparison)
        : emptySummary(period, today),
    [dashboard.data, period, today]
  );

  const value = useMemo<FinanceContextValue>(() => {
    const accounts = (dashboard.data?.accounts ?? []).map(mapAccount);

    return {
      today,
      period,
      setPeriod,
      summary,
      events: (dashboard.data?.recent_events ?? []).map(mapEvent),
      accounts,
      totalBalance: (dashboard.data?.total_balance_minor ?? 0) / 100,
      lastSyncedAt: dashboard.data?.last_synced_at ?? null,
      needsAttention,
      outstandingDebt: (digest.data?.outstanding_debt_minor ?? 0) / 100,
      cashPolicy: dashboard.data?.cash_policy ?? "expense_on_withdrawal",
      isLoading: dashboard.isLoading,
      isSyncing: dashboard.isFetching || resolveMutation.isPending,
      isEmpty: Boolean(dashboard.data) && accounts.length === 0,
      error: dashboard.error,
      resolve,
      resolveCustom,
      refresh: () => queryClient.invalidateQueries({ queryKey: ["finance"] }),
    };
  }, [
    dashboard.data,
    dashboard.isLoading,
    dashboard.isFetching,
    dashboard.error,
    digest.data,
    needsAttention,
    period,
    resolve,
    resolveCustom,
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
