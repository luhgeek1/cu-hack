import { useEffect, useMemo, useRef, useState } from "react";

import { MONTHS, type DateRange } from "@/entities/finance";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

type PeriodPickerSheetProps = {
  open: boolean;
  onClose: () => void;
  today: Date;
  /** Текущий выбор — подсвечивается при открытии */
  value: DateRange | null;
  onApply: (range: DateRange) => void;
  /** Вернуться к обычным периодам (день/неделя/месяц/год) */
  onReset: () => void;
};

/** Сколько месяцев назад можно листать */
const MONTHS_BACK = 11;

const WEEKDAYS = ["пн", "вт", "ср", "чт", "пт", "сб", "вс"];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

const fieldLabel = (date: Date | null) =>
  date ? `${date.getDate()} ${MONTHS[date.getMonth()]}` : "—";

/** Сетка месяца: пустые клетки до первого дня, неделя с понедельника */
const monthGrid = (year: number, month: number): (Date | null)[] => {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const days = new Date(year, month + 1, 0).getDate();

  return [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, index) => new Date(year, month, index + 1)),
  ];
};

/**
 * Календарь для произвольного периода аналитики: первый тап задаёт начало,
 * второй — конец. Будущие даты недоступны: данных за них ещё нет.
 */
export const PeriodPickerSheet = ({
  open,
  onClose,
  today,
  value,
  onApply,
  onReset,
}: PeriodPickerSheetProps) => {
  const [from, setFrom] = useState<Date | null>(value?.from ?? null);
  const [to, setTo] = useState<Date | null>(value?.to ?? null);
  const currentMonthRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setFrom(value?.from ?? null);
    setTo(value?.to ?? null);
    // Открываемся сразу на текущем месяце — остальные выше по скроллу
    const timer = window.setTimeout(
      () => currentMonthRef.current?.scrollIntoView({ block: "end" }),
      0
    );
    return () => window.clearTimeout(timer);
  }, [open, value]);

  const months = useMemo(() => {
    const last = new Date(today.getFullYear(), today.getMonth(), 1);
    return Array.from({ length: MONTHS_BACK + 1 }, (_, index) => {
      const month = new Date(last.getFullYear(), last.getMonth() - (MONTHS_BACK - index), 1);
      return { year: month.getFullYear(), month: month.getMonth() };
    });
  }, [today]);

  const limit = startOfDay(today);

  const pick = (date: Date) => {
    if (!from || to) {
      setFrom(date);
      setTo(null);
      return;
    }
    if (date < from) {
      setFrom(date);
      return;
    }
    setTo(date);
  };

  const apply = () => {
    if (!from) return;
    onApply({ from, to: to ?? from });
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Выберите период">
      <div className="flex items-start gap-6 pb-4">
        <div className="min-w-0 flex-1 border-b-2 border-sage pb-1">
          <span className="block text-[11.5px] text-fg-faint">Дата начала</span>
          <span className="block text-[15px] font-medium">{fieldLabel(from)}</span>
        </div>
        <div
          className={cn(
            "min-w-0 flex-1 border-b-2 pb-1",
            to ? "border-sage" : "border-line"
          )}
        >
          <span className="block text-[11.5px] text-fg-faint">Дата окончания</span>
          <span className="block text-[15px] font-medium">{fieldLabel(to)}</span>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-line pb-2">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-center text-[11px] uppercase text-fg-faint">
            {day}
          </span>
        ))}
      </div>

      <div className="no-scrollbar max-h-[46dvh] overflow-y-auto py-3">
        {months.map(({ year, month }, index) => (
          <div
            key={`${year}-${month}`}
            ref={index === months.length - 1 ? currentMonthRef : undefined}
            className="mb-4"
          >
            <span className="mb-2 inline-block rounded-full bg-raised px-3 py-1 text-[13px] font-medium capitalize">
              {MONTHS[month]} {year !== today.getFullYear() ? year : ""}
            </span>

            <div className="grid grid-cols-7 gap-y-1">
              {monthGrid(year, month).map((date, cell) => {
                if (!date) return <span key={`empty-${cell}`} className="h-9" />;

                const disabled = date > limit;
                const isFrom = from ? sameDay(date, from) : false;
                const isTo = to ? sameDay(date, to) : false;
                const edge = isFrom || isTo;
                const inside = Boolean(from && to && date > from && date < to);
                // Полоса тянется сплошняком: клетки в сетке сомкнуты по горизонтали
                const banded = Boolean(from && to && (inside || edge));
                const column = cell % 7;
                const lastDay = new Date(year, month + 1, 0).getDate();
                const capLeft = column === 0 || isFrom || date.getDate() === 1;
                const capRight = column === 6 || isTo || date.getDate() === lastDay;

                return (
                  <div key={date.toDateString()} className="relative h-9">
                    {banded ? (
                      <span
                        className={cn(
                          "absolute inset-0 bg-sage/15",
                          capLeft && "rounded-l-full",
                          capRight && "rounded-r-full"
                        )}
                      />
                    ) : null}

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => pick(date)}
                      className={cn(
                        "tnum relative mx-auto flex size-9 items-center justify-center rounded-full text-[14px] transition-colors",
                        disabled && "text-fg-faint/35",
                        !disabled && !edge && "text-fg hover:bg-raised",
                        edge && "bg-sage font-semibold text-ink"
                      )}
                    >
                      {date.getDate()}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3 pt-2">
        {value ? (
          <button
            type="button"
            onClick={() => {
              onReset();
              onClose();
            }}
            className="rounded-full border border-line px-4 py-3 text-[14px] text-fg-muted transition-colors hover:text-fg"
          >
            Сбросить
          </button>
        ) : null}
        <button
          type="button"
          onClick={apply}
          disabled={!from}
          className={cn(
            "flex-1 rounded-full px-4 py-3 text-[15px] font-semibold transition-colors",
            from ? "bg-sage text-ink" : "bg-raised text-fg-faint"
          )}
        >
          Готово
        </button>
      </div>
    </BottomSheet>
  );
};
