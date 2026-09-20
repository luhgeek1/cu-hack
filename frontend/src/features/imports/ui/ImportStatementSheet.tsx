import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Check, FileText, Upload } from "lucide-react";
import { toast } from "sonner";

import { financeApi, useFinance } from "@/entities/finance";
import type { ImportResultDto } from "@/entities/finance/api/dto";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

import {
  StatementParseError,
  parseStatementJson,
  type ParseResult,
} from "../model/parseStatementJson";

/** Бэкенд принимает не больше 2000 операций за запрос */
const BATCH = 2000;

const isJson = (file: File) => /\.json$/i.test(file.name) || file.type === "application/json";

/** Ответы бэкенда приходят по-английски — показываем человеку понятное */
const DETAILS: Record<string, string> = {
  "Unsupported statement format: expected T-Bank movement statement":
    "Это не похоже на справку о движении средств Т-Банка",
  "Upload a PDF or extracted UTF-8 .txt statement": "Нужен PDF или .txt с текстом выписки",
  "Expected a PDF file": "Нужен PDF",
  "Cannot read PDF: upload an unencrypted, text-based bank statement":
    "PDF не читается: нужен незащищённый файл с текстом, а не скан",
  "Statement totals missing: upload all pages including the last page":
    "Не хватает итогов — загрузите все страницы, включая последнюю",
  "Statement account or period is missing": "В файле нет номера счёта или периода",
  "Statement must contain 1–10000 operations": "В выписке должно быть от 1 до 10 000 операций",
  "Statement text is too large": "Выписка слишком большая",
  "Text must be UTF-8": "Текст должен быть в UTF-8",
  "Account not found": "Счёт не найден",
};

const errorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (error.response?.status === 409) {
      return "Эти операции уже загружали, но в файле они отличаются";
    }
    if (error.response?.status === 413) return "Файл больше 20 МБ";
    if (detail) return DETAILS[detail] ?? detail;
    if (!error.response) return "Сервер не отвечает";
  }
  return "Не удалось разобрать выписку";
};

type ImportStatementSheetProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Новая выписка без повторного онбординга: PDF уходит в разбор на бэкенд,
 * данные пересобираются, экраны обновляются сами.
 */
export const ImportStatementSheet = ({ open, onClose }: ImportStatementSheetProps) => {
  const { accounts, setPeriod, setAnchor } = useFinance();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResultDto | null>(null);
  const [dragging, setDragging] = useState(false);

  const target = accountId ?? accounts[0]?.id ?? null;

  const reset = () => {
    setFile(null);
    setParsed(null);
    setResult(null);
    setAccountId(null);
    setDragging(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const takeFile = async (selected: File | null | undefined) => {
    if (!selected) return;

    setResult(null);
    setFile(selected);
    setParsed(null);

    /** JSON разбираем на месте — по нему сразу видно, сколько операций нашли */
    if (isJson(selected)) {
      try {
        setParsed(parseStatementJson(await selected.text(), selected.name));
      } catch (error) {
        setFile(null);
        toast.error(error instanceof StatementParseError ? error.message : "Не удалось прочитать файл");
      }
    }
  };

  const importFile = useMutation({
    /** Кроме итогов возвращаем дату последней операции: на неё переводим экраны */
    mutationFn: async (): Promise<{ totals: ImportResultDto; lastDate: string | null }> => {
      if (!file) throw new Error("Файл не выбран");

      /** Выписку нужно куда-то положить: берём выбранный счёт или заводим новый */
      const accountIdForRows =
        target ??
        (
          await financeApi.createAccount({
            external_id: `statement-${Date.now()}`,
            bank: "tbank",
            name: "Выписка",
            account_type: "card",
          })
        ).id;

      if (!parsed) {
        const statement = await financeApi.importStatement(accountIdForRows, file);
        return { totals: statement.import_result, lastDate: statement.statement.end_date };
      }

      const rows = parsed.transactions.map((item) => ({
        ...item,
        account_id: accountIdForRows,
        source: "manual",
      }));

      const totals: ImportResultDto = {
        imported_count: 0,
        duplicate_count: 0,
        event_count: 0,
        needs_attention_count: 0,
        synced_at: new Date().toISOString(),
      };

      for (let index = 0; index < rows.length; index += BATCH) {
        const part = await financeApi.importTransactions(rows.slice(index, index + BATCH));
        totals.imported_count += part.imported_count;
        totals.duplicate_count += part.duplicate_count;
        totals.event_count += part.event_count;
        totals.needs_attention_count += part.needs_attention_count;
        totals.synced_at = part.synced_at;
      }

      const lastDate = rows.reduce<string | null>(
        (latest, row) => (!latest || row.occurred_at > latest ? row.occurred_at : latest),
        null
      );

      return { totals, lastDate };
    },
    onSuccess: ({ totals, lastDate }) => {
      setResult(totals);
      // Выписка обычно за прошедший период — иначе экраны останутся пустыми
      if (lastDate) {
        setPeriod("month");
        setAnchor(new Date(lastDate));
      }
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const sizeLabel = file ? `${Math.max(1, Math.round(file.size / 1024))} КБ` : "";
  const hint = parsed ? `${parsed.transactions.length} операций · ${sizeLabel}` : sizeLabel;

  return (
    <BottomSheet open={open} onClose={close} title="Новая выписка">
      <div className="space-y-4">
        {result ? (
          <>
            <div className="flex items-center gap-3 rounded-2xl border border-sage/35 bg-gradient-to-b from-sage-dim/70 to-raised p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sage text-ink">
                <Check className="size-5" strokeWidth={2.5} />
              </span>
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">Выписка разобрана</p>
                <p className="mt-0.5 text-[12.5px] text-fg-muted">Итоги пересчитаны по всем экранам</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Tile value={result.imported_count} label="операций" />
              <Tile value={result.event_count} label="событий" />
              <Tile value={result.duplicate_count} label="дубликатов" />
              <Tile value={result.needs_attention_count} label="уточнить" />
            </div>

            <button
              type="button"
              onClick={close}
              className="w-full rounded-2xl bg-sage px-4 py-3.5 text-[15px] font-semibold text-ink"
            >
              Готово
            </button>
          </>
        ) : (
          <>
            <div
              onDragOver={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event: DragEvent<HTMLDivElement>) => {
                event.preventDefault();
                setDragging(false);
                void takeFile(event.dataTransfer.files?.[0]);
              }}
              className={cn(
                "rounded-2xl border border-dashed p-5 transition-colors",
                dragging ? "border-sage bg-sage-dim/40" : "border-line-strong bg-raised"
              )}
            >
              {file ? (
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage-dim text-sage-strong">
                    <FileText className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{file.name}</span>
                    <span className="mt-0.5 block text-[12.5px] text-fg-faint">{hint}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="shrink-0 text-[13px] text-fg-muted transition-colors hover:text-fg"
                  >
                    Заменить
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="flex w-full flex-col items-center gap-2.5 py-4"
                >
                  <span className="flex size-12 items-center justify-center rounded-2xl bg-surface text-fg-muted">
                    <Upload className="size-5" />
                  </span>
                  <span className="text-[14.5px] font-medium">Выбрать файл PDF</span>
                  <span className="px-4 text-center text-[12.5px] text-fg-faint">
                    Справка о движении средств из интернет-банка
                  </span>
                </button>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="application/pdf,.pdf,.txt,.json"
              className="hidden"
              onChange={(event) => {
                void takeFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            {parsed && parsed.skipped.length > 0 ? (
              <p className="px-1 text-[12.5px] text-fg-faint">
                Пропустили строки без суммы или даты:{" "}
                {parsed.skipped
                  .slice(0, 3)
                  .map((item) => `№${item.row} (${item.reason})`)
                  .join(", ")}
                {parsed.skipped.length > 3 ? ` и ещё ${parsed.skipped.length - 3}` : ""}
              </p>
            ) : null}

            {file && accounts.length > 1 ? (
              <div>
                <p className="px-1 pb-2 text-[12.5px] text-fg-faint">На какой счёт записать</p>
                <div className="no-scrollbar flex gap-2 overflow-x-auto">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      onClick={() => setAccountId(account.id)}
                      className={cn(
                        "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
                        target === account.id
                          ? "border-sage bg-sage-dim text-sage-strong"
                          : "border-line-strong bg-surface text-fg-muted"
                      )}
                    >
                      {account.bankName}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <button
              type="button"
              disabled={!file || importFile.isPending}
              onClick={() => importFile.mutate()}
              className="w-full rounded-2xl bg-sage px-4 py-3.5 text-[15px] font-semibold text-ink transition-opacity disabled:opacity-35"
            >
              {importFile.isPending ? "Читаем выписку…" : "Загрузить"}
            </button>

            <p className="px-1 text-center text-[11.5px] text-fg-faint">
              PDF до 20 МБ · также примем .txt с текстом выписки или .json с операциями
            </p>
          </>
        )}
      </div>
    </BottomSheet>
  );
};

const Tile = ({ value, label }: { value: number; label: string }) => (
  <div className="rounded-2xl border border-line bg-raised px-3 py-3 text-center">
    <p className="tnum text-[18px] font-bold">{value}</p>
    <p className="mt-0.5 text-[11.5px] text-fg-faint">{label}</p>
  </div>
);
