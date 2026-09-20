import { useRef, useState } from "react";
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

/** Порядок «крупности» периода — задаёт направление зума при переключении */
const PERIOD_RANK: Record<PeriodKey, number> = { day: 0, week: 1, month: 2, year: 3 };

/** Чем крупнее период, тем тоньше столбцы: день — крупный план, год — общий */
const BAR_WIDTH: Record<PeriodKey, number> = { day: 54, week: 34, month: 10, year: 18 };

/** Зазор между столбцами, px — у месяца их за тридцать, там нужен волосок */
const BAR_GAP: Record<PeriodKey, number> = { day: 6, week: 6, month: 3, year: 6 };

const CHART_HEIGHT = 96;

export default function AnalyticsPage() {
  const { period, setPeriod, summary, today } = useFinance();
  const [explainOpen, setExplainOpen] = useState(false);
  const previousPeriod = useRef<PeriodKey>(period);

  const delta = summary.realExpense - summary.previousRealExpense;
  const deltaShare = summary.previousRealExpense > 0 ? delta / summary.previousRealExpense : 0;
  const peak = Math.max(...summary.series.map((point) => point.value), 1);
  const compact = summary.series.length > 8;
  const currentIndex = summary.series.findIndex(
    (point) => today >= point.from && today < point.to
  );

  // Вниз по шкале (год → день) график наезжает, вверх — отъезжает
  const zoomFrom = PERIOD_RANK[period] < PERIOD_RANK[previousPeriod.current] ? 0.82 : 1.16;
  previousPeriod.current = period;

  // У месяца тридцать столбцов — подписываем каждый пятый день и сам сегодняшний
  const labelVisible = (index: number) => {
    if (period !== "month") return true;
    const date = summary.series[index].from.getDate();
    return index === currentIndex || date === 1 || date % 5 === 0;
  };

  // Среднее по уже прошедшим корзинам — чтобы видеть, выбился ли текущий период
  const past = summary.series.filter((point) => point.from <= today);
  const average = past.length > 1 ? past.reduce((sum, point) => sum + point.value, 0) / past.length : 0;

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
        <motion.div
          key={period}
          initial={{ opacity: 0, scale: zoomFrom }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: "bottom center" }}
        >
          <div>
            <div className="relative">
              {average > 0 ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                  className="pointer-events-none absolute inset-x-0 z-10 flex items-center gap-2"
                  style={{ bottom: `${(average / peak) * CHART_HEIGHT}px` }}
                >
                  <div className="h-px flex-1 border-t border-dashed border-line-strong" />
                  <span className="text-[9.5px] text-fg-faint">в среднем {compactMoney(average)}</span>
                </motion.div>
              ) : null}

                <div
                  className="flex items-end"
                  style={{ height: `${CHART_HEIGHT + 18}px`, gap: `${BAR_GAP[period]}px` }}
                >
                {summary.series.map((point, index) => {
                  const current = index === currentIndex;
                  const future = point.from > today;
                  return (
                    <div key={point.label} className="flex h-full flex-1 flex-col items-center justify-end">
                      {compact ? null : (
                        <span
                          className={cn(
                            "tnum w-full text-center text-[10px] leading-[18px]",
                            current ? "font-semibold text-fg" : "text-fg-faint"
                          )}
                        >
                          {point.value > 0 ? compactMoney(point.value) : ""}
                        </span>
                      )}
                      <div className="flex w-full justify-center">
                        <motion.div
                          initial={{ scaleY: 0 }}
                          animate={{ scaleY: 1 }}
                          transition={{
                            duration: 0.5,
                            delay: Math.min(index * 0.04, 0.4),
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          style={{
                            height: `${Math.max((point.value / peak) * CHART_HEIGHT, 3)}px`,
                            maxWidth: `${BAR_WIDTH[period]}px`,
                          }}
                          className={cn(
                            "w-full origin-bottom",
                          period === "month" ? "rounded-[3px]" : "rounded-[5px]",
                            current
                              ? "bg-sage"
                              : point.inRange
                                ? "bg-line-strong"
                                : future
                                  ? "bg-line-strong/25"
                                  : "bg-line-strong/50"
                          )}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-2 flex" style={{ gap: `${BAR_GAP[period]}px` }}>
              {summary.series.map((point, index) => (
                <div key={point.label} className="min-w-0 flex-1 text-center">
                  <span
                    className={cn(
                      "block whitespace-nowrap text-[10.5px] leading-tight",
                      index === currentIndex ? "font-semibold text-sage-strong" : "text-fg-faint"
                    )}
                  >
                    {labelVisible(index) ? point.label : ""}
                  </span>
                  {point.caption ? (
                    <span
                      className={cn(
                        "block text-[9.5px] leading-tight",
                        index === currentIndex ? "text-sage-strong/80" : "text-fg-faint/60"
                      )}
                    >
                      {point.caption}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
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
