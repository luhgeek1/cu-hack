const NBSP = " ";

/** 38 420 ₽ — без копеек, узкие неразрывные пробелы */
export const money = (value: number, options?: { sign?: boolean; unit?: boolean }): string => {
  const rounded = Math.round(Math.abs(value));
  const body = rounded.toLocaleString("ru-RU").replace(/\s/g, NBSP);
  const sign = options?.sign ? (value > 0 ? "+" : value < 0 ? "−" : "") : value < 0 ? "−" : "";
  const unit = options?.unit === false ? "" : `${NBSP}₽`;
  return `${sign}${body}${unit}`;
};

export const compactMoney = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1).replace(".", ",")}${NBSP}млн`;
  if (abs >= 10_000) return `${Math.round(abs / 1_000)}${NBSP}тыс`;
  return Math.round(abs).toLocaleString("ru-RU").replace(/\s/g, NBSP);
};

export const percent = (value: number): string => `${Math.round(value * 100)}%`;

const DAY_MONTH = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const WEEKDAY = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });
const TIME = new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit" });

export const dayMonth = (date: Date | string) => DAY_MONTH.format(new Date(date));
export const weekday = (date: Date | string) => WEEKDAY.format(new Date(date));
export const time = (date: Date | string) => TIME.format(new Date(date));

export const dayTitle = (date: Date | string, today: Date): string => {
  const target = new Date(date);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (sameDay(target, today)) return "Сегодня";
  if (sameDay(target, yesterday)) return "Вчера";
  return dayMonth(target);
};

export const dateKey = (date: Date | string) => new Date(date).toISOString().slice(0, 10);
