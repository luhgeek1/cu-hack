import { useMemo, useState } from "react";

import { eventsInPeriod, useFinance, type FinancialEvent } from "@/entities/finance";
import { ActiveBankChip } from "@/features/accounts/ui/ActiveBankChip";
import { EventList } from "@/features/events/ui/EventList";
import { EventSheet } from "@/features/events/ui/EventSheet";
import { money } from "@/shared/lib/format";
import { Segmented } from "@/shared/ui/Segmented";

type Filter = "all" | "attention" | "hidden";

export default function EventsPage() {
  const { events, today, summary, bank } = useFinance();
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<FinancialEvent | null>(null);

  const scoped = useMemo(() => eventsInPeriod(events, "month", today, bank), [events, today, bank]);

  const visible = useMemo(() => {
    if (filter === "attention") return scoped.filter((event) => event.status === "needs_attention");
    if (filter === "hidden") {
      return scoped.filter((event) => event.effectiveExpense === 0 && event.effectiveIncome === 0);
    }
    return scoped;
  }, [filter, scoped]);

  return (
    <>
      <header className="px-5 pb-4 pt-5 safe-top">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-[22px] font-bold -tracking-[0.02em]">События</h1>
          <div className="flex items-center gap-2">
            <ActiveBankChip />
            <span className="tnum text-[13px] text-fg-muted">
              {money(-summary.realExpense, { sign: true })}
            </span>
          </div>
        </div>
        <Segmented
          className="mt-4"
          layoutId="events-filter"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "Все" },
            { value: "attention", label: "Вопросы" },
            { value: "hidden", label: "Не траты" },
          ]}
        />
      </header>

      <EventList events={visible} onSelect={setSelected} />

      <EventSheet event={selected} onClose={() => setSelected(null)} />
    </>
  );
}
