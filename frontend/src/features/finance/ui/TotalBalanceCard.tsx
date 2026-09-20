import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinance, type Account } from '@/entities/finance';
import { money } from '@/shared/lib/format';
import { cn } from '@/shared/lib/utils';

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

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

  const checkScroll = () => {
    if (!scrollRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
    setCanScrollLeft(scrollLeft > 4);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 4);
  };

  useEffect(() => {
    checkScroll();
    window.addEventListener('resize', checkScroll);
    return () => window.removeEventListener('resize', checkScroll);
  }, [accounts]);

  const handleScroll = (direction: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const offset = 180;
    scrollRef.current.scrollBy({
      left: direction === 'left' ? -offset : offset,
      behavior: 'smooth',
    });
  };

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
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-fg-faint">
                Подключенные банки:
              </p>
              {(canScrollLeft || canScrollRight) && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleScroll('left')}
                    disabled={!canScrollLeft}
                    aria-label="Прокрутить влево"
                    className={cn(
                      "p-1 rounded-lg border border-line transition-colors cursor-pointer",
                      canScrollLeft
                        ? "text-fg-muted hover:text-fg hover:bg-raised bg-surface shadow-xs"
                        : "text-fg-faint/30 border-transparent cursor-not-allowed"
                    )}
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleScroll('right')}
                    disabled={!canScrollRight}
                    aria-label="Прокрутить вправо"
                    className={cn(
                      "p-1 rounded-lg border border-line transition-colors cursor-pointer",
                      canScrollRight
                        ? "text-fg-muted hover:text-fg hover:bg-raised bg-surface shadow-xs"
                        : "text-fg-faint/30 border-transparent cursor-not-allowed"
                    )}
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="relative group">
              {/* Fade masks for visual scroll affordance */}
              {canScrollLeft && (
                <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-[#16181c] to-transparent z-10 pointer-events-none rounded-l-2xl" />
              )}
              {canScrollRight && (
                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#131518] to-transparent z-10 pointer-events-none rounded-r-2xl" />
              )}

              <div
                ref={scrollRef}
                onScroll={checkScroll}
                className="flex gap-2 overflow-x-auto pb-1 scroll-smooth no-scrollbar scrollbar-thin"
              >
                {accounts.map((acc: any) => {
                  const isOzon = acc.bank === 'ozon' || acc.name?.toLowerCase().includes('ozon');
                  const rawBal = typeof acc.balance === 'number' ? acc.balance : (acc.balance_minor ? acc.balance_minor / 100 : 0);
                  const bankName = acc.bankName || acc.name || acc.bank;

                  return (
                    <div
                      key={acc.id}
                      className="flex-shrink-0 min-w-[126px] rounded-2xl border border-line-strong bg-raised/90 p-3 flex flex-col justify-between shadow-sm hover:border-line-strong/80 transition-colors"
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
          </div>
        )}
      </div>
    </div>
  );
};
