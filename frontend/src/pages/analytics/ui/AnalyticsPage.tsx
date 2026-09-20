import { useState } from "react";

import { useFinance, type PeriodKey } from "@/entities/finance";
import { ActiveBankChip } from "@/features/accounts/ui/ActiveBankChip";
import { ExplainSheet } from "@/features/reconcile/ui/ExplainSheet";
import {
  SpendAnalyticsChart,
  CategoryDonutChart,
} from "@/features/finance/ui/SpendAnalyticsChart";
import { compactMoney, money, percent } from "@/shared/lib/format";
import { AnimatedMoney } from "@/shared/ui/AnimatedMoney";
import { Segmented } from "@/shared/ui/Segmented";
import { cn } from "@/shared/lib/utils";

const PERIODS: { value: PeriodKey; label: string }[] = [
  { value: "day", label: "День" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
];

export default function AnalyticsPage() {
  const { period, setPeriod, summary, today } = useFinance();
  const [explainOpen, setExplainOpen] = useState(false);

  const delta = summary.realExpense - summary.previousRealExpense;
  const deltaShare = summary.previousRealExpense > 0 ? delta / summary.previousRealExpense : 0;

  // Среднее по уже прошедшим корзинам
  const past = summary.series.filter((point) => point.from <= today);
  const average = past.length > 1 ? past.reduce((sum, point) => sum + point.value, 0) / past.length : 0;

  return (
    <>
      <header className="px-5 md:px-0 pb-4 pt-5 safe-top">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] md:text-[26px] font-bold -tracking-[0.02em]">Аналитика</h1>
          <ActiveBankChip />
        </div>
        <Segmented className="mt-4" layoutId="analytics-period" value={period} onChange={setPeriod} options={PERIODS} />
      </header>

      {/* Main Expense Header */}
      <section className="px-5 md:px-0">
        <p className="text-[13px] text-fg-muted font-medium">Траты · {summary.label}</p>
        <AnimatedMoney value={summary.realExpense} className="block text-[38px] font-black leading-tight tracking-tight mt-1" />
        {summary.previousRealExpense > 0 ? (
          <p className={cn("mt-1 text-[13px] font-semibold", delta > 0 ? "text-amber-400" : "text-emerald-400")}>
            {delta > 0 ? "+" : "−"}
            {percent(Math.abs(deltaShare))} к прошлому периоду
          </p>
        ) : null}
      </section>

      {/* Modern High-End Recharts Graphs */}
      <section className="mt-6 px-5 md:px-0">
        <SpendAnalyticsChart
          series={summary.series}
          today={today}
          average={average}
          period={period}
        />
      </section>

      {/* Desktop 2-column grid for Categories & Income/Bank breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-7 px-5 md:px-0">
        <section className="rounded-3xl border border-line bg-surface/80 p-5 md:p-6 shadow-sm">
          <h2 className="pb-4 text-[15px] font-bold">Распределение по категориям</h2>
          <CategoryDonutChart
            categories={summary.categories}
            totalExpense={summary.realExpense}
          />
        </section>

        <div className="space-y-4">
          <section className="rounded-3xl border border-line bg-surface/80 p-5 md:p-6 shadow-sm">
            <h2 className="pb-3 text-[15px] font-bold">Доходы</h2>
            <div className="flex items-baseline justify-between rounded-2xl border border-line bg-raised/80 px-4 py-3.5">
              <span className="text-[13.5px] text-fg-muted">Реальный доход</span>
              <span className="tnum text-[17px] font-black text-emerald-400">{money(summary.realIncome)}</span>
            </div>
          </section>

          <section className="rounded-3xl border border-line bg-surface/80 p-5 md:p-6 shadow-sm">
            <h2 className="pb-3 text-[15px] font-bold">Сверка с банком</h2>
            <button
              type="button"
              onClick={() => setExplainOpen(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-line bg-raised/80 px-4 py-3.5 text-left hover:border-emerald-500/40 transition-colors group"
            >
              <div>
                <span className="text-[13.5px] text-fg font-medium block">Банки насчитали</span>
                <span className="text-[11.5px] text-fg-faint">Без учета возвратов и переводов</span>
              </div>
              <span className="tnum text-[15px] text-fg-muted font-bold group-hover:text-fg">{money(summary.bankSpent)}</span>
            </button>
          </section>
        </div>
      </div>

      <ExplainSheet open={explainOpen} onClose={() => setExplainOpen(false)} summary={summary} />
    </>
  );
}
