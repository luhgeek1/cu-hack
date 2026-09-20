import type { FinancialEvent } from "@/entities/finance";
import { transactionsById } from "@/entities/finance";
import { accountsById } from "@/entities/finance";
import { money, time } from "@/shared/lib/format";

type MoneyGraphProps = {
  event: FinancialEvent;
};

/**
 * Показывает, из каких банковских операций собралось одно событие
 * и почему итог отличается от суммы списания.
 */
export const MoneyGraph = ({ event }: MoneyGraphProps) => {
  const items = event.transactionIds
    .map((id) => transactionsById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));

  if (items.length < 2) return null;

  const [root, ...rest] = items;
  const rootAccount = accountsById.get(root.accountId);

  return (
    <div className="rounded-2xl border border-line bg-raised p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{root.merchant ?? "Операция"}</p>
          <p className="mt-0.5 text-[12px] text-fg-faint">
            {rootAccount?.bankName} · {time(root.timestamp)}
          </p>
        </div>
        <span className="tnum shrink-0 text-[14px]">
          {money(root.direction === "debit" ? -root.amount : root.amount, { sign: true })}
        </span>
      </div>

      <div className="mt-1 ml-2 border-l border-line-strong pl-4 [&>*:last-child]:pb-0">
        {rest.map((item) => {
          const account = accountsById.get(item.accountId);
          return (
            <div key={item.id} className="relative flex items-start justify-between gap-3 py-2.5">
              <span className="absolute -left-4 top-[1.15rem] h-px w-3 bg-line-strong" />
              <div className="min-w-0">
                <p className="truncate text-[13.5px]">{item.merchant ?? account?.bankName}</p>
                {item.description ? (
                  <p className="mt-0.5 truncate text-[12px] text-fg-faint">«{item.description}»</p>
                ) : null}
              </div>
              <span className="tnum shrink-0 text-[13.5px] text-sage-strong">
                {money(item.direction === "debit" ? -item.amount : item.amount, { sign: true })}
              </span>
            </div>
          );
        })}
      </div>

    </div>
  );
};
