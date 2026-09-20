import React, { useState } from 'react';
import { useFinance, type PeriodSummary } from '@/entities/finance';
import { money } from '@/shared/lib/format';

interface BreakdownItem {
  type: string;
  label?: string;
  amount?: number;
  amount_minor?: number;
  desc?: string;
}

interface RealSpendingCardProps {
  bankOutflow?: number;
  bankOutflowMinor?: number;
  realExpense?: number;
  realExpenseMinor?: number;
  excludedBreakdown?: BreakdownItem[];
  excluded?: number;
  excludedMinor?: number;
  className?: string;
}

export const RealSpendingCard: React.FC<RealSpendingCardProps> = ({
  bankOutflow: propBankOutflow,
  bankOutflowMinor,
  realExpense: propRealExpense,
  realExpenseMinor,
  excludedBreakdown: propBreakdown,
  excluded: propExcluded,
  excludedMinor,
  className = '',
}) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Read from finance store if available
  let storeSummary: PeriodSummary | null = null;
  try {
    const fin = useFinance();
    storeSummary = fin.summary;
  } catch {
    // outside provider fallback
  }

  const bankSpent =
    propBankOutflow !== undefined
      ? propBankOutflow
      : bankOutflowMinor !== undefined
      ? bankOutflowMinor / 100
      : storeSummary?.bankSpent ?? 0;

  const realExp =
    propRealExpense !== undefined
      ? propRealExpense
      : realExpenseMinor !== undefined
      ? realExpenseMinor / 100
      : storeSummary?.realExpense ?? 0;

  const excluded =
    propExcluded !== undefined
      ? propExcluded
      : excludedMinor !== undefined
      ? excludedMinor / 100
      : storeSummary?.excluded ?? (bankSpent - realExp);

  const breakdown: BreakdownItem[] =
    propBreakdown ??
    (storeSummary?.excludedBreakdown?.map((b) => ({
      type: b.type,
      label: b.label,
      amount: b.amount,
    })) ?? []);

  return (
    <div
      className={`rounded-[26px] border border-emerald-500/20 bg-gradient-to-br from-[#0e1e18]/70 via-[#131718] to-[#0b0c0e] p-5 shadow-xl relative overflow-hidden ${className}`}
    >
      {/* Background ambient lighting */}
      <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Банки насчитали списаний
          </span>
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400">
            Честный расчет
          </span>
        </div>

        <p className="tnum mt-1 text-[26px] font-bold text-fg-faint line-through decoration-fg-faint/70">
          {money(bankSpent)}
        </p>

        <div className="my-4 h-px w-full bg-gradient-to-r from-emerald-500/25 via-line to-transparent" />

        <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1">
          Реальные расходы за период
        </p>
        <p className="tnum text-[38px] font-black leading-tight text-fg tracking-tight">
          {money(realExp)}
        </p>

        {/* Excluded savings drawer / accordion */}
        {excluded > 0 && (
          <div className="mt-4 pt-1">
            <button
              type="button"
              onClick={() => setShowBreakdown(!showBreakdown)}
              className="w-full flex items-center justify-between rounded-2xl border border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/15 px-4 py-2.5 transition-all text-left group"
            >
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                  ✓
                </span>
                <div>
                  <p className="text-[12px] font-semibold text-emerald-300">
                    Сберегли {money(excluded)} от искажения
                  </p>
                  <p className="text-[10px] text-fg-muted">
                    {showBreakdown ? 'Нажмите, чтобы скрыть детали' : 'Нажмите, чтобы посмотреть что исключено'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-emerald-400 transition-transform duration-200 group-hover:translate-x-0.5">
                {showBreakdown ? '▲' : '▼'}
              </span>
            </button>

            {showBreakdown && (
              <div className="mt-3 space-y-2 pt-2 border-t border-line">
                <p className="text-[11px] font-medium text-fg-muted px-1">
                  Почему эти суммы не считаются расходом:
                </p>
                {breakdown.length === 0 ? (
                  <div className="p-3 rounded-xl bg-raised/80 border border-line text-xs text-fg-muted">
                    Переводы себе, возвраты покупок и компенсации друзей.
                  </div>
                ) : (
                  breakdown.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-raised/90 border border-line rounded-xl p-3 flex justify-between items-center gap-2"
                    >
                      <span className="text-xs font-medium text-fg">{item.label || item.type}</span>
                      <span className="tnum text-xs font-bold text-emerald-400">
                        −{money(item.amount ?? (item.amount_minor ? item.amount_minor / 100 : 0))}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
