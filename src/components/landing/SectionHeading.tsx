import { FadeUp } from "@/components/shared/FadeUp";
import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  text,
  tone = "light",
  className,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <FadeUp className={cn("mx-auto max-w-2xl text-center", className)}>
      <div className={cn("text-xs font-semibold uppercase tracking-[0.18em]", dark ? "text-cyan-brand" : "text-primary")}>
        {eyebrow}
      </div>
      <h2 className={cn("mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl", dark ? "text-ink-foreground" : "text-foreground")}>
        {title}
      </h2>
      {text && <p className={cn("mt-4 text-base leading-relaxed", dark ? "text-ink-muted" : "text-muted-foreground")}>{text}</p>}
    </FadeUp>
  );
}
