import { useRef, useState, type DragEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Check, FileJson, Upload } from "lucide-react";
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

const errorMessage = (error: unknown): string => {
  if (isAxiosError(error)) {
    const detail = (error.response?.data as { detail?: string } | undefined)?.detail;
    if (error.response?.status === 409) {
      return "Такие операции уже загружали, но в файле они отличаются — проверьте external_id";
    }
    if (detail) return detail;
    if (!error.response) return "Сервер не отвечает";
  }
  return "Не удалось загрузить операции";
};

type ImportStatementSheetProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Загрузка выписки в JSON без повторного онбординга:
 * разбираем файл на месте, показываем, что нашли, и только потом пишем.
 */
export const ImportStatementSheet = ({ open, onClose }: ImportStatementSheetProps) => {
  const { accounts } = useFinance();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResultDto | null>(null);
  const [dragging, setDragging] = useState(false);

  const target = accountId ?? accounts[0]?.id ?? null;

  const reset = () => {
    setFileName(null);
    setParsed(null);
    setResult(null);
    setAccountId(null);
    setDragging(false);
  };

  const close = () => {
    reset();
    onClose();
  };

  const takeFile = async (file: File | null | undefined) => {
    if (!file) return;

    setResult(null);
    setFileName(file.name);

    try {
      setParsed(parseStatementJson(await file.text(), file.name));
    } catch (error) {
      setParsed(null);
      toast.error(error instanceof StatementParseError ? error.message : "Не удалось прочитать файл");
    }
  };

  const importAll = useMutation({
    mutationFn: async () => {
      if (!parsed) throw new Error("Файл не выбран");

      /** Операциям нужен счёт: берём выбранный или заводим новый под импорт */
      const accountIdForRows =
        target ??
        (
          await financeApi.createAccount({
            external_id: `json-import-${Date.now()}`,
            bank: "tbank",
            name: "Импорт из файла",
            account_type: "card",
          })
        ).id;

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

      return totals;
    },
    onSuccess: (totals) => {
      setResult(totals);
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

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
              {parsed && fileName ? (
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage-dim text-sage-strong">
                    <FileJson className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-medium">{fileName}</span>
                    <span className="mt-0.5 block text-[12.5px] text-fg-faint">
                      {parsed.transactions.length} операций
                      {parsed.skipped.length > 0 ? ` · ${parsed.skipped.length} пропущено` : ""}
                    </span>
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
                  <span className="text-[14.5px] font-medium">Выбрать файл JSON</span>
                  <span className="px-4 text-center text-[12.5px] text-fg-faint">
                    Массив операций или объект с полем transactions
                  </span>
                </button>
              )}
            </div>

            <input
              ref={inputRef}
              type="file"
              accept="application/json,.json"
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

            {parsed && accounts.length > 1 ? (
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
              disabled={!parsed || importAll.isPending}
              onClick={() => importAll.mutate()}
              className="w-full rounded-2xl bg-sage px-4 py-3.5 text-[15px] font-semibold text-ink transition-opacity disabled:opacity-35"
            >
              {importAll.isPending
                ? "Загружаем…"
                : parsed
                  ? `Загрузить ${parsed.transactions.length} операций`
                  : "Загрузить"}
            </button>
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
