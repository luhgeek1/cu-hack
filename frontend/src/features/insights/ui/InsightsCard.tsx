import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, RotateCcw, Sparkles, Wand2 } from "lucide-react";

import { CATEGORY_LABELS, financeApi, useFinance } from "@/entities/finance";
import { categoryIcon } from "@/entities/finance/ui/meta";
import { money } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type Stage = "idle" | "running" | "done";

const PHASES = ["Читаем операции", "Ищем закономерности", "Собираем советы"];

/** Анимация должна успеть проиграться, даже если бэкенд ответил мгновенно */
const RUN_MS = PHASES.length * 700;

/**
 * Разбор трат по запросу: бэкенд собирает советы по динамике периода
 * (моделью, если настроен DSLab, иначе по правилам над агрегатами).
 */
export const InsightsCard = () => {
  const { period, today, summary } = useFinance();
  const [stage, setStage] = useState<Stage>("idle");
  const [phase, setPhase] = useState(0);
  const timers = useRef<number[]>([]);

  const advice = useQuery({
    queryKey: ["finance", "insights", period],
    queryFn: () => financeApi.getInsights(period, today),
    enabled: false,
    staleTime: 5 * 60_000,
    retry: false,
  });

  /** Смена периода сбрасывает разбор: советы были про другие числа */
  useEffect(() => {
    setStage("idle");
  }, [period]);

  useEffect(() => () => timers.current.forEach(window.clearTimeout), []);

  const run = () => {
    setStage("running");
    setPhase(0);

    timers.current.forEach(window.clearTimeout);
    timers.current = PHASES.map((_, index) =>
      window.setTimeout(() => setPhase(index), index * 700)
    );

    const finished = new Promise((resolve) => window.setTimeout(resolve, RUN_MS));
    Promise.all([advice.refetch(), finished]).then(() => setStage("done"));
  };

  const insights = advice.data?.insights ?? [];

  return (
    <section className="px-5 md:px-0">
      <h2 className="flex items-center gap-1.5 px-1 pb-2 text-[13px] text-fg-faint">
        <Sparkles className="size-3.5" />
        Разбор трат
      </h2>

      <AnimatePresence mode="wait">
        {stage === "idle" ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="rounded-3xl border border-line bg-surface p-5 text-center"
          >
            <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-sage-dim text-sage-strong">
              <Wand2 className="size-5" strokeWidth={1.8} />
            </span>
            <p className="mt-3 text-[15px] font-semibold">Где деньги уходят зря</p>
            <p className="mt-1 text-[13px] text-fg-muted">
              Посмотрим {money(summary.realExpense)} за {summary.label} и предложим, что поправить
            </p>
            <button
              type="button"
              onClick={run}
              className="mt-4 w-full rounded-2xl bg-sage px-4 py-3.5 text-[15px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Оптимизировать мои траты
            </button>
          </motion.div>
        ) : null}

        {stage === "running" ? (
          <motion.div
            key="running"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden rounded-3xl border border-sage/30 bg-surface p-5"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex size-12 shrink-0 items-center justify-center">
                <motion.span
                  className="absolute inset-0 rounded-2xl border border-sage/40"
                  animate={{ scale: [1, 1.18, 1], opacity: [0.9, 0.2, 0.9] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="flex size-12 items-center justify-center rounded-2xl bg-sage-dim text-sage-strong">
                  <Sparkles className="size-5" strokeWidth={1.8} />
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <AnimatePresence mode="wait">
                  {/* Подпись и счётчик меняются одним блоком, иначе они расходятся */}
                  <motion.div
                    key={phase}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25 }}
                  >
                    <p className="text-[15px] font-medium">{PHASES[phase]}</p>
                    <p className="mt-1 text-[12.5px] text-fg-faint">
                      Шаг {phase + 1} из {PHASES.length}
                    </p>
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            {/* Полосы «сканируются» слева направо, пока идёт разбор */}
            <div className="mt-5 space-y-2.5">
              {[0, 1, 2].map((index) => (
                <div key={index} className="relative h-3 overflow-hidden rounded-full bg-raised">
                  <motion.div
                    className="absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-sage/60 to-transparent"
                    initial={{ x: "-120%" }}
                    animate={{ x: "320%" }}
                    transition={{
                      duration: 1.3,
                      repeat: Infinity,
                      ease: "linear",
                      delay: index * 0.18,
                    }}
                  />
                </div>
              ))}
            </div>
          </motion.div>
        ) : null}

        {stage === "done" ? (
          <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
            {advice.isError ? (
              <div className="rounded-3xl border border-line bg-surface px-4 py-6 text-center">
                <p className="text-[13.5px] text-fg-muted">Разбор не получился</p>
                <button type="button" onClick={run} className="mt-2 text-[13px] text-sage-strong">
                  Попробовать снова
                </button>
              </div>
            ) : insights.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-line-strong px-4 py-6 text-center">
                <p className="text-[13.5px] text-fg-muted">Пока не за что зацепиться</p>
                <p className="mt-1 text-[12.5px] text-fg-faint">Советы появятся, когда наберётся динамика</p>
              </div>
            ) : (
              insights.map((insight, index) => {
                const category = insight.category ? CATEGORY_LABELS[insight.category] : null;
                const Icon = (category && categoryIcon[category]) || Sparkles;

                return (
                  <motion.article
                    key={insight.title}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    className="rounded-2xl border border-line bg-surface p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sage-dim text-sage-strong">
                        <Icon className="size-4" strokeWidth={1.9} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-semibold leading-snug">{insight.title}</p>
                        <p className="mt-1 text-[13.5px] leading-snug text-fg-muted">{insight.message}</p>
                      </div>
                    </div>

                    <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[13px]">
                      <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-sage-strong" />
                      <span className="text-fg-muted">{insight.action}</span>
                    </p>
                  </motion.article>
                );
              })
            )}

            <button
              type="button"
              onClick={run}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl border border-line",
                "bg-surface px-4 py-3 text-[13.5px] text-fg-muted transition-colors hover:text-fg"
              )}
            >
              <RotateCcw className="size-3.5" />
              Разобрать заново
            </button>

            {advice.data?.disclaimer ? (
              <p className="px-1 pt-1 text-[11.5px] leading-snug text-fg-faint">{advice.data.disclaimer}</p>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
};
