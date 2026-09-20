import { motion } from "motion/react";
import { ChevronRight } from "lucide-react";

import type { PeriodSummary } from "@/entities/finance";
import { money, percent } from "@/shared/lib/format";

type ReconcileStripProps = {
  summary: PeriodSummary;
  onExplain: () => void;
};

/** Две полосы: сколько списал банк и какая часть — настоящие траты */
export const ReconcileStrip = ({ summary, onExplain }: ReconcileStripProps) => {
  const share = summary.bankSpent > 0 ? summary.realExpense / summary.bankSpent : 0;

  return (
    <button
      type="button"
      onClick={onExplain}
      className="w-full rounded-3xl border border-line bg-surface p-4 text-left transition-colors hover:border-line-strong"
    >
      <div className="space-y-3">
        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="text-fg-faint">Банк списал</span>
            <span className="tnum text-fg-muted">{money(summary.bankSpent)}</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-line-strong" />
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
            <span className="text-fg">Из них ваши</span>
            <span className="tnum text-fg">{percent(share)}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-raised">
            <motion.div
              className="h-full origin-left rounded-full bg-sage"
              style={{ width: `${Math.min(share, 1) * 100}%` }}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </div>

      <span className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px]">
        <span className="text-fg-muted">
          Лишнее <span className="tnum text-fg">{money(summary.excluded)}</span>
        </span>
        <span className="flex items-center gap-0.5 text-sage-strong">
          Почему
          <ChevronRight className="size-3.5" />
        </span>
      </span>
    </button>
  );
};
