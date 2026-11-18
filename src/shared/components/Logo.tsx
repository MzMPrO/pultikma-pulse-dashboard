import { Link } from "@tanstack/react-router";

import { cn } from "@/lib/utils";

export function Logo({ className, tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <Link to="/" className={cn("flex items-center gap-2.5 font-semibold tracking-tight", className)}>
      <span className="relative grid size-8 place-items-center rounded-lg bg-brand-gradient shadow-glow">
        <svg viewBox="0 0 24 24" className="size-4 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M4 16 L9 10 L13 13 L20 5" />
          <circle cx="20" cy="5" r="1.6" fill="currentColor" />
        </svg>
      </span>
      <span className={tone === "light" ? "text-ink-foreground" : "text-foreground"}>
        PulTikma<span className="text-brand-gradient"> AI</span>
      </span>
    </Link>
  );
}
