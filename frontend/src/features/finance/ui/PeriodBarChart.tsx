import { useMemo, useRef } from "react";
import { motion, type PanInfo } from "motion/react";
import { useQuery } from "@tanstack/react-query";

import { financeApi, MONTHS_SHORT, type PeriodKey, type PeriodSummary } from "@/entities/finance";
import { compactMoney } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type SeriesPoint = PeriodSummary["series"][number];

type PeriodBarChartProps = {
  series: SeriesPoint[];
  today: Date;
  /** Дата внутри выбранного периода — её столбец подсвечен */
  anchor: Date;
  period: PeriodKey;
  /** Свайп влево — следующий период, вправо — предыдущий */
  onShift?: (step: number) => void;
  canGoForward?: boolean;
  /** Тап по соседнему дню в дневном режиме */
  onPickDay?: (date: Date) => void;
};

/** Порядок «крупности» периода — задаёт направление зума при переключении */
const PERIOD_RANK: Record<PeriodKey, number> = { day: 0, week: 1, month: 2, year: 3 };

/** Чем крупнее период, тем тоньше столбцы: день — крупный план, год — общий */
const BAR_WIDTH: Record<PeriodKey, number> = { day: 54, week: 34, month: 10, year: 18 };

/** Зазор между столбцами, px — у месяца их за тридцать, там нужен волосок */
const BAR_GAP: Record<PeriodKey, number> = { day: 6, week: 6, month: 3, year: 6 };

const CHART_HEIGHT = 96;

/** Сколько соседних дней показываем вокруг выбранного дня — без них один столбец ничего не говорит */
const DAY_CONTEXT = 2;

/** Свайп короче этого порога считаем случайным */
const SWIPE_THRESHOLD = 60;

const DAYS_SHORT = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Верхняя и нижняя строки подписи столбца */
const captionsFor = (point: SeriesPoint, period: PeriodKey): [string, string | null] => {
  switch (period) {
    case "day":
      return [
        `${point.from.getDate()} ${MONTHS_SHORT[point.from.getMonth()]}`,
        DAYS_SHORT[point.from.getDay()],
      ];
    case "week":
      return [DAYS_SHORT[point.from.getDay()], String(point.from.getDate())];
    case "year":
      return [MONTHS_SHORT[point.from.getMonth()], null];
    case "month":
    default:
      return [String(point.from.getDate()), null];
  }
};

/**
 * Мобильный график: столбцы по корзинам периода с выделенным текущим днём.
 * На десктопе вместо него идёт интерактивная карточка на recharts.
 */
export const PeriodBarChart = ({
  series,
  today,
  anchor,
  period,
  onShift,
  canGoForward = true,
  onPickDay,
}: PeriodBarChartProps) => {
  const previousPeriod = useRef<PeriodKey>(period);

  // Бэкенд для дня отдаёт одну точку — соседние дни запрашиваем отдельным диапазоном
  const contextRange = useMemo(() => {
    const day = startOfDay(anchor);
    return { from: addDays(day, -DAY_CONTEXT), to: addDays(day, DAY_CONTEXT) };
  }, [anchor]);

  const dayContext = useQuery({
    queryKey: ["finance", "day-context", contextRange.from.toDateString()],
    queryFn: () => financeApi.getAnalyticsRange(contextRange.from, contextRange.to),
    enabled: period === "day",
    staleTime: 30_000,
  });

  const points = useMemo<SeriesPoint[]>(() => {
    if (period !== "day" || !dayContext.data) return series;

    return dayContext.data.summary.timeline.map((point) => {
      const from = new Date(`${point.date}T00:00:00`);
      return {
        label: String(from.getDate()),
        value: point.expense_minor / 100,
        from,
        to: addDays(from, 1),
        inRange: sameDay(from, anchor),
      };
    });
  }, [anchor, dayContext.data, period, series]);

  const peak = Math.max(...points.map((point) => point.value), 1);
  const compact = points.length > 8;

  // В дневном режиме подсвечен выбранный день, в остальных — сегодняшний, если он внутри периода
  const highlight = period === "day" ? startOfDay(anchor) : today;
  const currentIndex = points.findIndex((point) => highlight >= point.from && highlight < point.to);

  // Вниз по шкале (год → день) график наезжает, вверх — отъезжает
  const zoomFrom = PERIOD_RANK[period] < PERIOD_RANK[previousPeriod.current] ? 0.82 : 1.16;
  previousPeriod.current = period;

  // Среднее по уже прошедшим корзинам — чтобы видеть, выбился ли текущий период
  const past = points.filter((point) => point.from <= today);
  const average = past.length > 1 ? past.reduce((sum, point) => sum + point.value, 0) / past.length : 0;

  // У месяца тридцать столбцов — подписываем каждый пятый день и сам выбранный
  const labelVisible = (index: number) => {
    if (period !== "month") return true;
    const date = points[index].from.getDate();
    return index === currentIndex || date === 1 || date % 5 === 0;
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (!onShift) return;
    const shift = info.offset.x <= -SWIPE_THRESHOLD ? 1 : info.offset.x >= SWIPE_THRESHOLD ? -1 : 0;
    if (!shift) return;
    if (shift > 0 && !canGoForward) return;
    onShift(shift);
  };

  if (!points.length) return null;

  return (
    <motion.div
      drag={onShift ? "x" : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.12}
      dragMomentum={false}
      onDragEnd={onDragEnd}
      className="touch-pan-y"
    >
      <motion.div
        key={period}
        initial={{ opacity: 0, scale: zoomFrom }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.42, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: "bottom center" }}
      >
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
            {points.map((point, index) => {
              const current = index === currentIndex;
              const future = point.from > today;
              const pickable = Boolean(onPickDay) && period === "day" && !current && !future;
              return (
                <div
                  key={point.from.toDateString()}
                  onClick={pickable ? () => onPickDay?.(point.from) : undefined}
                  className={cn(
                    "flex h-full min-w-0 flex-1 flex-col items-center justify-end",
                    pickable && "cursor-pointer"
                  )}
                >
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
                          : future
                            ? "bg-line-strong/25"
                            : point.inRange
                              ? "bg-line-strong"
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
          {points.map((point, index) => {
            const [primary, secondary] = captionsFor(point, period);
            const current = index === currentIndex;
            return (
              <div key={point.from.toDateString()} className="min-w-0 flex-1 text-center">
                <span
                  className={cn(
                    "block whitespace-nowrap text-[10.5px] leading-tight",
                    current ? "font-semibold text-sage-strong" : "text-fg-faint"
                  )}
                >
                  {labelVisible(index) ? primary : ""}
                </span>
                {secondary ? (
                  <span
                    className={cn(
                      "block text-[9.5px] leading-tight",
                      current ? "text-sage-strong/80" : "text-fg-faint/60"
                    )}
                  >
                    {secondary}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
};
