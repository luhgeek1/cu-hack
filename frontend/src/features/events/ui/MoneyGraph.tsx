import type { TransactionDto } from "@/entities/finance/api/dto";
import { money, time } from "@/shared/lib/format";

type MoneyGraphProps = {
  transactions: TransactionDto[];
  /** Итог события после разбора */
  result: number;
  resultLabel: string;
};

/**
 * Показывает, из каких банковских операций собралось одно событие
 * и почему итог отличается от суммы списания.
 */
export const MoneyGraph = ({ transactions, result, resultLabel }: MoneyGraphProps) => {
  if (transactions.length < 2) return null;

  const sorted = [...transactions].sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));
  const [root, ...rest] = sorted;

  return (
    <div className="rounded-2xl border border-line bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{root.merchant ?? root.description}</p>
          <p className="mt-0.5 text-[12px] text-fg-faint">{time(root.occurred_at)}</p>
        </div>
        <span className="tnum shrink-0 text-[14px]">
          {money(root.amount_minor / 100, { sign: true })}
        </span>
      </div>

      <div className="mt-1 ml-2 border-l border-line-strong pl-4 [&>*:last-child]:pb-0">
        {rest.map((item) => (
          <div key={item.id} className="relative flex items-start justify-between gap-3 py-2.5">
            <span className="absolute -left-4 top-[1.15rem] h-px w-3 bg-line-strong" />
            <div className="min-w-0">
              <p className="truncate text-[13.5px]">{item.counterparty ?? item.merchant ?? item.description}</p>
              {item.description && item.description !== item.merchant ? (
                <p className="mt-0.5 truncate text-[12px] text-fg-faint">«{item.description}»</p>
              ) : null}
            </div>
            <span
              className={
                "tnum shrink-0 text-[13.5px] " +
                (item.amount_minor > 0 ? "text-sage-strong" : "text-fg-muted")
              }
            >
              {money(item.amount_minor / 100, { sign: true })}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
        <span className="text-[13.5px] text-fg-muted">{resultLabel}</span>
        <span className="tnum text-[15px] font-semibold text-sage-strong">{money(result)}</span>
      </div>
    </div>
  );
};
