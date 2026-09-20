import { useCallback, useRef, useState, type DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { Check, FileText, Upload } from "lucide-react";

import { useAuth } from "@/app/providers/auth/useAuth";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { financeApi, useFinance } from "@/entities/finance";
import type { ImportResultDto } from "@/entities/finance/api/dto";
import { markOnboarded } from "@/features/onboarding/model/storage";
import { OnboardingArtwork } from "@/features/auth/ui/OnboardingArtwork";
import { ProcessingSteps } from "@/features/onboarding/ui/ProcessingSteps";
import { money } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type Step = "upload" | "reading" | "services" | "parsing" | "done";

const STEP_INDEX: Record<Step, number> = {
  upload: 1,
  reading: 2,
  services: 3,
  parsing: 4,
  done: 4,
};

const SERVICES = [
  { id: "wb", name: "Wildberries", color: "#cb11ab", ink: "#ffffff", short: "WB" },
  { id: "ozon", name: "Ozon", color: "#005bff", ink: "#ffffff", short: "O" },
  { id: "market", name: "Яндекс Маркет", color: "#ffdb4d", ink: "#0b0c0e", short: "Я" },
];

const DEMO_FILE = "vypiska-sentyabr.pdf";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const auth = useAuth();
  const queryClient = useQueryClient();
  const { today, summary } = useFinance();
  const [result, setResult] = useState<ImportResultDto | null>(null);

  /** Честно показываем, что маркетплейсы — импорт файлов, а не живая синхронизация */
  const integrations = useQuery({
    queryKey: ["finance", "integrations"],
    queryFn: financeApi.getIntegrations,
    staleTime: 60_000,
  });

  /** Выписка: заводим счёт под импорт и отправляем PDF */
  const importStatement = useMutation({
    mutationFn: async (file: File) => {
      const account = await financeApi.createAccount({
        external_id: `statement-${Date.now()}`,
        bank: "tbank",
        name: "Выписка Т-Банка",
        account_type: "card",
      });
      return financeApi.importStatement(account.id, file);
    },
    onSuccess: (statement) => {
      setResult(statement.import_result);
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setStep("services");
    },
    onError: (error: unknown) => {
      const detail =
        (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
        "Не удалось разобрать выписку";
      toast.error(detail);
      setStep("upload");
    },
  });

  /** Демо-набор: четыре банка одним запросом, идемпотентно */
  const loadDemo = useMutation({
    mutationFn: () => financeApi.loadDemo(today),
    onSuccess: (importResult) => {
      setResult(importResult);
      queryClient.invalidateQueries({ queryKey: ["finance"] });
      setStep("services");
    },
    onError: () => {
      toast.error("Не удалось загрузить демо-данные");
      setStep("upload");
    },
  });

  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [services, setServices] = useState<string[]>(["ozon"]);
  const inputRef = useRef<HTMLInputElement>(null);

  const takeFile = (selected: File | null | undefined) => {
    if (!selected) return;
    setFile(selected);
    setFileName(selected.name);
    setFileSize(selected.size);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    takeFile(event.dataTransfer.files?.[0]);
  };

  const finish = useCallback(() => {
    markOnboarded(auth?.user?.email as string | undefined);
    navigate("/", { replace: true });
  }, [auth?.user?.email, navigate]);

  return (
    <div className="min-h-dvh overflow-x-clip bg-ink">
      <div className="relative isolate mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-5 pb-8 safe-top">
        <OnboardingArtwork />
        <div className="flex items-center gap-3 pb-6 pt-1">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-raised">
            <motion.div
              className="h-full rounded-full bg-sage"
              animate={{ width: `${(STEP_INDEX[step] / 4) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
          <span className="tnum text-[12px] text-fg-faint">{STEP_INDEX[step]}/4</span>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="flex flex-1 flex-col"
          >
            {step === "upload" ? (
              <>
                <h1 className="text-[24px] font-bold leading-tight -tracking-[0.02em]">
                  Загрузите выписку
                </h1>
                <p className="mt-2 text-[14px] text-fg-muted">
                  PDF из интернет-банка за последний месяц
                </p>

                <div
                  data-art-occluder
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  className={cn(
                    "mt-6 rounded-3xl border border-dashed p-6 transition-colors",
                    dragging ? "border-sage bg-sage-dim/40" : "border-line-strong bg-surface"
                  )}
                >
                  {fileName ? (
                    <div className="flex items-center gap-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-sage-dim text-sage-strong">
                        <FileText className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-medium">{fileName}</span>
                        <span className="mt-0.5 block text-[12.5px] text-fg-faint">
                          {fileSize ? `${Math.max(1, Math.round(fileSize / 1024))} КБ` : "демо-выписка"}
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
                      className="flex w-full flex-col items-center gap-3 py-6"
                    >
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-raised text-fg-muted">
                        <Upload className="size-5" />
                      </span>
                      <span className="text-[14.5px] font-medium">Выбрать файл</span>
                      <span className="text-[12.5px] text-fg-faint">Т-Банк, Сбер, Альфа — любой банк</span>
                    </button>
                  )}
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(event) => {
                    takeFile(event.target.files?.[0]);
                    event.target.value = "";
                  }}
                />

                <div className="mt-auto space-y-2 pt-8">
                  <button
                    type="button"
                    disabled={!file}
                    onClick={() => {
                      if (!file) return;
                      setStep("reading");
                      importStatement.mutate(file);
                    }}
                    className="w-full rounded-2xl bg-sage px-4 py-4 text-[15px] font-semibold text-white transition-opacity disabled:opacity-35"
                  >
                    Продолжить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFileName(DEMO_FILE);
                      setFileSize(null);
                      setStep("reading");
                      loadDemo.mutate();
                    }}
                    className="w-full py-2 text-[13.5px] text-fg-muted transition-colors hover:text-fg"
                  >
                    Взять демо-выписку
                  </button>
                </div>
              </>
            ) : null}

            {step === "reading" ? (
              <>
                <h1 className="text-[24px] font-bold leading-tight -tracking-[0.02em]">
                  Читаем выписку
                </h1>
                <p className="mt-2 truncate text-[14px] text-fg-muted">{fileName}</p>

                <div className="mt-6 w-full">
                  <ProcessingSteps
                    steps={["Открываем PDF", "Находим операции", "Приводим к одному формату"]}
                    onDone={() => setStep("services")}
                  />
                </div>
              </>
            ) : null}

            {step === "services" ? (
              <>
                <h1 className="text-[24px] font-bold leading-tight -tracking-[0.02em]">
                  Где вы покупаете
                </h1>
                <p className="mt-2 text-[14px] text-fg-muted">
                  Свяжем пополнения карт с покупками внутри сервиса
                </p>

                <ul className="mt-6 space-y-2">
                  {SERVICES.map((service) => {
                    const active = services.includes(service.id);
                    return (
                      <li key={service.id}>
                        <button
                          type="button"
                          onClick={() =>
                            setServices((current) =>
                              current.includes(service.id)
                                ? current.filter((id) => id !== service.id)
                                : [...current, service.id]
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors",
                            active ? "border-sage/50 bg-sage-dim/40" : "border-line bg-surface"
                          )}
                        >
                          <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-2xl text-[14px] font-bold"
                            style={{ backgroundColor: service.color, color: service.ink }}
                          >
                            {service.short}
                          </span>
                          <span className="flex-1 text-[15px] font-medium">{service.name}</span>
                          <span
                            className={cn(
                              "flex size-6 items-center justify-center rounded-full border transition-colors",
                              active ? "border-sage bg-sage text-white" : "border-line-strong"
                            )}
                          >
                            {active ? <Check className="size-3.5" strokeWidth={3} /> : null}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-auto space-y-2 pt-8">
                  <button
                    type="button"
                    onClick={() => setStep("parsing")}
                    className="w-full rounded-2xl bg-sage px-4 py-4 text-[15px] font-semibold text-white"
                  >
                    Продолжить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setServices([]);
                      setStep("parsing");
                    }}
                    className="w-full py-2 text-[13.5px] text-fg-muted transition-colors hover:text-fg"
                  >
                    Пропустить
                  </button>
                </div>
              </>
            ) : null}

            {step === "parsing" ? (
              <>
                <h1 className="text-[24px] font-bold leading-tight -tracking-[0.02em]">
                  Собираем события
                </h1>
                <p className="mt-2 text-[14px] text-fg-muted">
                  Из операций восстанавливаем, что произошло на самом деле
                </p>

                <div className="mt-6 w-full">
                  <ProcessingSteps
                    pace={850}
                    steps={[
                      "Связываем переводы между счетами",
                      "Находим возвраты и общие счета",
                      "Считаем реальные траты",
                      "Отмечаем, что нужно уточнить",
                    ]}
                    onDone={() => setStep("done")}
                  />
                </div>
              </>
            ) : null}

            {step === "done" ? (
              <>
                <span className="flex size-12 items-center justify-center rounded-2xl bg-sage-dim text-sage-strong">
                  <Check className="size-6" strokeWidth={2.5} />
                </span>
                <h1 className="mt-4 text-[24px] font-bold leading-tight -tracking-[0.02em]">
                  Выписка разобрана
                </h1>

                <div data-art-occluder className="mt-6 rounded-3xl border border-line bg-surface p-5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[13px] text-fg-muted">Банк списал</span>
                    <span className="tnum text-[15px] text-fg-muted">{money(summary.bankSpent)}</span>
                  </div>
                  <div className="mt-3 flex items-baseline justify-between">
                    <span className="text-[13px] text-fg">Ваши траты</span>
                    <span className="tnum text-[22px] font-bold">{money(summary.realExpense)}</span>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-raised">
                    <motion.div
                      className="h-full origin-left rounded-full bg-sage"
                      style={{
                        width: `${summary.bankSpent > 0 ? (summary.realExpense / summary.bankSpent) * 100 : 0}%`,
                      }}
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>

                <div className="mt-2 grid grid-cols-3 gap-2">
                  <Tile value={String(result?.imported_count ?? 0)} label="операций" />
                  <Tile value={String(result?.event_count ?? 0)} label="событий" />
                  <Tile value={String(result?.needs_attention_count ?? 0)} label="уточнить" tone="brass" />
                </div>

                <div className="mt-auto pt-8">
                  <button
                    type="button"
                    onClick={finish}
                    className="w-full rounded-2xl bg-sage px-4 py-4 text-[15px] font-semibold text-white"
                  >
                    Открыть месяц
                  </button>
                </div>
              </>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

const Tile = ({ value, label, tone }: { value: string; label: string; tone?: "brass" }) => (
  <div className="rounded-2xl border border-line bg-surface px-3 py-3 text-center">
    <p className={cn("tnum text-[18px] font-bold", tone === "brass" && "text-brass")}>{value}</p>
    <p className="mt-0.5 text-[11.5px] text-fg-faint">{label}</p>
  </div>
);
