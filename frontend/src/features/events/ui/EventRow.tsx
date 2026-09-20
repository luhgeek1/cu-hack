import { categoryIcon, eventMeta } from "@/entities/finance/ui/meta";
import type { FinancialEvent } from "@/entities/finance";
import { transactionsById } from "@/entities/finance";
import { money } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

const grossOf = (event: FinancialEvent) =>
  event.transactionIds.reduce((sum, id) => {
    const item = transactionsById.get(id);
    return item && item.direction === "debit" ? sum + item.amount : sum;
  }, 0);

type EventRowProps = {
  event: FinancialEvent;
  onSelect: (event: FinancialEvent) => void;
};

export const EventRow = ({ event, onSelect }: EventRowProps) => {
  const meta = eventMeta[event.type];
  const Icon = (event.type === "EXPENSE" && event.category ? categoryIcon[event.category] : null) ?? meta.icon;
  const gross = grossOf(event);
  const attention = event.status === "needs_attention";

  const amount = attention
    ? { text: money(event.amount), className: "text-sage-strong" }
    : event.effectiveIncome > 0
      ? { text: money(event.effectiveIncome, { sign: true }), className: "text-sage-strong" }
      : event.effectiveExpense > 0
        ? { text: money(-event.effectiveExpense, { sign: true }), className: "text-fg" }
        : { text: money(gross || event.amount), className: "text-fg-faint line-through decoration-line-strong" };

  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors active:bg-raised"
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full border",
          attention ? "border-sage/40 bg-sage-dim text-sage-strong" : "border-line bg-raised text-fg-muted"
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium">{event.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-fg-faint">
          {attention ? event.question : (event.subtitle ?? event.category ?? meta.label)}
        </span>
      </span>

      <span className="shrink-0 text-right">
        <span className={cn("tnum block text-[15px]", amount.className)}>{amount.text}</span>
        {event.effectiveExpense > 0 && gross > event.effectiveExpense ? (
          <span className="tnum mt-0.5 block text-[11.5px] text-fg-faint line-through decoration-line-strong">
            {money(gross)}
          </span>
        ) : null}
      </span>
    </button>
  );
};
