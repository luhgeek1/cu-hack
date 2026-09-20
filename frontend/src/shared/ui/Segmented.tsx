import { motion } from "motion/react";

import { cn } from "@/shared/lib/utils";

type SegmentedProps<T extends string> = {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  /** id нужен, чтобы подсветка не «перепрыгивала» между разными группами */
  layoutId: string;
  className?: string;
};

export const Segmented = <T extends string>({
  value,
  options,
  onChange,
  layoutId,
  className,
}: SegmentedProps<T>) => (
  <div className={cn("flex w-full items-center rounded-full bg-raised p-1", className)}>
    {options.map((option) => {
      const active = option.value === value;
      return (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "relative flex-1 rounded-full px-3.5 py-2 sm:py-2.5 text-[13px] sm:text-[13.5px] font-medium transition-colors whitespace-nowrap text-center select-none cursor-pointer",
            active ? "text-ink font-semibold" : "text-fg-muted hover:text-fg"
          )}
        >
          {active ? (
            <motion.span
              layoutId={layoutId}
              transition={{ type: "spring", stiffness: 500, damping: 40 }}
              className="absolute inset-0 rounded-full bg-sage"
            />
          ) : null}
          <span className="relative z-10">{option.label}</span>
        </button>
      );
    })}
  </div>
);
