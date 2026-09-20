import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

import { useFinance, type FinancialEvent, type PeriodKey } from "@/entities/finance";
import { AttentionCard } from "@/features/attention/ui/AttentionCard";
import { EventList } from "@/features/events/ui/EventList";
import { EventSheet } from "@/features/events/ui/EventSheet";
import { ExplainSheet } from "@/features/reconcile/ui/ExplainSheet";
import { ReconcileStrip } from "@/features/reconcile/ui/ReconcileStrip";
import { SpendDonut } from "@/features/reconcile/ui/SpendDonut";
import { TotalBalanceCard } from "@/features/finance/ui/TotalBalanceCard";
import { RealSpendingCard } from "@/features/finance/ui/RealSpendingCard";
import { PalataLogo } from "@/shared/ui/PalataLogo";
import { money, time } from "@/shared/lib/format";
import { Segmented } from "@/shared/ui/Segmented";
import { cn } from "@/shared/lib/utils";

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
];

export default function HomePage() {
  const {
    summary,
    events,
    accounts,
    period,
    setPeriod,
    today,
    isSyncing,
    totalBalance,
    outstandingDebt,
    lastSyncedAt,
  } = useFinance();
  const [explainOpen, setExplainOpen] = useState(false);
  const [selected, setSelected] = useState<FinancialEvent | null>(null);

  const recent = useMemo(() => events.slice(0, 6), [events]);


  const perDay = Math.round(summary.realExpense / (period === "month" ? today.getDate() : 1));

  return (
    <>
      <header className="flex items-center justify-between px-5 md:px-0 pb-4 pt-5 safe-top">
        <div className="flex items-center gap-2">
          <PalataLogo variant="badge" size="sm" />
        </div>
        <span className="flex items-center gap-1.5 text-[12px] text-fg-faint">
          <span
            className={cn(
              "size-1.5 rounded-full",
              isSyncing ? "animate-pulse bg-brass" : "bg-sage-strong"
            )}
          />
          {isSyncing ? "синхронизация" : lastSyncedAt ? `обновлено в ${time(lastSyncedAt)}` : "нет данных"}
        </span>
      </header>

      {/* Responsive Grid: 1 col on mobile, 2 cols (7/5) on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 px-5 md:px-0">
        {/* Main Column (left on desktop) */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          <div className="flex flex-col gap-2.5">
            <Segmented layoutId="home-period" value={period} onChange={setPeriod} options={PERIODS} />
          </div>

          {/* Две карточки со скриншота: 1 колонка на мобильном, 2 колонки на десктопе */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <TotalBalanceCard accounts={accounts} totalBalance={totalBalance} />
            <RealSpendingCard
              bankOutflow={summary.bankSpent}
              realExpense={summary.realExpense}
              excluded={summary.excluded}
              excludedBreakdown={summary.excludedBreakdown}
            />
          </div>

          {/* Три плитки показателей */}
          <div className="grid grid-cols-3 gap-2.5">
            <Tile label="Доход" value={money(summary.realIncome)} tone="sage" />
            <Tile label={period === "month" ? "В день" : "Средний чек"} value={money(perDay)} />
            <Tile label="Вам должны" value={money(outstandingDebt)} tone={outstandingDebt > 0 ? "brass" : "muted"} />
          </div>

          <ReconcileStrip summary={summary} onExplain={() => setExplainOpen(true)} />
          <SpendDonut summary={summary} />
        </div>

        {/* Side Panel (right on desktop, bottom on mobile) */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Actionable attention card placed right at top of side panel */}
          <AttentionCard />

          {/* Последние события feed */}
          <section className="rounded-3xl border border-line bg-surface/60 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between px-1">
              <h2 className="text-[15px] font-bold">Последние события</h2>
              <Link
                to="/events"
                className="flex items-center gap-0.5 text-[12.5px] font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Все события
                <ChevronRight className="size-3.5" />
              </Link>
            </div>
            <EventList events={recent} onSelect={setSelected} />
          </section>
        </div>
      </div>

      <ExplainSheet open={explainOpen} onClose={() => setExplainOpen(false)} summary={summary} />
      <EventSheet event={selected} onClose={() => setSelected(null)} />
    </>
  );
}

const Tile = ({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "sage" | "brass" | "muted";
}) => (
  <div className="rounded-2xl border border-line bg-surface p-3 shadow-xs">
    <p className="text-[11.5px] text-fg-faint font-medium">{label}</p>
    <p
      className={
        "tnum mt-1 text-[15px] font-bold tracking-tight " +
        (tone === "sage"
          ? "text-sage-strong"
          : tone === "brass"
            ? "text-brass"
            : tone === "muted"
              ? "text-fg-faint"
              : "text-fg")
      }
    >
      {value}
    </p>
  </div>
);
