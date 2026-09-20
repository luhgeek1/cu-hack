import type { FinancialEvent } from "@/entities/finance";
import { accountsById, transactionsById } from "@/entities/finance";
import { money, time } from "@/shared/lib/format";

type MoneyGraphProps = {
  event: FinancialEvent;
};

/**
 * Граф движения средств:
 * Визуальное дерево реконструкции финансового события
 * (исходная трата → компенсации/возвраты → честный остаток).
 */
export const MoneyGraph = ({ event }: MoneyGraphProps) => {
  const items = event.transactionIds
    .map((id) => transactionsById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

  if (items.length < 2) {
    // Single transaction or standard operation
    return null;
  }

  const [root, ...rest] = items;
  const rootAccount = accountsById.get(root.accountId);

  return (
    <div className="rounded-2xl border border-line bg-gradient-to-b from-raised to-surface p-4 shadow-md">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-fg-muted">
          Граф движения средств
        </h4>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-medium">
          Реконструкция события
        </span>
      </div>

      <div className="flex flex-col items-center">
        {/* Root Event Node */}
        <div className="rounded-2xl border border-line-strong bg-raised/90 p-3 text-center w-full max-w-[240px] shadow-sm relative z-10">
          <p className="text-[13px] font-semibold text-fg truncate">
            {root.merchant ?? rootAccount?.bankName ?? event.title}
          </p>
          <p className="text-[11px] text-fg-faint mt-0.5">
            {rootAccount?.bankName} · {time(root.timestamp)}
          </p>
          <p className="tnum text-[14px] font-bold text-fg-muted mt-1 line-through decoration-fg-muted/60">
            {money(root.direction === "debit" ? -root.amount : root.amount, { sign: true })}
          </p>
        </div>

        {/* Connecting Vertical Stem */}
        <div className="w-px h-5 bg-line-strong my-1" />

        {/* Branching Grid */}
        <div className="relative z-10 w-full">
          {/* Horizontal connecting bar across children */}
          {rest.length > 1 && (
            <div className="w-3/4 mx-auto h-px bg-line-strong -mb-1" />
          )}

          <div className="grid grid-cols-2 gap-2 mt-1">
            {rest.map((item) => {
              const account = accountsById.get(item.accountId);
              const name = item.description || item.merchant || account?.bankName || "Перевод";

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-line bg-surface/90 p-2.5 flex flex-col justify-between shadow-xs"
                >
                  <div>
                    <span className="text-[9px] font-bold text-fg-faint uppercase block truncate">
                      Компенсация
                    </span>
                    <p className="text-[12px] font-medium text-fg truncate mt-0.5">
                      {name}
                    </p>
                  </div>
                  <span className="tnum text-[13px] font-bold text-sage-strong mt-2">
                    +{money(item.amount)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Real Expense Bottom Summary */}
        <div className="mt-4 pt-3 border-t border-line w-full flex justify-between items-center text-xs">
          <span className="text-fg-muted font-medium">Реальный расход:</span>
          <span className="tnum text-[16px] font-extrabold text-fg">
            {money(event.effectiveExpense)}
          </span>
        </div>
      </div>
    </div>
  );
};
