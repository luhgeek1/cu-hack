import { useEffect } from "react";
import { animate, motion, useMotionValue, useTransform } from "motion/react";

import { money } from "@/shared/lib/format";
import { cn } from "@/shared/lib/utils";

type AnimatedMoneyProps = {
  value: number;
  className?: string;
  sign?: boolean;
};

/** Цифра доезжает до нового значения — так виден сам факт пересчёта */
export const AnimatedMoney = ({ value, className, sign }: AnimatedMoneyProps) => {
  const motionValue = useMotionValue(value);
  const text = useTransform(motionValue, (current) => money(current, { sign }));

  useEffect(() => {
    const controls = animate(motionValue, value, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
    });
    return () => controls.stop();
  }, [motionValue, value]);

  return <motion.span className={cn("tnum", className)}>{text}</motion.span>;
};
