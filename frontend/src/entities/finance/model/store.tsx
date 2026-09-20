import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { summarize, type BankFilter } from "./analytics";
import { touchesBank } from "./analytics";
import { accounts as initialAccounts, demoToday, initialEvents } from "./dataset";
import type { Account, FinancialEvent, PeriodKey, PeriodSummary } from "./types";

type FinanceContextValue = {
  today: Date;
  events: FinancialEvent[];
  accounts: Account[];
  connectedBanks: string[];
  period: PeriodKey;
  setPeriod: (period: PeriodKey) => void;
  bank: BankFilter;
  setBank: (bank: BankFilter) => void;
  isSyncing: boolean;
  visibleEvents: FinancialEvent[];
  summary: PeriodSummary;
  needsAttention: FinancialEvent[];
  /** Последнее изменение реальных трат — для подсветки пересчёта */
  lastDelta: { eventId: string; amount: number } | null;
  resolve: (eventId: string, optionId: string) => void;
  /** Ответ своими словами — когда ни один быстрый вариант не подошёл */
  resolveCustom: (eventId: string, label: string) => void;
  /** Считать ли снятие наличных тратой — настройка из профиля */
  cashAsExpense: boolean;
  setCashAsExpense: (value: boolean) => void;
  connectBank: (bank: string) => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export const FinanceProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<FinancialEvent[]>(initialEvents);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [connectedBanks, setConnectedBanks] = useState<string[]>(["tbank", "sber", "alfa", "ozon"]);
  const [bank, setBank] = useState<BankFilter>("all");
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [isSyncing, setSyncing] = useState(false);
  const [lastDelta, setLastDelta] = useState<{ eventId: string; amount: number } | null>(null);

  const resolve = useCallback((eventId: string, optionId: string) => {
    setEvents((current) =>
      current.map((event) => {
        if (event.id !== eventId) return event;
        const option = event.options?.find((item) => item.id === optionId);
        if (!option) return event;

        setLastDelta({
          eventId,
          amount: option.effectiveExpense - event.effectiveExpense,
        });

        return {
          ...event,
          type: option.type,
          status: "confirmed",
          confidence: 1,
          effectiveExpense: option.effectiveExpense,
          effectiveIncome: option.effectiveIncome,
          reason: option.hint,
          subtitle: option.label,
        };
      })
    );
  }, []);

  const resolveCustom = useCallback((eventId: string, label: string) => {
    const answer = label.trim();
    if (!answer) return;

    setEvents((current) =>
      current.map((event) => {
        if (event.id !== eventId) return event;

        setLastDelta({ eventId, amount: 0 });

        return {
          ...event,
          status: "confirmed",
          confidence: 1,
          reason: "Ваш вариант",
          subtitle: answer,
        };
      })
    );
  }, []);

  const setCashAsExpense = useCallback((value: boolean) => {
    setEvents((current) =>
      current.map((event) => {
        if (event.policyKey !== "cash") return event;
        const gross = event.amount;
        return {
          ...event,
          type: value ? "CASH_WITHDRAWAL" : "OWN_TRANSFER",
          category: value ? "Наличные" : undefined,
          status: "confirmed",
          confidence: 1,
          effectiveExpense: value ? gross : 0,
          effectiveIncome: 0,
          reason: value ? "Считаем тратой — так вы настроили" : "Деньги остаются вашими",
          subtitle: value ? "Считаем тратой" : "Лежат в кошельке",
        };
      })
    );
  }, []);

  const connectBank = useCallback((bank: string) => {
    setConnectedBanks((current) => (current.includes(bank) ? current : [...current, bank]));
  }, []);

  /** Выписки подтягиваются сами: при входе и дальше в фоне */
  useEffect(() => {
    let timeout = 0;

    const run = () => {
      setSyncing(true);
      timeout = window.setTimeout(() => {
        const now = new Date().toISOString();
        setAccounts((current) => current.map((account) => ({ ...account, lastSyncAt: now })));
        setSyncing(false);
      }, 1600);
    };

    const start = window.setTimeout(run, 600);
    const interval = window.setInterval(run, 120_000);

    return () => {
      window.clearTimeout(start);
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  const summary = useMemo(() => summarize(events, period, demoToday, bank), [events, period, bank]);

  const visibleEvents = useMemo(
    () => (bank === "all" ? events : events.filter((event) => touchesBank(event, bank))),
    [events, bank]
  );

  const cashAsExpense = useMemo(
    () => (events.find((event) => event.policyKey === "cash")?.effectiveExpense ?? 0) > 0,
    [events]
  );

  const needsAttention = useMemo(
    () => events.filter((event) => event.status === "needs_attention"),
    [events]
  );

  const value = useMemo<FinanceContextValue>(
    () => ({
      today: demoToday,
      events,
      accounts,
      connectedBanks,
      period,
      setPeriod,
      bank,
      setBank,
      isSyncing,
      visibleEvents,
      summary,
      needsAttention,
      lastDelta,
      resolve,
      resolveCustom,
      cashAsExpense,
      setCashAsExpense,
      connectBank,
    }),
    [
      events,
      connectedBanks,
      period,
      accounts,
      bank,
      isSyncing,
      visibleEvents,
      summary,
      needsAttention,
      lastDelta,
      resolve,
      resolveCustom,
      cashAsExpense,
      setCashAsExpense,
      connectBank,
    ]
  );

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
};

export const useFinance = (): FinanceContextValue => {
  const context = useContext(FinanceContext);
  if (!context) {
    throw new Error("useFinance должен использоваться внутри <FinanceProvider>");
  }
  return context;
};
