import React, { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { TrendingUp, BarChart3, PieChart as PieIcon } from "lucide-react";

import { compactMoney, money, percent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

interface SeriesPoint {
  from: Date;
  to: Date;
  label: string;
  value: number;
  caption?: string;
  inRange?: boolean;
}

interface SpendAnalyticsChartProps {
  series: SeriesPoint[];
  today: Date;
  average: number;
  period: string;
}

const CATEGORY_COLORS = [
  "#10b981", // emerald
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#84cc16", // lime
];

/**
 * Custom glassmorphism tooltip for Recharts
 */
const CustomTooltip = ({ active, payload, average }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const val = Number(data.value || 0);
  const diffFromAvg = average > 0 ? val - average : 0;
  const percentDiff = average > 0 ? Math.round((diffFromAvg / average) * 100) : 0;

  return (
    <div className="rounded-2xl border border-line-strong bg-[#14171a]/95 p-3 shadow-2xl backdrop-blur-xl min-w-[140px]">
      <p className="text-[11px] font-semibold text-fg-muted uppercase tracking-wider">
        {data.dateLabel || data.name}
      </p>
      <p className="tnum mt-1 text-[18px] font-black text-fg">
        {money(val)}
      </p>
      {average > 0 && val > 0 && (
        <p
          className={cn(
            "mt-1 text-[11px] font-medium",
            diffFromAvg > 0 ? "text-amber-400" : "text-emerald-400"
          )}
        >
          {diffFromAvg > 0 ? `+${percentDiff}% к среднему` : `${percentDiff}% ниже среднего`}
        </p>
      )}
      {data.isFuture && (
        <span className="mt-1 inline-block text-[10px] text-fg-faint bg-raised px-2 py-0.5 rounded-full">
          будущая дата
        </span>
      )}
    </div>
  );
};

export const SpendAnalyticsChart: React.FC<SpendAnalyticsChartProps> = ({
  series,
  today,
  average,
  period,
}) => {
  const [chartType, setChartType] = useState<"area" | "bar">("area");

  // Transform data for Recharts
  const chartData = series.map((pt) => {
    const isCurrent = today >= pt.from && today < pt.to;
    const isFuture = pt.from > today;
    const dateFormatted = pt.from.toLocaleDateString("ru-RU", {
      day: "numeric",
      month: period === "year" ? "short" : undefined,
    });

    return {
      name: pt.label,
      dateLabel: `${pt.label}${pt.caption ? ` (${pt.caption})` : ""}`,
      value: pt.value,
      isCurrent,
      isFuture,
    };
  });

  const peak = Math.max(...series.map((s) => s.value), 0);
  const zeroDays = series.filter((s) => s.value === 0 && s.from <= today).length;

  return (
    <div className="rounded-3xl border border-line bg-surface/90 p-4 md:p-6 shadow-xl relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Chart Header & Controls */}
      <div className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            График динамики трат
          </span>
          {average > 0 && (
            <p className="text-[12px] text-fg-faint mt-0.5">
              В среднем: <strong className="text-fg font-semibold">{compactMoney(average)}</strong> в день
            </p>
          )}
        </div>

        {/* View Switcher: Smooth Area vs Bars */}
        <div className="flex items-center bg-raised rounded-2xl p-1 border border-line">
          <button
            type="button"
            onClick={() => setChartType("area")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95",
              chartType === "area"
                ? "bg-surface text-emerald-400 shadow-sm border border-emerald-500/30"
                : "text-fg-muted hover:text-fg"
            )}
          >
            <TrendingUp className="size-3.5" />
            <span className="hidden sm:inline">Тренд</span>
          </button>
          <button
            type="button"
            onClick={() => setChartType("bar")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all active:scale-95",
              chartType === "bar"
                ? "bg-surface text-emerald-400 shadow-sm border border-emerald-500/30"
                : "text-fg-muted hover:text-fg"
            )}
          >
            <BarChart3 className="size-3.5" />
            <span className="hidden sm:inline">Столбцы</span>
          </button>
        </div>
      </div>

      {/* Main Recharts Container */}
      <div className="h-[210px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "area" ? (
            <AreaChart data={chartData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
              <defs>
                <linearGradient id="spendAreaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.45} />
                  <stop offset="60%" stopColor="#10b981" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <XAxis
                dataKey="name"
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={series.length > 15 ? 4 : 0}
              />
              <YAxis
                stroke="#52525b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val === 0 ? "0" : compactMoney(val))}
              />

              <Tooltip content={<CustomTooltip average={average} />} />

              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="#eab308"
                  strokeDasharray="3 3"
                  strokeOpacity={0.7}
                />
              )}

              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={2.5}
                fill="url(#spendAreaGradient)"
                activeDot={{
                  r: 6,
                  fill: "#10b981",
                  stroke: "#ffffff",
                  strokeWidth: 2,
                  className: "shadow-lg shadow-emerald-500/50",
                }}
              />
            </AreaChart>
          ) : (
            <BarChart data={chartData} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
              <XAxis
                dataKey="name"
                stroke="#52525b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                interval={series.length > 15 ? 4 : 0}
              />
              <YAxis
                stroke="#52525b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => (val === 0 ? "0" : compactMoney(val))}
              />

              <Tooltip content={<CustomTooltip average={average} />} cursor={false} />

              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="#eab308"
                  strokeDasharray="3 3"
                  strokeOpacity={0.7}
                />
              )}

              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      entry.isCurrent
                        ? "#10b981"
                        : entry.isFuture
                        ? "rgba(82, 82, 91, 0.25)"
                        : entry.value > average
                        ? "#059669"
                        : "rgba(113, 113, 122, 0.55)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Highlights Bar underneath the chart */}
      <div className="mt-4 pt-3.5 border-t border-line/80 grid grid-cols-3 gap-2 text-center relative z-10">
        <div className="bg-raised/60 border border-line rounded-2xl p-2.5">
          <span className="text-[10.5px] font-semibold text-fg-faint uppercase block">
            Пик периода
          </span>
          <span className="tnum text-[14px] font-bold text-fg mt-0.5 block">
            {compactMoney(peak)}
          </span>
        </div>

        <div className="bg-raised/60 border border-line rounded-2xl p-2.5">
          <span className="text-[10.5px] font-semibold text-fg-faint uppercase block">
            Средний чек/день
          </span>
          <span className="tnum text-[14px] font-bold text-emerald-400 mt-0.5 block">
            {compactMoney(average)}
          </span>
        </div>

        <div className="bg-raised/60 border border-line rounded-2xl p-2.5">
          <span className="text-[10.5px] font-semibold text-fg-faint uppercase block">
            Дней без трат
          </span>
          <span className="tnum text-[14px] font-bold text-fg mt-0.5 block">
            {zeroDays}
          </span>
        </div>
      </div>
    </div>
  );
};

interface CategoryDonutChartProps {
  categories: { category: string; amount: number; share: number }[];
  totalExpense: number;
}

/**
 * Category breakdown Donut Pie Chart using Recharts
 */
export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({
  categories,
  totalExpense,
}) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!categories || categories.length === 0) return null;

  const data = categories.map((cat, idx) => ({
    name: cat.category,
    value: cat.amount,
    share: cat.share,
    color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
  }));

  const activeCategory = activeIndex !== null ? data[activeIndex] : null;

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      {/* Donut graphic with center total */}
      <div className="relative size-[170px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              innerRadius={54}
              outerRadius={78}
              paddingAngle={3}
              dataKey="value"
              onClick={(_, index) => setActiveIndex(activeIndex === index ? null : index)}
              onMouseEnter={(_, index) => setActiveIndex(index)}
            >
              {data.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="#0f1115"
                  strokeWidth={activeIndex === index ? 3 : 2}
                  opacity={activeIndex !== null && activeIndex !== index ? 0.35 : 1}
                  className="transition-all cursor-pointer"
                  onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Center label (pointer events none except inner button to reset) */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center p-2 text-center">
          <button
            type="button"
            onClick={() => setActiveIndex(null)}
            className="pointer-events-auto flex flex-col items-center justify-center rounded-full size-[100px] text-center transition-transform active:scale-95 cursor-pointer"
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-fg-muted truncate max-w-[84px]">
              {activeCategory ? activeCategory.name : "Всего"}
            </span>
            <span className="tnum text-[14px] font-black text-fg mt-0.5">
              {activeCategory ? compactMoney(activeCategory.value) : compactMoney(totalExpense)}
            </span>
            <span className="text-[10px] font-semibold text-emerald-400 mt-0.5">
              {activeCategory ? percent(activeCategory.share) : "расходы"}
            </span>
          </button>
        </div>
      </div>

      {/* Category List */}
      <div className="min-w-0 flex-1 space-y-2 w-full">
        {data.slice(0, 5).map((item, idx) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setActiveIndex(activeIndex === idx ? null : idx)}
            className={cn(
              "w-full flex items-center justify-between text-[12.5px] p-2 rounded-xl transition-all text-left cursor-pointer",
              activeIndex === idx
                ? "bg-raised border border-line-strong shadow-sm"
                : "hover:bg-raised/50 border border-transparent"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="size-2.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <span
                className={cn(
                  "truncate transition-colors",
                  activeIndex === idx ? "text-fg font-semibold" : "text-fg-muted"
                )}
              >
                {item.name}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="tnum font-bold text-fg">{compactMoney(item.value)}</span>
              <span className="text-[11px] text-fg-faint w-10 text-right">
                {percent(item.share)}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
