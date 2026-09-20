import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp } from "lucide-react";

import { useFinance } from "@/entities/finance";

/**
 * Единственное место, где продукт просит пользователя о действии.
 * Сверху — быстрые варианты в один тап, снизу — поле для своего ответа.
 */
export const AttentionCard = () => {
  const { needsAttention, resolve, resolveCustom } = useFinance();
  const current = needsAttention[0];
  const [draft, setDraft] = useState("");

  const submitCustom = () => {
    if (!current || !draft.trim()) return;
    resolveCustom(current.id, draft);
    setDraft("");
  };

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
          className="mx-0 overflow-hidden rounded-3xl border border-sage/40 bg-gradient-to-b from-sage-dim to-raised p-4"
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[12.5px] text-sage-strong">
              <span className="size-1.5 rounded-full bg-sage-strong" />
              Нужно решить
            </span>
            <span className="tnum text-[12.5px] text-fg-faint">
              {needsAttention.length > 1 ? `1 из ${needsAttention.length}` : "1"}
            </span>
          </div>

          <p className="mt-2.5 text-[17px] font-semibold leading-snug">{current.question}</p>
          <p className="mt-1 text-[13px] text-fg-muted">{current.subtitle}</p>

          <div className="no-scrollbar -mx-4 mt-3.5 flex gap-2 overflow-x-auto px-4">
            {current.options?.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setDraft("");
                  resolve(current.id, option.id);
                }}
                className="max-w-[62%] shrink-0 truncate rounded-full border border-line-strong bg-surface px-3.5 py-2.5 text-[13px] font-medium transition-colors hover:border-sage hover:text-sage-strong"
              >
                {option.label}
              </button>
            ))}
          </div>

          <form
            className="mt-3 flex items-center gap-2 rounded-full border border-line-strong bg-surface py-1.5 pl-4 pr-1.5 transition-colors focus-within:border-sage/60"
            onSubmit={(event) => {
              event.preventDefault();
              submitCustom();
            }}
          >
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Свой вариант"
              enterKeyHint="done"
              aria-label="Свой вариант ответа"
              className="min-w-0 flex-1 bg-transparent text-[13.5px] text-fg outline-none placeholder:text-fg-faint"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Сохранить свой вариант"
              className="grid size-8 shrink-0 place-items-center rounded-full bg-sage text-ink transition-opacity disabled:bg-line-strong disabled:text-fg-faint disabled:opacity-60"
            >
              <ArrowUp className="size-4" strokeWidth={2.5} />
            </button>
          </form>
        </motion.section>
      ) : null}
    </AnimatePresence>
  );
};
