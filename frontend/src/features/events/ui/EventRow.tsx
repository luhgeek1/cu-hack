import { ChevronRight, HelpCircle } from "lucide-react";

import { categoryIcon, eventMeta } from "@/entities/finance/ui/meta";
import type { FinancialEvent } from "@/entities/finance";
import { transactionsById, useFinance } from "@/entities/finance";
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

  let resolveFn: ((eventId: string, optionId: string) => void) | undefined;
  try {
    const fin = useFinance();
    resolveFn = fin.resolve;
  } catch {
    // Outside finance provider
  }

  const amount = attention
    ? { text: money(event.amount), className: "text-emerald-400 font-extrabold" }
    : event.effectiveIncome > 0
      ? { text: money(event.effectiveIncome, { sign: true }), className: "text-sage-strong" }
      : event.effectiveExpense > 0
        ? { text: money(-event.effectiveExpense, { sign: true }), className: "text-fg" }
        : { text: money(gross || event.amount), className: "text-fg-faint line-through decoration-line-strong" };

  // Специальное яркое и заметное оформление для операций, требующих внимания (со скриншота)
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
        className="w-full text-left my-2.5 rounded-2xl border-2 border-emerald-500/60 bg-gradient-to-r from-emerald-950/40 via-[#14181a] to-surface p-3.5 shadow-lg shadow-emerald-950/50 relative overflow-hidden transition-all hover:border-emerald-400 hover:shadow-emerald-500/15 active:scale-[0.99] cursor-pointer group"
      >
        {/* Subtle emerald glow in background */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none" />

        {/* Top Header Badge */}
        <div className="flex items-center justify-between mb-2.5 relative z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10.5px] font-bold uppercase tracking-wider border border-emerald-500/40">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Требует внимания
          </span>

          <span className="flex items-center gap-0.5 text-[11.5px] font-semibold text-emerald-400 group-hover:text-emerald-300 transition-colors">
            Решить
            <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>

        {/* Main transaction details row */}
        <div className="flex items-center gap-3 relative z-10">
          {/* Question circle icon matching screenshot */}
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/80 bg-emerald-950/70 text-emerald-400 shadow-md shadow-emerald-500/30 group-hover:scale-105 transition-transform">
            <HelpCircle className="size-5 text-emerald-400" strokeWidth={2.2} />
          </span>

          <div className="min-w-0 flex-1">
            <span className="truncate text-[15.5px] font-bold text-fg block tracking-tight">
              {event.title}
            </span>
            <span className="mt-0.5 block text-[13px] font-medium text-emerald-300/90 leading-tight">
              {event.question || event.subtitle || "Что это за операция?"}
            </span>
          </div>

          <div className="shrink-0 text-right">
            <span className="tnum block text-[17px] font-black text-emerald-400">
              {amount.text}
            </span>
          </div>
        </div>

        {/* 1-tap quick options directly inside the card */}
        {event.options && event.options.length > 0 && resolveFn && (
          <div
            className="mt-3 pt-2.5 border-t border-emerald-500/20 flex items-center gap-1.5 overflow-x-auto no-scrollbar relative z-10"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <span className="text-[10px] uppercase font-bold text-fg-faint shrink-0 mr-1">
              В 1 тап:
            </span>
            {event.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  resolveFn?.(event.id, opt.id);
                }}
                className="shrink-0 whitespace-nowrap rounded-xl border border-line-strong bg-raised hover:bg-emerald-500/20 hover:border-emerald-500/50 hover:text-emerald-300 px-3 py-1.5 text-[12px] font-medium text-fg-muted transition-all active:scale-95 shadow-xs"
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
