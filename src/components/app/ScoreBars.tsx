import { motion } from "framer-motion";

import { SCORE_LABELS } from "@/data/demo";
import type { ScoreBreakdown } from "@/lib/engine";
import { cn } from "@/lib/utils";

export function ScoreBars({ breakdown, tone = "light", compact = false }: { breakdown: ScoreBreakdown; tone?: "light" | "dark"; compact?: boolean }) {
  const dark = tone === "dark";
  return (
    <div className={compact ? "space-y-2.5" : "space-y-4"}>
      {(Object.keys(SCORE_LABELS) as (keyof ScoreBreakdown)[]).map((k, i) => (
        <div key={k}>
          <div className="mb-1.5 flex justify-between text-xs">
            <span className={dark ? "text-ink-muted" : "text-muted-foreground"}>{SCORE_LABELS[k]}</span>
            <span className="font-semibold tabular-nums">{breakdown[k]}</span>
          </div>
          <div className={cn("h-1.5 overflow-hidden rounded-full", dark ? "bg-ink-foreground/10" : "bg-muted")}>
            <motion.div
              className="h-full rounded-full bg-brand-gradient"
              initial={{ width: 0 }}
              animate={{ width: `${breakdown[k]}%` }}
              transition={{ duration: 1.1, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
