import { motion } from "framer-motion";

import { PLACES, type PlaceKind } from "@/data/places";
import { cn } from "@/lib/utils";

const KIND_CLASS: Record<PlaceKind, string> = {
  university: "fill-violet-brand",
  metro: "fill-cyan-brand",
  mall: "fill-warning",
  competitor: "fill-danger",
  candidate: "fill-success",
};

/** Stylized dark SVG map of Tashkent (no API key). Coordinates are 0–100. */
export function TashkentMap({
  className,
  pin = { x: 62, y: 34 },
  kinds = ["university", "metro", "mall", "competitor"],
  radius = true,
}: {
  className?: string;
  pin?: { x: number; y: number } | null;
  kinds?: PlaceKind[];
  radius?: boolean;
}) {
  const places = PLACES.filter((p) => kinds.includes(p.kind));
  return (
    <svg viewBox="0 0 100 80" className={cn("h-full w-full", className)} preserveAspectRatio="xMidYMid slice">
      <rect width="100" height="80" className="fill-ink" />
      {/* Grid streets */}
      <g className="stroke-ink-foreground/[0.06]" strokeWidth="0.25">
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`h${i}`} x1="0" x2="100" y1={i * 7} y2={i * 7 + 3} />
        ))}
        {Array.from({ length: 14 }).map((_, i) => (
          <line key={`v${i}`} y1="0" y2="80" x1={i * 8} x2={i * 8 - 4} />
        ))}
      </g>
      {/* Main roads */}
      <g className="stroke-ink-foreground/15" strokeWidth="0.7" fill="none" strokeLinecap="round">
        <path d="M0 52 C 25 48, 45 52, 100 30" />
        <path d="M22 0 C 30 30, 45 55, 60 80" />
        <path d="M0 20 C 30 26, 60 18, 100 60" />
        <circle cx="50" cy="44" r="16" />
      </g>
      {/* Anhor canal */}
      <path d="M38 0 C 42 20, 34 40, 44 80" className="stroke-cyan-brand/40" strokeWidth="1.2" fill="none" />
      {radius && pin && (
        <>
          <circle cx={pin.x} cy={pin.y} r="18" className="fill-violet-brand/10 stroke-violet-brand/30" strokeWidth="0.3" strokeDasharray="1 1" />
          <circle cx={pin.x} cy={pin.y} r="9" className="fill-indigo-brand/10 stroke-indigo-brand/40" strokeWidth="0.3" />
        </>
      )}
      {places.map((p, i) => (
        <motion.g
          key={p.id}
          initial={{ opacity: 0, scale: 0 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 + i * 0.08, type: "spring", stiffness: 260, damping: 18 }}
          style={{ transformOrigin: `${p.x}px ${p.y}px` }}
        >
          <circle cx={p.x} cy={p.y} r={p.kind === "competitor" ? 1.1 : 1.5} className={KIND_CLASS[p.kind]} />
        </motion.g>
      ))}
      {pin && (
        <g>
          <circle cx={pin.x} cy={pin.y} r="4" className="fill-cyan-brand/40 animate-pin-pulse" />
          <circle cx={pin.x} cy={pin.y} r="2.2" className="fill-ink-foreground stroke-indigo-brand" strokeWidth="0.9" />
        </g>
      )}
    </svg>
  );
}
