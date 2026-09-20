import { AnimatePresence, motion } from "motion/react";

import { useFinance } from "@/entities/finance";

/**
 * Единственное место, где продукт просит пользователя о действии.
 * Один вопрос за раз, ответ — в один тап, пересчёт сразу.
 */
export const AttentionCard = () => {
  const { needsAttention, resolve } = useFinance();
  const current = needsAttention[0];

  return (
    <AnimatePresence mode="popLayout">
      {current ? (
        <motion.section
          key={current.id}
          layout
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 380, damping: 34 }}
          className="mx-5 rounded-3xl border border-brass/25 bg-brass-dim/50 p-4"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12.5px] text-brass">
              <span className="size-1.5 rounded-full bg-brass" />
              Нужно решить
            </span>
            <span className="tnum text-[12.5px] text-fg-faint">
              {needsAttention.length > 1 ? `1 из ${needsAttention.length}` : "1"}
            </span>
          </div>

          <p className="mt-2.5 text-[17px] font-semibold leading-snug">{current.question}</p>
          <p className="mt-1 text-[13px] text-fg-muted">{current.subtitle}</p>

          <div className="mt-3.5 flex flex-wrap gap-2">
            {current.options?.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => resolve(current.id, option.id)}
                className="rounded-full border border-line-strong bg-surface px-4 py-2.5 text-[13.5px] font-medium transition-colors hover:border-sage hover:text-sage-strong"
              >
                {option.label}
              </button>
            ))}
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};
