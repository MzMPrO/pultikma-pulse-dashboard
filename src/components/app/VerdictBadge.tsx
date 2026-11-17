import { CircleCheck, CircleAlert, CircleX } from "lucide-react";

import type { RiskLevel, Verdict } from "@/lib/engine";
import { cn } from "@/lib/utils";

const VERDICT = {
  Запускать: { icon: CircleCheck, cls: "bg-success/15 text-success border-success/30" },
  Изменить: { icon: CircleAlert, cls: "bg-warning/20 text-warning border-warning/40" },
  "Не инвестировать": { icon: CircleX, cls: "bg-danger/15 text-danger border-danger/30" },
} as const;

export function VerdictBadge({ verdict, size = "md", className }: { verdict: Verdict; size?: "sm" | "md" | "lg"; className?: string }) {
  const { icon: Icon, cls } = VERDICT[verdict];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold",
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "lg" && "px-4 py-1.5 text-base",
        cls,
        className,
      )}
    >
      <Icon className={size === "lg" ? "size-5" : "size-4"} />
      {verdict}
    </span>
  );
}

export const riskTone = (r: RiskLevel) => (r === "Низкий" ? "success" : r === "Средний" ? "warning" : "danger") as "success" | "warning" | "danger";
