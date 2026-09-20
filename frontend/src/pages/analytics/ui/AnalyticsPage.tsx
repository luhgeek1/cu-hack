import { useState } from "react";
import { motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { useFinance, type PeriodKey } from "@/entities/finance";
import { ExplainSheet } from "@/features/reconcile/ui/ExplainSheet";
import {
  SpendAnalyticsChart,
  CategoryDonutChart,
} from "@/features/finance/ui/SpendAnalyticsChart";
import { PeriodBarChart } from "@/features/finance/ui/PeriodBarChart";
import { PeriodPickerSheet } from "@/features/finance/ui/PeriodPickerSheet";
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
  const { period, setPeriod, summary, today, anchor, setAnchor, range, setRange, shiftPeriod, canGoForward } =
    useFinance();
  const [explainOpen, setExplainOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

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
        </div>
        <Segmented className="mt-4" layoutId="analytics-period" value={period} onChange={setPeriod} options={PERIODS} />

        {/* Листание периодов и выбор произвольного диапазона */}
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftPeriod(-1)}
            aria-label="Предыдущий период"
            className="rounded-full border border-line p-2 text-fg-muted transition-colors hover:text-fg"
          >
            <ChevronLeft className="size-4" />
          </button>

          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="flex min-w-0 flex-1 items-center justify-center gap-2 rounded-full border border-line px-3 py-2 text-[13px] text-fg-muted transition-colors hover:text-fg"
          >
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate capitalize">{summary.label}</span>
          </button>

          <button
            type="button"
            onClick={() => shiftPeriod(1)}
            disabled={!canGoForward}
            aria-label="Следующий период"
            className="rounded-full border border-line p-2 text-fg-muted transition-colors hover:text-fg disabled:opacity-30 disabled:hover:text-fg-muted"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
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

      {/* Мобильный график — столбцы по дням, десктопный — интерактивная карточка на recharts */}
      <section className="mt-6 px-5 md:px-0">
        <div className="md:hidden">
          <PeriodBarChart
            series={summary.series}
            today={today}
            anchor={anchor}
            period={period}
            onShift={shiftPeriod}
            canGoForward={canGoForward}
            onPickDay={setAnchor}
          />
        </div>
        <div className="hidden md:block">
          <SpendAnalyticsChart
            series={summary.series}
            today={today}
            average={average}
            period={period}
          />
        </div>
      </section>

      {/* Desktop 2-column grid for Categories & Income/Bank breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-7 px-5 md:px-0">
        {/* На мобилке — список с долями, на десктопе — пончик */}
        <section className="md:hidden">
          <h2 className="pb-3 text-[15px] font-semibold">Категории</h2>
          <ul className="space-y-3.5">
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

        <section className="hidden rounded-3xl border border-line bg-surface/80 p-5 shadow-sm md:block md:p-6">
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

      <PeriodPickerSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        today={today}
        value={range}
        onApply={(next) => {
          if (next.from.getTime() === next.to.getTime()) {
            setPeriod("day");
            setAnchor(next.from);
            return;
          }
          setRange(next);
        }}
        onReset={() => setRange(null)}
      />
    </>
  );
}
