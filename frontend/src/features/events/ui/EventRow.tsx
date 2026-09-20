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
        className="w-full text-left my-2.5 rounded-2xl border border-emerald-500/40 bg-[#121616] hover:bg-[#151a1a] p-3.5 relative overflow-hidden transition-colors active:scale-[0.99] cursor-pointer group"
      >
        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-2.5 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 text-[10.5px] font-bold uppercase tracking-wider border border-emerald-500/30">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Требует внимания
          </span>

          <span className="flex items-center gap-0.5 text-[11.5px] font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors">
            Решить
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        {/* Main transaction details row */}
        <div className="flex items-center gap-3 relative z-10">
          {/* Question circle icon */}
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-400 group-hover:scale-105 transition-transform">
            <HelpCircle className="size-5 text-emerald-400" strokeWidth={2} />
          </span>

          <div className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold text-fg">{event.title}</span>
            <span className="mt-0.5 block truncate text-[12.5px] text-emerald-400/80">
              {event.question || event.subtitle || "Что это за операция?"}
            </span>
          </div>

          <span className="tnum shrink-0 text-[15px] font-bold text-emerald-400">{amount.text}</span>
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
