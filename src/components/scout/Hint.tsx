import { Info } from "lucide-react";
import { useState, type ReactElement, type ReactNode } from "react";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/** Dark glass tooltip body used across /app. */
export const TIP_CLASS =
  "max-w-[240px] border border-ink-border bg-[#0b0f1a] text-center text-xs leading-snug text-ink-foreground shadow-lg";

/** Wraps any single focusable element with a tooltip (hover / focus). */
export function Tip({
  label,
  children,
  side = "bottom",
}: {
  label: ReactNode;
  children: ReactElement;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={TIP_CLASS}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Small ⓘ icon with a tooltip; also toggles on tap so it works on touch screens. */
export function InfoHint({
  text,
  label = "Пояснение",
  className,
}: {
  text: ReactNode;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          onClick={(e) => {
            e.preventDefault();
            setOpen((o) => !o);
          }}
          className={cn(
            "inline-grid size-4 shrink-0 place-items-center rounded-full text-ink-muted transition-colors hover:text-cyan-brand focus-visible:text-cyan-brand",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className={TIP_CLASS}>
        {text}
      </TooltipContent>
    </Tooltip>
  );
}
