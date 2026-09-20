const CATEGORIES = new Set([
  "groceries",
  "restaurants",
  "transport",
  "electronics",
  "household",
  "subscriptions",
  "health",
  "shopping",
  "cash",
  "other",
]);

export type ParsedTransaction = {
  external_id: string;
  amount_minor: number;
  occurred_at: string;
  description: string;
  merchant?: string;
  counterparty?: string;
  category?: string;
};

export type ParseResult = {
  transactions: ParsedTransaction[];
  /** Строки, которые не прошли проверку: номер и причина */
  skipped: { row: number; reason: string }[];
};

export class StatementParseError extends Error {}

const text = (value: unknown, limit: number): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, limit) : undefined;

/** Копейки как есть, либо рубли из `amount` */
const toMinor = (row: Record<string, unknown>): number | null => {
  const minor = row.amount_minor ?? row.amountMinor;
  if (minor !== undefined && minor !== null && Number.isFinite(Number(minor))) {
    return Math.round(Number(minor));
  }

  const major = row.amount ?? row.sum ?? row.value;
  if (major !== undefined && major !== null && Number.isFinite(Number(major))) {
    return Math.round(Number(major) * 100);
  }

  return null;
};

/** Бэкенд принимает только дату со смещением; без него считаем, что это Москва */
const toAware = (value: unknown): string | null => {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;

  const withZone = /(z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const normalized = withZone ? raw : `${raw.length === 10 ? `${raw}T00:00:00` : raw}+03:00`;

  return Number.isNaN(new Date(normalized).getTime()) ? null : normalized;
};

const rowsOf = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["transactions", "operations", "items", "data"]) {
      if (Array.isArray(record[key])) return record[key] as unknown[];
    }
  }

  throw new StatementParseError("Не нашли список операций: ожидаем массив или поле transactions");
};

/**
 * Разбирает выгрузку банка в контракт `POST /imports`.
 * Строки без суммы или даты не выбрасываем молча — возвращаем причину.
 */
export const parseStatementJson = (content: string, fileName: string): ParseResult => {
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    throw new StatementParseError("Файл не похож на JSON");
  }

  const rows = rowsOf(payload);
  if (rows.length === 0) throw new StatementParseError("В файле нет операций");

  const slug = fileName.replace(/\.json$/i, "").replace(/[^\w-]+/g, "-").slice(0, 40) || "import";

  const transactions: ParsedTransaction[] = [];
  const skipped: ParseResult["skipped"] = [];

  rows.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      skipped.push({ row: index + 1, reason: "не объект" });
      return;
    }

    const row = item as Record<string, unknown>;
    const amount = toMinor(row);
    const occurredAt = toAware(row.occurred_at ?? row.occurredAt ?? row.date ?? row.timestamp);

    if (amount === null) {
      skipped.push({ row: index + 1, reason: "нет суммы" });
      return;
    }
    if (amount === 0) {
      skipped.push({ row: index + 1, reason: "нулевая сумма" });
      return;
    }
    if (!occurredAt) {
      skipped.push({ row: index + 1, reason: "нет даты" });
      return;
    }

    const category = text(row.category, 40);
    const merchant = text(row.merchant ?? row.vendor ?? row.payee, 200);
    const description = text(row.description ?? row.comment ?? row.purpose, 1000);

    transactions.push({
      external_id: text(row.external_id ?? row.externalId ?? row.id, 128) ?? `${slug}-${index + 1}`,
      amount_minor: amount,
      occurred_at: occurredAt,
      description: description ?? merchant ?? "Операция из файла",
      merchant,
      counterparty: text(row.counterparty ?? row.sender, 200),
      category: category && CATEGORIES.has(category) ? category : undefined,
    });
  });

  if (transactions.length === 0) {
    throw new StatementParseError("Ни одной операции с суммой и датой");
  }

  return { transactions, skipped };
};
