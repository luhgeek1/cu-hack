import { useState } from "react";
import { motion } from "motion/react";

import { useFinance, type PeriodKey } from "@/entities/finance";
import { ActiveBankChip } from "@/features/accounts/ui/ActiveBankChip";
import { ExplainSheet } from "@/features/reconcile/ui/ExplainSheet";
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
  const peak = Math.max(...summary.series.map((point) => point.value), 1);
  const compact = summary.series.length > 8;
  const currentIndex = summary.series.findIndex(
    (point) => today >= point.from && today < point.to
  );

  return (
    <>
      <header className="px-5 pb-4 pt-5 safe-top">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[22px] font-bold -tracking-[0.02em]">Аналитика</h1>
          <ActiveBankChip />
        </div>
        <Segmented className="mt-4" layoutId="analytics-period" value={period} onChange={setPeriod} options={PERIODS} />
      </header>

      <section className="px-5">
        <p className="text-[13px] text-fg-muted">Траты · {summary.label}</p>
        <AnimatedMoney value={summary.realExpense} className="block text-[38px] font-bold leading-tight" />
        {summary.previousRealExpense > 0 ? (
          <p className={cn("mt-1 text-[13px]", delta > 0 ? "text-brass" : "text-sage-strong")}>
            {delta > 0 ? "+" : "−"}
            {percent(Math.abs(deltaShare))} к прошлому периоду
          </p>
        ) : null}
      </section>

      <section className="mt-6 px-5">
        <div className="flex h-[138px] items-end gap-1.5">
          {summary.series.map((point, index) => (
            <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              {compact ? null : (
                <span className="tnum text-[10px] text-fg-faint">
                  {point.value > 0 ? compactMoney(point.value) : ""}
                </span>
              )}
              <motion.div
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ duration: 0.5, delay: index * 0.03, ease: [0.16, 1, 0.3, 1] }}
                style={{ height: `${Math.max((point.value / peak) * 96, 3)}px` }}
                className={cn(
                  "w-full max-w-[44px] origin-bottom rounded-[5px]",
                  index === currentIndex ? "bg-sage" : "bg-line-strong"
                )}
              />
              <span className="text-[10.5px] text-fg-faint">{point.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7 px-5">
        <button
          type="button"
          onClick={() => setExplainOpen(true)}
          className="flex w-full items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3.5 text-left"
        >
          <span className="text-[13.5px] text-fg-muted">Банк списал</span>
          <span className="tnum text-[14px] text-fg-muted">{money(summary.bankSpent)}</span>
        </button>
      </section>

      <section className="mt-7">
        <h2 className="px-5 pb-3 text-[15px] font-semibold">Категории</h2>
        <ul className="space-y-3.5 px-5">
          {summary.categories.map((row) => (
            <li key={row.category}>
              <div className="flex items-baseline justify-between">
                <span className="text-[14px]">{row.category}</span>
                <span className="tnum text-[14px]">{money(row.amount)}</span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-raised">
                  <motion.div
                    style={{ width: `${row.share * 100}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="h-full origin-left rounded-full bg-sage/70"
                  />
                </div>
                <span className="tnum w-9 text-right text-[11.5px] text-fg-faint">{percent(row.share)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7 px-5">
        <h2 className="pb-3 text-[15px] font-semibold">Доходы</h2>
        <div className="flex items-baseline justify-between rounded-2xl border border-line bg-surface px-4 py-3.5">
          <span className="text-[13.5px] text-fg-muted">Реальный доход</span>
          <span className="tnum text-[16px] font-semibold text-sage-strong">{money(summary.realIncome)}</span>
        </div>
      </section>

      <ExplainSheet open={explainOpen} onClose={() => setExplainOpen(false)} summary={summary} />
    </>
  );
}
