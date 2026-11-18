import { AnimatePresence, motion } from "framer-motion";
import { Building2, GraduationCap, Star, TrainFront, X } from "lucide-react";
import { useHydrated } from "@tanstack/react-router";
import { lazy, Suspense, useId, useMemo, useRef, useState } from "react";

import { PLACES, type Place, type PlaceKind } from "@/features/landing/map/places";
import { distM, metersToUnits, type Point } from "@/features/landing/map/geo";
import { cn } from "@/lib/utils";

const GoogleMap = lazy(() => import("./GoogleMap"));

export type LayerKey = "competitor" | "university" | "metro" | "mall" | "heat";
export type Layers = Partial<Record<LayerKey, boolean>>;

const DEFAULT_LAYERS: Layers = { competitor: true, university: true, metro: true, mall: true, heat: false };

const KIND_FILL: Record<PlaceKind, string> = {
  university: "fill-violet-brand",
  metro: "fill-cyan-brand",
  mall: "fill-warning",
  competitor: "fill-danger",
  candidate: "fill-success",
};

const KIND_LABEL: Record<PlaceKind, string> = {
  university: "Университет",
  metro: "Метро",
  mall: "Торговый центр",
  competitor: "Конкурент",
  candidate: "Кандидат",
};

const KIND_ICON = { university: GraduationCap, metro: TrainFront, mall: Building2, competitor: Star, candidate: Star };

export interface Candidate extends Point {
  label?: string;
  id?: string;
}

export interface MapViewProps {
  className?: string;
  pin?: Point | null;
  onPick?: (p: Point) => void;
  layers?: Layers;
  /** Radius circles around the pin, meters. */
  radii?: number[];
  candidates?: Candidate[];
  /** Restrict competitors shown (agent progressive reveal). Undefined = all. */
  visibleCompetitorIds?: string[];
  /** Show anchors only from this list (agent). Undefined = all. */
  showPopup?: boolean;
  /** Use the real Google map when its browser key is available (default true). */
  allowReal?: boolean;
  animateIn?: boolean;
}

/**
 * Map of Tashkent: a real Google map when available, over a stylized SVG fallback.
 * Coordinates are 0–100 × 0–80 (projected to real lat/lng via ./geo).
 * Reused by the landing, dashboard, wizard, report, agent console and map page.
 */
export function MapView(props: MapViewProps) {
  const hydrated = useHydrated();
  const key = import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"] as string | undefined;
  const [realFailed, setRealFailed] = useState(false);
  const { className, ...rest } = props;
  const useReal = (props.allowReal ?? true) && Boolean(key) && hydrated && !realFailed;
  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-ink", className)}>
      <SvgMap {...rest} />
      {useReal && key && (
        <Suspense fallback={null}>
          <GoogleMap {...rest} apiKey={key} onFail={() => setRealFailed(true)} />
        </Suspense>
      )}
    </div>
  );
}

function SvgMap({
  className,
  pin = { x: 62, y: 34 },
  onPick,
  layers = DEFAULT_LAYERS,
  radii = [500, 1000],
  candidates = [],
  visibleCompetitorIds,
  showPopup = true,
  animateIn = true,
}: MapViewProps) {
  const uid = useId().replace(/:/g, "");
  const boxRef = useRef<HTMLDivElement>(null);
  const [selected, setSelected] = useState<Place | null>(null);

  const places = useMemo(
    () =>
      PLACES.filter((p) => {
        if (p.kind === "competitor") {
          if (!layers.competitor) return false;
          return !visibleCompetitorIds || visibleCompetitorIds.includes(p.id);
        }
        return layers[p.kind as LayerKey] ?? false;
      }),
    [layers, visibleCompetitorIds],
  );
  const heatPoints = PLACES.filter(
    (p) => p.kind === "competitor" && (!visibleCompetitorIds || visibleCompetitorIds.includes(p.id)),
  );

  const handleClick = (e: React.MouseEvent) => {
    if (!onPick || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 100;
    const y = ((e.clientY - r.top) / r.height) * 80;
    setSelected(null);
    onPick({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
  };

  return (
    <div className={cn("relative h-full w-full overflow-hidden bg-ink", className)} style={{ containerType: "size" }}>
      <div
        ref={boxRef}
        className={cn("absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2", onPick && "cursor-crosshair")}
        style={{ width: "max(100cqw, 125cqh)", aspectRatio: "5 / 4" }}
        onClick={handleClick}
      >
        <svg viewBox="0 0 100 80" className="absolute inset-0 h-full w-full">
          <defs>
            <filter id={`heat-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.4" />
            </filter>
          </defs>
          <rect width="100" height="80" className="fill-ink" />
          <g className="stroke-ink-foreground/[0.06]" strokeWidth="0.25">
            {Array.from({ length: 12 }).map((_, i) => (
              <line key={`h${i}`} x1="0" x2="100" y1={i * 7} y2={i * 7 + 3} />
            ))}
            {Array.from({ length: 14 }).map((_, i) => (
              <line key={`v${i}`} y1="0" y2="80" x1={i * 8} x2={i * 8 - 4} />
            ))}
          </g>
          {/* parks */}
          <ellipse cx="80" cy="64" rx="9" ry="6" className="fill-success/10" />
          <ellipse cx="14" cy="30" rx="7" ry="5" className="fill-success/10" />
          <g className="stroke-ink-foreground/15" strokeWidth="0.7" fill="none" strokeLinecap="round">
            <path d="M0 52 C 25 48, 45 52, 100 30" />
            <path d="M22 0 C 30 30, 45 55, 60 80" />
            <path d="M0 20 C 30 26, 60 18, 100 60" />
            <circle cx="50" cy="44" r="16" />
          </g>
          <path d="M38 0 C 42 20, 34 40, 44 80" className="stroke-cyan-brand/40" strokeWidth="1.2" fill="none" />

          {layers.heat && (
            <g filter={`url(#heat-${uid})`}>
              {heatPoints.map((p) => (
                <circle key={`heat-${p.id}`} cx={p.x} cy={p.y} r="4.5" className="fill-danger/35" />
              ))}
            </g>
          )}

          {pin &&
            radii.map((m, i) => (
              <circle
                key={m}
                cx={pin.x}
                cy={pin.y}
                r={metersToUnits(m)}
                className={i === 0 ? "fill-indigo-brand/10 stroke-indigo-brand/50" : "fill-violet-brand/5 stroke-violet-brand/30"}
                strokeWidth="0.3"
                strokeDasharray={i === 0 ? undefined : "1 1"}
              />
            ))}

          {places.map((p, i) => (
            <motion.g
              key={p.id}
              initial={animateIn ? { opacity: 0, scale: 0 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: animateIn ? 0.2 + i * 0.03 : 0, type: "spring", stiffness: 260, damping: 18 }}
              style={{ transformOrigin: `${p.x}px ${p.y}px`, transformBox: "view-box" }}
              className={showPopup ? "cursor-pointer" : undefined}
              onClick={(e) => {
                if (!showPopup) return;
                e.stopPropagation();
                setSelected(p);
              }}
            >
              <circle cx={p.x} cy={p.y} r="3" fill="transparent" />
              <circle
                cx={p.x}
                cy={p.y}
                r={p.kind === "competitor" ? 1 : 1.5}
                className={cn(KIND_FILL[p.kind], selected?.id === p.id && "stroke-ink-foreground")}
                strokeWidth="0.5"
              />
            </motion.g>
          ))}

          {candidates.map((c, i) => (
            <motion.g
              key={c.id ?? `${c.x}-${c.y}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.25 }}
            >
              <circle cx={c.x} cy={c.y} r="2.4" className="fill-success/25" />
              <circle cx={c.x} cy={c.y} r="1.5" className="fill-success" />
              <text x={c.x} y={c.y - 3} textAnchor="middle" className="fill-ink-foreground text-[2.6px] font-semibold">
                {String.fromCharCode(65 + i)}
              </text>
            </motion.g>
          ))}

          {pin && (
            <g>
              <circle cx={pin.x} cy={pin.y} r="4" className="fill-cyan-brand/40 animate-pin-pulse" />
              <circle cx={pin.x} cy={pin.y} r="2.2" className="fill-ink-foreground stroke-indigo-brand" strokeWidth="0.9" />
            </g>
          )}
        </svg>

        <AnimatePresence>
          {selected && (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6 }}
              className="glass-dark absolute z-10 w-52 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-xl p-3 text-ink-foreground"
              style={{ left: `${selected.x}%`, top: `${(selected.y / 80) * 100}%` }}
              onClick={(e) => e.stopPropagation()}
            >
              <PlacePopup place={selected} pin={pin} onClose={() => setSelected(null)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function PlacePopup({ place, pin, onClose }: { place: Place; pin: Point | null; onClose: () => void }) {
  const Icon = KIND_ICON[place.kind];
  return (
    <>
      <button type="button" onClick={onClose} className="absolute right-2 top-2 text-ink-muted hover:text-ink-foreground" aria-label="Закрыть">
        <X className="size-3.5" />
      </button>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-ink-muted">
        <Icon className="size-3" /> {KIND_LABEL[place.kind]}
      </div>
      <div className="mt-1 pr-4 text-sm font-semibold leading-tight">{place.name}</div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 text-xs text-ink-muted">
        {place.rating && (
          <span className="flex items-center gap-1">
            <Star className="size-3 fill-warning text-warning" /> {place.rating}
          </span>
        )}
        {place.note && <span>{place.note}</span>}
        {pin && <span>{distM(place, pin)} м от точки</span>}
      </div>
    </>
  );
}

export function MapLegend({ className }: { className?: string }) {
  const items: [PlaceKind, string][] = [
    ["university", "Вузы"],
    ["metro", "Метро"],
    ["mall", "ТЦ"],
    ["competitor", "Конкуренты"],
  ];
  return (
    <div className={cn("flex flex-wrap gap-3 text-[11px] text-ink-muted", className)}>
      {items.map(([k, l]) => (
        <span key={k} className="flex items-center gap-1.5">
          <svg className="size-2" viewBox="0 0 2 2">
            <circle cx="1" cy="1" r="1" className={KIND_FILL[k]} />
          </svg>
          {l}
        </span>
      ))}
    </div>
  );
}
