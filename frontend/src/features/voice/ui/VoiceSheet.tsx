import { useEffect, useState } from "react";
import { Loader2, Mic } from "lucide-react";

import { dayMonth, money, time } from "@/shared/lib/format";
import { BottomSheet } from "@/shared/ui/BottomSheet";
import { cn } from "@/shared/lib/utils";

import { VOICE_CATEGORY_LABELS, type VoicePreview } from "../api/voice";

type VoiceSheetProps = {
  preview: VoicePreview | null;
  isPending: boolean;
  onConfirm: (matchedTransactionId: string | null) => void;
  onRetry: () => void;
  onClose: () => void;
};

/**
 * Распознанное показываем как черновик: пока пользователь не подтвердил,
 * на бэкенде ничего не записано.
 */
export const VoiceSheet = ({ preview, isPending, onConfirm, onRetry, onClose }: VoiceSheetProps) => {
  const candidate = preview?.candidate_transaction_ids[0] ?? null;
  const [attachToExisting, setAttachToExisting] = useState(Boolean(candidate));

  /** Новый черновик — заново решаем, уточняем мы операцию или добавляем */
  useEffect(() => setAttachToExisting(Boolean(candidate)), [candidate, preview?.transaction.external_id]);

  if (!preview) return <BottomSheet open={false} onClose={onClose} />;

  const { transaction, transcript } = preview;
  const rubles = transaction.amount_minor / 100;
  const isExpense = transaction.amount_minor < 0;
  const category = transaction.category ? VOICE_CATEGORY_LABELS[transaction.category] : null;
  const title = transaction.merchant || transaction.description || "Операция";

  return (
    <BottomSheet open onClose={onClose} title={isExpense ? "Записать трату?" : "Записать доход?"}>
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-2xl border border-line bg-raised px-4 py-3">
          <Mic className="mt-0.5 size-4 shrink-0 text-fg-faint" strokeWidth={1.8} />
          <p className="text-[13.5px] leading-snug text-fg-muted">«{transcript}»</p>
        </div>

        <div className="rounded-2xl border border-sage/40 bg-gradient-to-b from-sage-dim to-raised p-4">
          <p className="text-[13px] text-fg-muted">{isExpense ? "Трата" : "Доход"}</p>
          <p className="tnum mt-1 text-[30px] font-bold leading-none">{money(Math.abs(rubles))}</p>
          <p className="mt-2.5 truncate text-[15px] font-medium">{title}</p>
          <p className="mt-0.5 text-[12.5px] text-fg-faint">
            {dayMonth(transaction.occurred_at)}, {time(transaction.occurred_at)}
            {category ? ` · ${category}` : ""}
          </p>
        </div>

        {candidate ? (
          <div className="rounded-2xl border border-line bg-raised p-4">
            <p className="text-[13.5px] font-medium">Похоже, эта трата уже есть в выписке</p>
            <p className="mt-1 text-[12.5px] text-fg-muted">
              Можно уточнить её вашими словами — тогда вторая такая же трата не появится.
            </p>
            <div className="mt-3 flex gap-2">
              <Choice active={attachToExisting} onClick={() => setAttachToExisting(true)}>
                Уточнить её
              </Choice>
              <Choice active={!attachToExisting} onClick={() => setAttachToExisting(false)}>
                Добавить отдельно
              </Choice>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2 pb-1">
          <button
            type="button"
            onClick={onRetry}
            disabled={isPending}
            className="rounded-full border border-line-strong bg-surface px-4 py-3 text-[14px] font-medium text-fg-muted transition-colors hover:text-fg disabled:opacity-50"
          >
            Сказать ещё раз
          </button>
          <button
            type="button"
            onClick={() => onConfirm(attachToExisting ? candidate : null)}
            disabled={isPending}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-sage px-4 py-3 text-[14px] font-semibold text-ink transition-opacity disabled:opacity-60"
          >
            {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
            {attachToExisting && candidate ? "Уточнить" : "Записать"}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};

const Choice = ({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={cn(
      "flex-1 rounded-full border px-3 py-2 text-[13px] font-medium transition-colors",
      active ? "border-sage bg-sage-dim text-sage-strong" : "border-line-strong bg-surface text-fg-muted"
    )}
  >
    {children}
  </button>
);
