import type { PeriodKey } from "./types";

const MONTHS = [
  "январь",
  "февраль",
  "март",
  "апрель",
  "май",
  "июнь",
  "июль",
  "август",
  "сентябрь",
  "октябрь",
  "ноябрь",
  "декабрь",
];

const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Неделя начинается с понедельника — так же считает бэкенд */
const startOfWeek = (date: Date) => addDays(startOfDay(date), -((date.getDay() + 6) % 7));

export type Range = { from: Date; to: Date; label: string };

export const periodRange = (key: PeriodKey, anchor: Date): Range => {
  switch (key) {
    case "day": {
      const from = startOfDay(anchor);
      return { from, to: from, label: `${from.getDate()} ${MONTHS[from.getMonth()]}` };
    }
    case "week": {
      const from = startOfWeek(anchor);
      const to = addDays(from, 6);
      return {
        from,
        to,
        label: `${from.getDate()}–${to.getDate()} ${MONTHS_SHORT[to.getMonth()]}`,
      };
    }
    case "year": {
      const from = new Date(anchor.getFullYear(), 0, 1);
      return { from, to: new Date(anchor.getFullYear(), 11, 31), label: String(anchor.getFullYear()) };
    }
    case "month":
    default: {
      const from = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      return {
        from,
        to: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0),
        label: MONTHS[anchor.getMonth()],
      };
    }
  }
};

export { MONTHS, MONTHS_SHORT };
