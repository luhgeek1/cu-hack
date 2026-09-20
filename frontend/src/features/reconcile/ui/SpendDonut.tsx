import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

import type { PeriodSummary } from "@/entities/finance";
import { money, percent } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

/** Чем больше доля категории, тем зеленее сегмент; хвост уходит в графит */
const RAMP = ["#059669", "#0b7a5e", "#3f7a67", "#5b6169", "#7d848c", "#a9b0b7"];

type SpendDonutProps = {
  summary: PeriodSummary;
};

export const SpendDonut = ({ summary }: SpendDonutProps) => {
  const [selected, setSelected] = useState<number | null>(null);

  const top = summary.categories.slice(0, 5);
  const restAmount = summary.categories.slice(5).reduce((sum, row) => sum + row.amount, 0);
  const slices = [
    ...top,
    ...(restAmount > 0
      ? [{ category: "Другое" as const, amount: restAmount, share: restAmount / summary.realExpense }]
      : []),
  ];

  const current = selected !== null ? slices[selected] : null;

  if (summary.realExpense === 0) {
    return (
      <div className="rounded-3xl border border-line bg-surface p-8 text-center">
        <p className="text-[14px] text-fg-muted">Трат за этот период нет</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-surface p-4">
      <div className="relative mx-auto aspect-square w-full max-w-[268px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="amount"
              cx="50%"
              cy="50%"
              innerRadius="72%"
              outerRadius="98%"
              paddingAngle={2.5}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              isAnimationActive={false}
              onClick={(_, index) => setSelected(selected === index ? null : index)}
            >
              {slices.map((slice, index) => (
                <Cell
                  key={slice.category}
                  fill={RAMP[index % RAMP.length]}
                  opacity={selected !== null && selected !== index ? 0.28 : 1}
                  className="cursor-pointer transition-opacity duration-200"
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <button
          type="button"
          onClick={() => setSelected(null)}
          className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center"
        >
          <span className="text-[12px] text-fg-muted">{current ? current.category : "Ваши траты"}</span>
          <span className="tnum mt-0.5 text-[28px] font-bold leading-tight">
            {money(current ? current.amount : summary.realExpense)}
          </span>
          <span className="mt-0.5 text-[12px] font-medium text-sage-strong">
            {current ? `${percent(current.share)} трат` : `${money(summary.excluded)} не ваши`}
          </span>
        </button>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-1.5 border-t border-line pt-3">
        {slices.map((slice, index) => (
          <button
            key={slice.category}
            type="button"
            onClick={() => setSelected(selected === index ? null : index)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-xl border px-2.5 py-2 transition-colors",
              selected === index ? "border-line-strong bg-raised" : "border-transparent hover:bg-raised/60"
            )}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ backgroundColor: RAMP[index % RAMP.length] }}
              />
              <span className="truncate text-[12.5px]">{slice.category}</span>
            </span>
            <span className="tnum shrink-0 text-[11.5px] text-fg-faint">{percent(slice.share)}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
