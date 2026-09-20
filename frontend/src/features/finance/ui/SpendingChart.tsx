import React, { useState } from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  AreaChart,
  Area,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/shared/lib/formatters';
import { getCategoryMeta } from '@/shared/lib/financeLabels';

interface CategoryItem {
  category: string;
  expense_minor: number;
}

interface TimelineItem {
  date: string;
  expense_minor: number;
  income_minor?: number;
}

interface SpendingChartProps {
  categories?: CategoryItem[];
  timeline?: TimelineItem[];
  totalExpenseMinor: number;
}

export const SpendingChart: React.FC<SpendingChartProps> = ({
  categories = [],
  timeline = [],
  totalExpenseMinor,
}) => {
  const [activeTab, setActiveTab] = useState<'donut' | 'timeline'>('donut');

  // Filter out 0 expense categories
  const chartData = categories
    .filter((c) => c.expense_minor > 0)
    .map((c) => {
      const meta = getCategoryMeta(c.category);
      const percent = totalExpenseMinor > 0 ? (c.expense_minor / totalExpenseMinor) * 100 : 0;
      return {
        name: meta.label,
        categoryKey: c.category,
        value: c.expense_minor / 100, // in rubles for chart scaling
        minor: c.expense_minor,
        color: meta.color,
        percent: Math.round(percent),
      };
    })
    .sort((a, b) => b.minor - a.minor);

  // Timeline data in rubles
  const timelineData = (timeline || []).map((t) => ({
    date: new Date(t.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }),
    expense: (t.expense_minor || 0) / 100,
  }));

  const hasData = chartData.length > 0 || (timelineData.length > 0 && totalExpenseMinor > 0);

  return (
    <div className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-5 mb-6 shadow-lg">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Структура расходов</h3>
          <p className="text-xs text-zinc-400">Наглядная аналитика за период</p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center bg-zinc-800 p-0.5 rounded-xl text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('donut')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'donut'
                ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Категории
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1 rounded-lg font-medium transition-all ${
              activeTab === 'timeline'
                ? 'bg-emerald-500 text-black shadow-sm font-semibold'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Динамика
          </button>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-12 text-zinc-500 text-xs">
          Нет данных по расходам за выбранный период
        </div>
      ) : activeTab === 'donut' ? (
        <div>
          {/* Donut Chart with center summary */}
          <div className="relative h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={4}
                  dataKey="value"
                  animationDuration={800}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="#18181b" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-zinc-950/95 border border-zinc-700 px-3 py-2 rounded-xl shadow-xl text-xs backdrop-blur-md">
                          <p className="font-semibold text-white flex items-center gap-1.5">
                            <span
                              className="w-2 h-2 rounded-full inline-block"
                              style={{ backgroundColor: data.color }}
                            />
                            {data.name}
                          </p>
                          <p className="text-emerald-400 font-bold mt-1">
                            {formatMoney(data.minor)} ({data.percent}%)
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center label inside donut */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Всего</span>
              <span className="text-sm font-extrabold text-white">
                {formatMoney(totalExpenseMinor)}
              </span>
            </div>
          </div>

          {/* Top categories breakdown list */}
          <div className="mt-4 space-y-2.5">
            {chartData.map((item, idx) => (
              <div key={idx} className="flex flex-col">
                <div className="flex justify-between items-center text-xs mb-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-zinc-200 font-medium">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2 font-medium">
                    <span className="text-white">{formatMoney(item.minor)}</span>
                    <span className="text-zinc-500 text-[11px] w-8 text-right font-mono">
                      {item.percent}%
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-800/80 rounded-full h-1 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${item.percent}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Timeline Area Chart */
        <div className="h-64 w-full pt-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#52525b"
                fontSize={10}
                tickLine={false}
                axisLine={{ stroke: '#27272a' }}
              />
              <YAxis
                stroke="#52525b"
                fontSize={10}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `${Math.round(v)} ₽`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-zinc-950/95 border border-zinc-700 px-3 py-2 rounded-xl shadow-xl text-xs backdrop-blur-md">
                        <p className="text-zinc-400 text-[10px]">{label}</p>
                        <p className="text-emerald-400 font-bold mt-0.5">
                          {formatMoney(Math.round(Number(payload[0].value) * 100))}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="expense"
                stroke="#10b981"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#expenseGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
