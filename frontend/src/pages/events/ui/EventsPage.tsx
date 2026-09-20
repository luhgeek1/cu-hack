import { useMemo, useState } from "react";
import { AlertCircle, ArrowRight, HelpCircle } from "lucide-react";

import { useQuery } from "@tanstack/react-query";

import {
  financeApi,
  periodRange,
  useFinance,
  type FinancialEvent,
} from "@/entities/finance";
import { mapEvent } from "@/entities/finance";
import { EventList } from "@/features/events/ui/EventList";
import { EventSheet } from "@/features/events/ui/EventSheet";
import { money } from "@/shared/lib/format";
import { Segmented } from "@/shared/ui/Segmented";

type Filter = "all" | "attention" | "hidden";

export default function EventsPage() {
  const { anchor, range: customRange, summary, period, needsAttention, withAttention } = useFinance();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<FinancialEvent | null>(null);

  // Период берём тот же, что и остальные экраны: якорь, а не сегодняшний день,
  // иначе импорт за прошлый месяц оставляет список пустым
  const range = useMemo(
    () => customRange ?? periodRange(period, anchor),
    [anchor, customRange, period]
  );

  const query = useQuery({
    queryKey: ["finance", "events", period, range.from.toDateString(), range.to.toDateString()],
    queryFn: () => financeApi.getEvents({ startDate: range.from, endDate: range.to }),
    staleTime: 30_000,
  });

  const scoped: FinancialEvent[] = useMemo(
    () => (query.data?.items ?? []).map(mapEvent).map(withAttention),
    [query.data, withAttention]
  );

  const visible = useMemo(() => {
    if (filter === "attention") return scoped.filter((event) => event.status === "needs_attention");
    if (filter === "hidden") {
      return scoped.filter((event) => event.effectiveExpense === 0 && event.effectiveIncome === 0);
    }
    return scoped;
  }, [filter, scoped]);

  const attentionCount = scoped.filter((e) => e.status === "needs_attention").length;

  return (
    <>
      <header className="px-5 md:px-0 pb-4 pt-5 safe-top">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-[22px] md:text-[26px] font-bold -tracking-[0.02em]">События</h1>
          <div className="flex items-center gap-2">
            <span className="tnum text-[13px] md:text-[14px] font-semibold text-fg-muted">
              {money(-summary.realExpense, { sign: true })}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Segmented
            className="w-full sm:max-w-lg"
            layoutId="events-filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "Все" },
              {
                value: "attention",
                label: attentionCount > 0 ? `Вопросы (${attentionCount})` : "Вопросы",
              },
              { value: "hidden", label: "Не траты" },
            ]}
          />

          <span className="text-[12px] text-fg-faint hidden sm:inline">
            Всего операций: {visible.length}
          </span>
        </div>

        {/* Attention Notice Banner if there are unresolved questions and filter is not 'attention' */}
        {attentionCount > 0 && filter !== "attention" && (
          <div className="mt-3.5 flex items-center justify-between rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 via-surface to-raised p-3 shadow-md shadow-emerald-950/30">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400">
                <HelpCircle className="size-4" strokeWidth={2.2} />
              </span>
              <p className="text-[12.5px] font-medium text-fg truncate">
                <strong className="text-emerald-400 font-bold">{attentionCount}</strong>{" "}
                {attentionCount === 1 ? "операция требует" : "операции требуют"} вашего ответа
              </p>
            </div>

            <button
              type="button"
              onClick={() => setFilter("attention")}
              className="shrink-0 flex items-center gap-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1 text-[11.5px] font-bold transition-colors active:scale-95 ml-2"
            >
              Разобрать
              <ArrowRight className="size-3" />
            </button>
          </div>
        )}
      </header>

      <div className="px-5 md:px-0">
        <EventList events={visible} onSelect={setSelected} />
      </div>

      <EventSheet event={selected} onClose={() => setSelected(null)} />
    </>
  );
}
