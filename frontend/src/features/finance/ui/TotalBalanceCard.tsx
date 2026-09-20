import React from 'react';
import { useFinance, type Account } from '@/entities/finance';
import { money } from '@/shared/lib/format';

interface TotalBalanceCardProps {
  totalBalance?: number;
  totalBalanceMinor?: number;
  accounts?: Account[] | any[];
  className?: string;
}

export const TotalBalanceCard: React.FC<TotalBalanceCardProps> = ({
  totalBalance: propTotal,
  totalBalanceMinor,
  accounts: propAccounts,
  className = '',
}) => {
  // Use finance store as fallback if inside FinanceProvider
  let storeAccounts: Account[] = [];
  try {
    const fin = useFinance();
    storeAccounts = fin.accounts;
  } catch {
    // outside provider fallback
  }

  const accounts = propAccounts ?? storeAccounts;
  const calculatedTotal = accounts.reduce(
    (sum: number, a: any) => sum + (typeof a.balance === 'number' ? a.balance : (a.balance_minor ? a.balance_minor / 100 : 0)),
    0
  );

  const total =
    propTotal !== undefined
      ? propTotal
      : totalBalanceMinor !== undefined
      ? totalBalanceMinor / 100
      : calculatedTotal;

  return (
    <div
      className={`rounded-[26px] border border-line bg-gradient-to-br from-[#16181c] via-[#131518] to-[#0c0d0f] p-5 shadow-xl relative overflow-hidden ${className}`}
    >
      {/* Subtle emerald ambient glow in top right */}
      <div className="absolute -top-12 -right-12 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
            Общий баланс счетов
          </span>
          <span className="rounded-full border border-line bg-raised/80 px-2.5 py-0.5 text-[11px] font-medium text-fg-muted">
            {accounts.length} {accounts.length === 1 ? 'счет' : accounts.length < 5 ? 'счета' : 'счетов'}
          </span>
        </div>

        <p className="tnum mt-2 text-[36px] font-black leading-none text-fg tracking-tight">
          {money(total)}
        </p>

        <div className="my-4 h-px w-full bg-line" />

        {accounts.length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-fg-faint mb-2.5">
              Подключенные банки:
            </p>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {accounts.map((acc: any) => {
                const isOzon = acc.bank === 'ozon' || acc.name?.toLowerCase().includes('ozon');
                const rawBal = typeof acc.balance === 'number' ? acc.balance : (acc.balance_minor ? acc.balance_minor / 100 : 0);
                const bankName = acc.bankName || acc.name || acc.bank;

                return (
                  <div
                    key={acc.id}
                    className="flex-shrink-0 min-w-[124px] rounded-2xl border border-line-strong bg-raised/90 p-3 flex flex-col justify-between shadow-sm"
                  >
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="truncate text-[12px] font-medium text-fg">
                        {bankName}
                      </span>
                      {isOzon && (
                        <span className="rounded bg-blue-500/20 px-1 py-0.5 text-[9px] font-bold text-blue-400">
                          Ozon
                        </span>
                      )}
                    </div>
                    <span className="tnum text-[14px] font-bold text-fg">
                      {money(rawBal)}
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
