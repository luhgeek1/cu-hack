import { eventMeta } from "@/entities/finance/ui/meta";
import { accountsById, transactionsById, useFinance, type FinancialEvent } from "@/entities/finance";
import { dayMonth, money, time } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

import { MoneyGraph } from "./MoneyGraph";

type EventSheetProps = {
  event: FinancialEvent | null;
  onClose: () => void;
};

export const EventSheet = ({ event, onClose }: EventSheetProps) => {
  const { resolve } = useFinance();

  if (!event) return <BottomSheet open={false} onClose={onClose} />;

  const meta = eventMeta[event.type];
  const attention = event.status === "needs_attention";
  const hasGraph = event.transactionIds.length > 1;
  const transactions = event.transactionIds
    .map((id) => transactionsById.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <BottomSheet open onClose={onClose} title={event.title}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-[12.5px] text-fg-faint">
          <span className="rounded-full border border-line bg-raised px-2.5 py-1 text-fg-muted">{meta.label}</span>
          <span>{dayMonth(transactions[0]?.timestamp ?? event.timestamp)}</span>
        </div>

        {attention && event.options ? (
          <div className="rounded-2xl border border-brass/30 bg-brass-dim/60 p-4">
            <p className="text-[15px] font-medium text-brass">{event.question}</p>
            {event.reason ? <p className="mt-1 text-[13px] text-fg-muted">{event.reason}</p> : null}
            <div className="mt-3 space-y-2">
              {event.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    resolve(event.id, option.id);
                    onClose();
                  }}
                  className="flex w-full items-center justify-between rounded-xl border border-line bg-surface px-4 py-3 text-left transition-colors hover:border-sage/50"
                >
                  <span className="text-[14px] font-medium">{option.label}</span>
                  <span className="text-[12px] text-fg-faint">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-raised p-4">
            <p className="text-[13px] text-fg-muted">
              {event.effectiveIncome > 0 ? "Реальный доход" : "Реальная трата"}
            </p>
            <p className="tnum mt-1 text-[30px] font-bold leading-none">
              {money(event.effectiveIncome > 0 ? event.effectiveIncome : event.effectiveExpense)}
            </p>
            {event.reason ? <p className="mt-2.5 text-[13.5px] text-fg-muted">{event.reason}</p> : null}
          </div>
        )}

        <MoneyGraph event={event} />

        {event.debtOutstanding ? (
          <div className="flex items-center justify-between rounded-2xl border border-line bg-raised px-4 py-3.5">
            <span className="text-[13.5px] text-fg-muted">Ещё не вернули</span>
            <span className="tnum text-[15px] text-brass">{money(event.debtOutstanding)}</span>
          </div>
        ) : null}

        {hasGraph ? null : (
        <div>
          <p className="px-1 pb-2 text-[12.5px] text-fg-faint">Операции банка</p>
          <ul className="overflow-hidden rounded-2xl border border-line">
            {transactions.map((item, index) => {
              const account = accountsById.get(item.accountId);
              return (
                <li
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-3 bg-raised px-4 py-3",
                    index > 0 && "border-t border-line"
                  )}
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px]">{item.merchant ?? account?.bankName}</span>
                    <span className="mt-0.5 block text-[11.5px] text-fg-faint">
                      {account?.bankName} · {dayMonth(item.timestamp)}, {time(item.timestamp)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "tnum shrink-0 text-[13.5px]",
                      item.direction === "credit" ? "text-sage-strong" : "text-fg-muted"
                    )}
                  >
                    {money(item.direction === "debit" ? -item.amount : item.amount, { sign: true })}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
        )}
      </div>
    </BottomSheet>
  );
};
