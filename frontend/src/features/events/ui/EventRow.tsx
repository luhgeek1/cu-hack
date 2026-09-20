import { ChevronRight, HelpCircle } from "lucide-react";

import { categoryIcon, eventMeta } from "@/entities/finance/ui/meta";
import { useFinance, type FinancialEvent } from "@/entities/finance";
import { money } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type EventRowProps = {
  event: FinancialEvent;
  onSelect: (event: FinancialEvent) => void;
};

export const EventRow = ({ event, onSelect }: EventRowProps) => {
  const meta = eventMeta[event.type];
  const Icon = (event.type === "EXPENSE" && event.category ? categoryIcon[event.category] : null) ?? meta.icon;
  const gross = event.amount;
  const attention = event.status === "needs_attention";

  let resolveFn: ((eventId: string, optionId: string) => void) | undefined;
  try {
    const fin = useFinance();
    resolveFn = fin.resolve;
  } catch {
    // Outside finance provider
  }

  const amount = attention
    ? { text: money(event.amount), className: "text-fg font-semibold" }
    : event.effectiveIncome > 0
      ? { text: money(event.effectiveIncome, { sign: true }), className: "text-sage-strong" }
      : event.effectiveExpense > 0
        ? { text: money(-event.effectiveExpense, { sign: true }), className: "text-fg" }
        : { text: money(gross || event.amount), className: "text-fg-faint line-through decoration-line-strong" };

  /** Событие с вопросом: выделяем оттенком подложки, а не свечением */
  if (attention) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(event)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect(event);
          }
        }}
        className="group my-2 w-full cursor-pointer rounded-2xl border border-sage/35 bg-gradient-to-b from-sage-dim/70 to-raised p-3.5 text-left transition-colors hover:border-sage/55"
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="flex items-center gap-2 text-[12.5px] text-sage-strong">
            <span className="size-1.5 rounded-full bg-sage-strong" />
            Нужно решить
          </span>

          <span className="flex items-center gap-0.5 text-[12.5px] text-fg-muted transition-colors group-hover:text-fg">
            Решить
            <ChevronRight className="size-3.5" />
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line-strong bg-surface text-sage-strong">
            <HelpCircle className="size-[18px]" strokeWidth={1.8} />
          </span>

          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">{event.title}</span>
            <span className="mt-0.5 block truncate text-[12.5px] text-fg-muted">
              {event.question || event.subtitle || "Что это за операция?"}
            </span>
          </div>

          <span className="tnum shrink-0 text-[15px] font-semibold text-fg">{amount.text}</span>
        </div>

        {event.options && event.options.length > 0 && resolveFn && (
          <div
            className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto border-t border-line pt-3"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            {event.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resolveFn?.(event.id, opt.id);
                }}
                className="max-w-[62%] shrink-0 truncate rounded-full border border-line-strong bg-surface px-3.5 py-2 text-[13px] font-medium transition-colors hover:border-sage hover:text-sage-strong"
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Regular transaction row
  return (
    <button
      type="button"
      onClick={() => onSelect(event)}
      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition-colors active:bg-raised hover:bg-raised/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-raised text-fg-muted">
        <Icon className="size-[18px]" strokeWidth={1.8} />
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[15px] font-medium">{event.title}</span>
        </span>
        <span className="mt-0.5 block truncate text-[12.5px] text-fg-faint">
          {event.subtitle ?? event.category ?? meta.label}
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
