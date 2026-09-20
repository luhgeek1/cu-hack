import React from "react";
import { cn } from "@/shared/lib/utils";

interface PalataLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "badge" | "inline" | "mark";
}

/**
 * Palata Logo inspired by Plata, rendered in our signature emerald neo-banking colors.
 * Features the iconic chevron "Λ" without the horizontal crossbar (P Λ L Λ T Λ).
 */
export const PalataLogo: React.FC<PalataLogoProps> = ({
  className = "",
  size = "md",
  variant = "badge",
}) => {
  const sizeConfig = {
    sm: {
      badge: "px-2.5 py-1 rounded-lg gap-1.5",
      text: "text-[12px] tracking-[0.16em]",
      markSize: "size-5 text-[11px]",
      svgHeight: 14,
    },
    md: {
      badge: "px-3.5 py-1.5 rounded-xl gap-2",
      text: "text-[15px] tracking-[0.2em]",
      markSize: "size-8 text-[14px]",
      svgHeight: 18,
    },
    lg: {
      badge: "px-5 py-2.5 rounded-2xl gap-2.5",
      text: "text-[20px] tracking-[0.24em]",
      markSize: "size-10 text-[18px]",
      svgHeight: 24,
    },
  }[size];

  // SVG representation of P Λ L Λ T Λ matching Plata typography with inverted V (no crossbar)
  const WordmarkSVG = ({ height = 18, fill = "#ffffff" }: { height?: number; fill?: string }) => (
    <svg
      height={height}
      viewBox="0 0 138 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="shrink-0 select-none overflow-visible"
    >
      {/* P */}
      <path
        d="M 2 24 L 2 0 L 11 0 C 17.5 0 20 3.5 20 7 C 20 10.5 17.5 14 11 14 L 6.5 14 L 6.5 24 Z M 6.5 4.5 L 6.5 9.5 L 10.5 9.5 C 13 9.5 15 8.5 15 7 C 15 5.5 13 4.5 10.5 4.5 Z"
        fill={fill}
      />
      {/* Λ (A without horizontal line) */}
      <path
        d="M 27 24 L 36 0 L 45 24 L 40.5 24 L 36 10 L 31.5 24 Z"
        fill={fill}
      />
      {/* L */}
      <path
        d="M 52 0 L 52 24 L 67 24 L 67 19.5 L 56.5 19.5 L 56.5 0 Z"
        fill={fill}
      />
      {/* Λ (A without horizontal line) */}
      <path
        d="M 74 24 L 83 0 L 92 24 L 87.5 24 L 83 10 L 78.5 24 Z"
        fill={fill}
      />
      {/* T */}
      <path
        d="M 97 0 L 114 0 L 114 4.5 L 108 4.5 L 108 24 L 103 24 L 103 4.5 L 97 4.5 Z"
        fill={fill}
      />
      {/* Λ (A without horizontal line) */}
      <path
        d="M 120 24 L 129 0 L 138 24 L 133.5 24 L 129 10 L 124.5 24 Z"
        fill={fill}
      />
    </svg>
  );

  // Mark only: the iconic chevron badge
  if (variant === "mark") {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center font-black bg-gradient-to-br from-emerald-500 via-emerald-600 to-emerald-800 text-white rounded-xl shadow-md shadow-emerald-600/30 select-none",
          sizeConfig.markSize,
          className
        )}
      >
        {/* Lambda glyph Λ */}
        <svg viewBox="0 0 24 24" className="size-4 fill-current">
          <path d="M 2 22 L 12 2 L 22 22 L 17 22 L 12 11 L 7 22 Z" />
        </svg>
      </div>
    );
  }

  // Inline wordmark without solid background
  if (variant === "inline") {
    return (
      <div className={cn("inline-flex items-center gap-2", className)}>
        <div
          className={cn(
            "flex items-center justify-center font-black bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-lg shadow-sm shadow-emerald-500/30",
            size === "sm" ? "size-6" : size === "lg" ? "size-9" : "size-7"
          )}
        >
          <svg viewBox="0 0 24 24" className="size-3.5 fill-current">
            <path d="M 2 22 L 12 2 L 22 22 L 17 22 L 12 11 L 7 22 Z" />
          </svg>
        </div>
        <WordmarkSVG height={sizeConfig.svgHeight} fill="#ffffff" />
      </div>
    );
  }

  // Plata-style badge container in our emerald brand colors
  return (
    <div
      className={cn(
        "inline-flex items-center font-bold bg-gradient-to-r from-emerald-600 via-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-600/25 border border-emerald-400/30 select-none",
        sizeConfig.badge,
        className
      )}
    >
      <WordmarkSVG height={sizeConfig.svgHeight} fill="#ffffff" />
    </div>
  );
};
