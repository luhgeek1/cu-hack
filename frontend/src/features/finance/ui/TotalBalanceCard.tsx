import React from 'react';
import { formatMoney } from '@/shared/lib/formatters';
import { getBankName } from '@/shared/lib/financeLabels';

export interface AccountItem {
  id: string;
  name: string;
  bank: string;
  account_type: 'card' | 'marketplace' | string;
  balance_minor: number;
  last_synced_at?: string | null;
}

interface TotalBalanceCardProps {
  totalBalanceMinor?: number;
  accounts?: AccountItem[];
}

export const TotalBalanceCard: React.FC<TotalBalanceCardProps> = ({
  totalBalanceMinor = 0,
  accounts = [],
}) => {
  return (
    <div className="bg-gradient-to-br from-zinc-900 via-zinc-900/90 to-black border border-zinc-800 rounded-3xl p-5 mb-6 shadow-xl relative overflow-hidden">
      {/* Glow background accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex justify-between items-center mb-1">
          <p className="text-zinc-400 text-xs font-semibold uppercase tracking-wider">
            Общий баланс счетов
          </p>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700 font-mono">
            {accounts.length} {accounts.length === 1 ? 'счет' : 'счетов'}
          </span>
        </div>

        <h2 className="text-3xl font-extrabold text-white tracking-tight mb-4">
          {formatMoney(totalBalanceMinor)}
        </h2>

        {/* Connected accounts chips / list */}
        {accounts.length > 0 && (
          <div className="pt-3 border-t border-zinc-800/80">
            <p className="text-[10px] font-semibold uppercase text-zinc-500 tracking-wider mb-2">
              Подключенные банки:
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {accounts.map((acc) => {
                const bankTitle = getBankName(acc.bank);
                const isMarketplace = acc.account_type === 'marketplace' || acc.bank === 'ozon';

                return (
                  <div
                    key={acc.id}
                    className="flex-shrink-0 bg-zinc-800/60 border border-zinc-700/60 rounded-2xl p-2.5 min-w-[130px] flex flex-col justify-between"
                  >
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-medium text-zinc-300 truncate">
                        {bankTitle}
                      </span>
                      {isMarketplace && (
                        <span className="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold">
                          Ozon
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-white mt-1">
                      {formatMoney(acc.balance_minor)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
