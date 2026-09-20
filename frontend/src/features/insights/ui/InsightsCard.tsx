import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { ArrowRight, RefreshCw, Sparkles } from "lucide-react";

import { CATEGORY_LABELS, financeApi, useFinance } from "@/entities/finance";
import { categoryIcon } from "@/entities/finance/ui/meta";
import { cn } from "@/shared/lib/utils";

/**
 * Разбор трат: бэкенд собирает советы по динамике периода
 * (моделью, если настроен DSLab, иначе по правилам над агрегатами).
 */
export const InsightsCard = () => {
  const { period, today } = useFinance();

  const advice = useQuery({
    queryKey: ["finance", "insights", period],
    queryFn: () => financeApi.getInsights(period, today),
    staleTime: 5 * 60_000,
    retry: false,
  });

  const insights = advice.data?.insights ?? [];

  return (
    <section className="px-5">
      <div className="flex items-center justify-between px-1 pb-2">
        <h2 className="flex items-center gap-1.5 text-[13px] text-fg-faint">
          <Sparkles className="size-3.5" />
          Разбор трат
        </h2>
        <button
          type="button"
          onClick={() => advice.refetch()}
          disabled={advice.isFetching}
          aria-label="Обновить советы"
          className="rounded-full p-1.5 text-fg-faint transition-colors hover:text-fg disabled:opacity-50"
        >
          <RefreshCw className={cn("size-3.5", advice.isFetching && "animate-spin")} />
        </button>
      </div>

      {advice.isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl border border-line bg-surface" />
          ))}
        </div>
      ) : advice.isError ? (
        <div className="rounded-2xl border border-line bg-surface px-4 py-5 text-center">
          <p className="text-[13.5px] text-fg-muted">Советы сейчас недоступны</p>
          <button
            type="button"
            onClick={() => advice.refetch()}
            className="mt-2 text-[13px] text-sage-strong"
          >
            Попробовать снова
          </button>
        </div>
      ) : insights.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line-strong px-4 py-5 text-center">
          <p className="text-[13.5px] text-fg-muted">Пока не за что зацепиться</p>
          <p className="mt-1 text-[12.5px] text-fg-faint">Появятся, когда наберётся динамика</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {insights.map((insight, index) => {
            const category = insight.category ? CATEGORY_LABELS[insight.category] : null;
            const Icon = (category && categoryIcon[category]) || Sparkles;

            return (
              <motion.li
                key={insight.title}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
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

                <p className="mt-3 flex items-start gap-2 border-t border-line pt-3 text-[13px] text-sage-strong">
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0" />
                  <span className="text-fg-muted">{insight.action}</span>
                </p>
              </motion.li>
            );
          })}
        </ul>
      )}

      {advice.data?.disclaimer ? (
        <p className="px-1 pt-2.5 text-[11.5px] leading-snug text-fg-faint">{advice.data.disclaimer}</p>
      ) : null}
    </section>
  );
};
