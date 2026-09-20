import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Square } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";

import { cn } from "@/shared/lib/utils";

import {
  confirmVoice,
  getAccounts,
  previewVoice,
  voiceErrorMessage,
  type VoicePreview,
} from "../api/voice";
import { MAX_SECONDS, isRecordingSupported, useVoiceRecorder } from "../model/useVoiceRecorder";
import { VoiceSheet } from "./VoiceSheet";

const timer = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Кнопка голосового ввода: тап — начали говорить, тап — отправили.
 * Ничего не попадает в финансы, пока пользователь не подтвердит черновик.
 */
export const VoiceButton = () => {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<VoicePreview | null>(null);

  const accounts = useQuery({
    queryKey: ["finance", "accounts"],
    queryFn: getAccounts,
    staleTime: 5 * 60_000,
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const list =
        accounts.data ??
        (await queryClient.fetchQuery({ queryKey: ["finance", "accounts"], queryFn: getAccounts })) ??
        [];
      const account = list.find((item) => item.currency === "RUB") ?? list[0];
      if (!account) throw new Error("no-account");
      return previewVoice(account.id, file);
    },
    onSuccess: setPreview,
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message === "no-account"
          ? "Сначала подключите счёт — трату некуда записать"
          : voiceErrorMessage(error)
      );
    },
  });

  const confirm = useMutation({
    mutationFn: (matchedTransactionId: string | null) => {
      if (!preview) throw new Error("no-preview");
      return confirmVoice(preview.transaction, matchedTransactionId);
    },
    onSuccess: (result) => {
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      toast.success(result.matched_transaction_id ? "Операция уточнена" : "Трата записана");
    },
    onError: (error) => toast.error(voiceErrorMessage(error)),
  });

  const recorder = useVoiceRecorder({
    onResult: (file) => upload.mutate(file),
    onError: (message) => toast.error(message),
  });

  const busy = upload.isPending;

  const onClick = useCallback(() => {
    if (busy) return;
    if (recorder.isRecording) {
      recorder.stop();
      return;
    }
    setPreview(null);
    void recorder.start();
  }, [busy, recorder]);

  const retry = useCallback(() => {
    setPreview(null);
    void recorder.start();
  }, [recorder]);

  if (!isRecordingSupported()) return null;

  const label = recorder.isRecording
    ? "Остановить запись"
    : busy
      ? "Распознаём запись"
      : "Записать трату голосом";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] md:bottom-8 md:right-8 md:left-auto md:inset-x-auto z-40 flex justify-center md:justify-end">
        <div className="flex w-full max-w-[460px] md:max-w-none justify-end px-5 md:px-0">
          <div className="pointer-events-auto flex items-center gap-2.5">
            <AnimatePresence>
              {recorder.isRecording ? (
                <motion.span
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  className="tnum flex items-center gap-2 rounded-full border border-clay/40 bg-surface/95 px-3 py-1.5 text-[12.5px] text-fg-muted backdrop-blur-xl shadow-lg"
                >
                  <span className="size-1.5 animate-pulse rounded-full bg-clay" />
                  {timer(recorder.seconds)} / {timer(MAX_SECONDS)}
                </motion.span>
              ) : null}
            </AnimatePresence>

            <button
              type="button"
              onClick={onClick}
              disabled={busy}
              aria-label={label}
              aria-pressed={recorder.isRecording}
              className={cn(
                "relative flex items-center justify-center gap-2.5 rounded-full text-ink shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] transition-all active:scale-95 cursor-pointer",
                recorder.isRecording ? "bg-clay" : "bg-sage hover:bg-emerald-400 md:hover:shadow-emerald-500/20",
                "size-14 md:size-auto md:h-12 md:px-5",
                busy && "opacity-70"
              )}
            >
              {recorder.isRecording ? (
                <span className="absolute inset-0 animate-ping rounded-full bg-clay/40" />
              ) : null}
              {busy ? (
                <Loader2 className="size-5 md:size-5 animate-spin" strokeWidth={2} />
              ) : recorder.isRecording ? (
                <Square className="relative size-4 fill-current" strokeWidth={0} />
              ) : (
                <Mic className="size-5 md:size-5" strokeWidth={2.2} />
              )}
              <span className="hidden md:inline text-[13px] font-bold tracking-tight select-none">
                {recorder.isRecording ? "Остановить" : busy ? "Обработка..." : "Голосовой ввод"}
              </span>
            </button>
          </div>
        </div>
      </div>

      <VoiceSheet
        preview={preview}
        isPending={confirm.isPending}
        onConfirm={(matchedTransactionId) => confirm.mutate(matchedTransactionId)}
        onRetry={retry}
        onClose={() => setPreview(null)}
      />
    </>
  );
};
