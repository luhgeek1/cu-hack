import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Check, Loader2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";

type ProcessingStepsProps = {
  steps: string[];
  /** Сколько держим каждый шаг, мс */
  pace?: number;
  onDone: () => void;
};

/** Экран ожидания: видно, что именно сейчас делает движок */
export const ProcessingSteps = ({ steps, pace = 750, onDone }: ProcessingStepsProps) => {
  const [done, setDone] = useState(0);

  // Колбэк держим в ref: иначе новый инлайн-обработчик родителя сбрасывал таймер шага
  const finishRef = useRef(onDone);
  finishRef.current = onDone;

  useEffect(() => {
    if (done >= steps.length) {
      const finish = window.setTimeout(() => finishRef.current(), 500);
      return () => window.clearTimeout(finish);
    }

    const next = window.setTimeout(() => setDone((current) => current + 1), pace);
    return () => window.clearTimeout(next);
  }, [done, steps.length, pace]);

  return (
    <ul className="space-y-1">
      {steps.map((step, index) => {
        const complete = index < done;
        const active = index === done;
        return (
          <li
            key={step}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-4 py-3.5 transition-colors",
              active ? "bg-raised" : "bg-transparent"
            )}
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border",
                complete
                  ? "border-sage bg-sage text-white"
                  : active
                    ? "border-line-strong text-fg-muted"
                    : "border-line text-fg-faint"
              )}
            >
              {complete ? (
                <motion.span initial={{ scale: 0.5 }} animate={{ scale: 1 }}>
                  <Check className="size-3.5" strokeWidth={3} />
                </motion.span>
              ) : active ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : null}
            </span>
            <span
              className={cn(
                "text-[14.5px] transition-colors",
                complete ? "text-fg-muted" : active ? "text-fg" : "text-fg-faint"
              )}
            >
              {step}
            </span>
          </li>
        );
      })}
    </ul>
  );
};
