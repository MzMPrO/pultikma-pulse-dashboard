import { Building2, CheckCircle2, Loader2, MousePointerClick } from "lucide-react";
import { useEffect, useState } from "react";

import type { StepInfo } from "@/features/scout/lib/guidance";
import { cn } from "@/lib/utils";

const ICON = {
  1: Building2,
  2: MousePointerClick,
  3: Loader2,
  4: CheckCircle2,
} as const;

/**
 * Compact "where am I" pill at the top-center of the map. Replaces the old «Кликните на карте…» hint.
 * The final «Готово» state fades out after a few seconds.
 */
export function StepPill({ info }: { info: StepInfo }) {
  const [faded, setFaded] = useState(false);
  useEffect(() => {
    setFaded(false);
    if (info.step !== 4) return;
    const t = setTimeout(() => setFaded(true), 6000);
    return () => clearTimeout(t);
  }, [info.step]);

  const Icon = ICON[info.step];
  const [head, ...rest] = info.label.split(" · ");
  const tail = rest.join(" · ");
  const done = info.step === 4;

  return (
    <div
      data-testid="map-hint"
      data-step={info.step}
      aria-live="polite"
      className={cn(
        "scout-noprint pointer-events-none absolute inset-x-2 top-3 z-[1000] flex justify-center transition-opacity duration-700 lg:left-[532px] lg:right-4 lg:top-4",
        // on narrow screens the results panel occupies the top edge: «Готово» is redundant there
        // results panel (380px + gutters) takes the right edge on desktop
        done && "hidden lg:right-[396px] lg:flex",
        faded && "opacity-0",
      )}
    >
      <div
        key={info.step}
        className="scout-step-in glass-dark flex max-w-full items-center gap-2 rounded-full bg-[#0b0f1a]/85 px-3.5 py-2 text-[13px] leading-tight text-ink-foreground"
      >
        <Icon
          className={cn(
            "size-4 shrink-0",
            done ? "text-green-400" : "text-cyan-brand",
            info.step === 3 && "animate-spin",
          )}
        />
        <span className="min-w-0">
          <span className="font-semibold text-cyan-brand">{head}</span>
          {tail && (
            <>
              <span className="text-ink-muted"> · </span>
              {tail}
            </>
          )}
        </span>
      </div>
    </div>
  );
}
