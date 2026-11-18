import { motion } from "framer-motion";
import { useId } from "react";

import { CountUp } from "./CountUp";
import { cn } from "@/lib/utils";

/** Circular 0–100 gauge with the brand gradient stroke. */
export function ScoreGauge({
  value,
  size = 200,
  stroke = 14,
  label = "PulTikma Score",
  tone = "light",
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const arc = c * 0.75;
  const dark = tone === "dark";

  return (
    <div className={cn("relative", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[135deg]">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--brand-indigo)" />
            <stop offset="55%" stopColor="var(--brand-violet)" />
            <stop offset="100%" stopColor="var(--brand-cyan)" />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          className={dark ? "stroke-ink-foreground/10" : "stroke-muted"}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${arc} ${c}`}
          initial={{ strokeDashoffset: arc }}
          whileInView={{ strokeDashoffset: arc - (arc * value) / 100 }}
          viewport={{ once: true }}
          transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
          style={{ filter: "drop-shadow(0 0 10px color-mix(in oklab, var(--brand-violet) 55%, transparent))" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={cn("flex items-baseline font-semibold tracking-tight", dark ? "text-ink-foreground" : "text-foreground")} style={{ fontSize: size * 0.26 }}>
          <CountUp to={value} />
          <span className={cn("ml-0.5", dark ? "text-ink-muted" : "text-muted-foreground")} style={{ fontSize: size * 0.09 }}>
            /100
          </span>
        </div>
        <div className={cn("mt-1 text-xs font-medium uppercase tracking-[0.14em]", dark ? "text-ink-muted" : "text-muted-foreground")}>
          {label}
        </div>
      </div>
    </div>
  );
}
