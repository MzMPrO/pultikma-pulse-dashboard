import { motion } from "framer-motion";
import type { ComponentType, ReactNode } from "react";

import { CountUp } from "@/components/shared/CountUp";
import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  decimals = 0,
  suffix,
  text,
  hint,
  tone = "default",
  index = 0,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: number;
  decimals?: number;
  suffix?: ReactNode;
  text?: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "success" | "warning" | "danger";
  index?: number;
}) {
  const toneClass = {
    default: "bg-accent text-accent-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/20 text-warning",
    danger: "bg-danger/15 text-danger",
  }[tone];
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="group rounded-2xl border bg-card p-4 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className={cn("grid size-7 place-items-center rounded-lg", toneClass)}>
          <Icon className="size-3.5" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1 text-2xl font-semibold tracking-tight tabular-nums">
        {value !== undefined ? <CountUp to={value} decimals={decimals} /> : text}
        {suffix && <span className="text-sm font-medium text-muted-foreground">{suffix}</span>}
      </div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </motion.div>
  );
}
