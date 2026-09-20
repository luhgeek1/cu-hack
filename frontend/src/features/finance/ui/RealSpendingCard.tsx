import React, { useState } from 'react';
import { formatMoney } from '@/shared/lib/formatters';
import { getExclusionInfo } from '@/shared/lib/financeLabels';

interface BreakdownItem {
  type: string;
  amount_minor: number;
  event_ids?: string[];
}

interface RealSpendingCardProps {
  bankOutflowMinor: number;
  realExpenseMinor: number;
  excludedBreakdown?: BreakdownItem[];
  excludedMinor?: number;
}

export const RealSpendingCard: React.FC<RealSpendingCardProps> = ({
  bankOutflowMinor,
  realExpenseMinor,
  excludedBreakdown = [],
  excludedMinor,
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const diff = excludedMinor ?? (bankOutflowMinor - realExpenseMinor);

  return (
    <div className="bg-gradient-to-br from-emerald-950/50 via-zinc-900 to-black border border-emerald-500/20 rounded-3xl p-6 mb-6 relative overflow-hidden shadow-xl shadow-emerald-950/20">
      <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

      {/* Header comparison */}
      <div className="flex justify-between items-start mb-4">
        <div>
          <p className="text-zinc-400 text-xs font-medium uppercase tracking-wider mb-1">
            Банки насчитали списаний
          </p>
          <span className="text-2xl font-bold text-zinc-500 line-through decoration-zinc-600/80">
            {formatMoney(Math.abs(bankOutflowMinor))}
          </span>
        </div>

        <div className="text-right">
          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            Честный расчет
          </span>
        </div>
      </div>

      <div className="h-px w-full bg-gradient-to-r from-emerald-500/30 via-emerald-500/10 to-transparent mb-4" />

      <p className="text-emerald-400 text-xs font-medium uppercase tracking-wider mb-1">
        Реальные расходы за период
      </p>
      <div className="flex items-baseline gap-2 mb-4">
        <h1 className="text-4xl font-extrabold tracking-tight text-white">
          {formatMoney(Math.abs(realExpenseMinor))}
        </h1>
      </div>

      {/* Difference badge / explanation toggle */}
      {diff > 0 && (
        <div className="pt-2">
          <button
            type="button"
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="w-full flex items-center justify-between bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 rounded-2xl px-4 py-2.5 transition-all text-left group"
          >
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs font-bold">
                ✓
              </span>
              <div>
                <p className="text-xs font-semibold text-emerald-300">
                  Сберегли {formatMoney(diff)} от искажения
                </p>
                <p className="text-[10px] text-zinc-400">
                  {showBreakdown ? 'Нажмите, чтобы скрыть детали' : 'Нажмите, чтобы посмотреть что исключено'}
                </p>
              </div>
            </div>
            <span className="text-xs text-emerald-400 transition-transform duration-200 group-hover:translate-x-0.5">
              {showBreakdown ? '▲' : '▼'}
            </span>
          </button>

          {/* Breakdown Drawer / Accordion */}
          {showBreakdown && (
            <div className="mt-3 space-y-2 pt-2 border-t border-zinc-800/80">
              <p className="text-[11px] font-medium text-zinc-400 px-1">
                Почему эти деньги не посчитаны в расходы:
              </p>
              {excludedBreakdown.length === 0 ? (
                <div className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 text-xs text-zinc-400">
                  Переводы между своими счетами, возвраты и компенсации друзей.
                </div>
              ) : (
                excludedBreakdown.map((item, idx) => {
                  const info = getExclusionInfo(item.type);
                  return (
                    <div
                      key={idx}
                      className="bg-zinc-900/90 border border-zinc-800/80 rounded-xl p-3 flex justify-between items-start gap-2"
                    >
                      <div className="flex-1">
                        <p className="text-xs font-medium text-white">{info.label}</p>
                        <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">{info.desc}</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <span className="text-xs font-bold text-emerald-400">
                          −{formatMoney(item.amount_minor)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
