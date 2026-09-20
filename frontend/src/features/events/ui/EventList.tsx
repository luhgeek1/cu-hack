import { useMemo } from "react";

import type { FinancialEvent } from "@/entities/finance";
import { useFinance } from "@/entities/finance";
import { dateKey, dayTitle, money } from "@/shared/lib/format";

import { EventRow } from "./EventRow";

type EventListProps = {
  events: FinancialEvent[];
  onSelect: (event: FinancialEvent) => void;
};

export const EventList = ({ events, onSelect }: EventListProps) => {
  const { today } = useFinance();

  const groups = useMemo(() => {
    const map = new Map<string, FinancialEvent[]>();
    events.forEach((event) => {
      const key = dateKey(event.timestamp);
      map.set(key, [...(map.get(key) ?? []), event]);
    });
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [events]);

  if (groups.length === 0) {
    return (
      <div className="mx-5 rounded-2xl border border-dashed border-line-strong px-4 py-10 text-center">
        <p className="text-[14px] text-fg-muted">Здесь пусто</p>
        <p className="mt-1 text-[13px] text-fg-faint">Всё разобрано автоматически</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {groups.map(([key, items]) => {
        const dayExpense = items.reduce((sum, event) => sum + event.effectiveExpense, 0);
        return (
          <section key={key}>
            <div className="mb-1 flex items-baseline justify-between px-3">
              <h3 className="text-[12.5px] text-fg-faint">{dayTitle(items[0].timestamp, today)}</h3>
              {dayExpense > 0 ? (
                <span className="tnum text-[12.5px] text-fg-faint">{money(-dayExpense, { sign: true })}</span>
              ) : null}
            </div>
            <div className="px-3">
              {items.map((event) => (
                <EventRow key={event.id} event={event} onSelect={onSelect} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};
