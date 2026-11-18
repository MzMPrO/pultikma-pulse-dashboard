import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Building2, GraduationCap, Flame, MapPin, Star, TrainFront } from "lucide-react";
import { useMemo, useState } from "react";

import { Logo } from "@/components/shared/Logo";
import { MapLegend, MapView, type LayerKey, type Layers } from "@/components/shared/MapView";
import { ScoreGauge } from "@/components/shared/ScoreGauge";
import { Button } from "@/components/ui/button";
import { analyzePoint, distM, type Point } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { DEMO_PIN } from "@/store/useAppStore";

export const Route = createFileRoute("/app/map")({
  head: () => ({
    meta: [
      { title: "Карта Ташкента — PulTikma AI" },
      { name: "description", content: "Живая карта Ташкента: вузы, метро, ТЦ и конкуренты рядом с вашей будущей точкой." },
      { property: "og:title", content: "Карта Ташкента — PulTikma AI" },
      { property: "og:description", content: "Поставьте точку на карте и сразу увидите оценку локации и конкурентов в радиусе 500 м." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MapPage,
});

const LAYER_TOGGLES: { key: LayerKey; label: string; icon: typeof Star }[] = [
  { key: "university", label: "Вузы", icon: GraduationCap },
  { key: "metro", label: "Метро", icon: TrainFront },
  { key: "mall", label: "ТЦ", icon: Building2 },
  { key: "competitor", label: "Конкуренты", icon: Star },
  { key: "heat", label: "Плотность", icon: Flame },
];

function MapPage() {
  const [pin, setPin] = useState<Point>(DEMO_PIN);
  const [layers, setLayers] = useState<Layers>({ university: true, metro: true, mall: true, competitor: true, heat: false });
  const analysis = useMemo(() => analyzePoint(pin), [pin]);
  const nearest = useMemo(
    () =>
      analysis
        .competitorsWithin(1000)
        .map((p) => ({ ...p, d: distM(p, pin) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, 5),
    [analysis, pin],
  );

  return (
    <div className="flex min-h-screen flex-col bg-ink text-ink-foreground lg:h-screen">
      <header className="flex items-center justify-between border-b border-ink-border px-4 py-3 sm:px-6">
        <Logo tone="light" />
        <Button asChild variant="glass" size="sm">
          <Link to="/"><ArrowLeft /> На главную</Link>
        </Button>
      </header>

      <div className="flex flex-1 flex-col lg:min-h-0 lg:flex-row">
        <aside className="order-2 flex flex-col gap-5 overflow-y-auto border-ink-border p-4 sm:p-6 lg:order-1 lg:w-[360px] lg:border-r">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Карта Ташкента</h1>
            <p className="mt-1 text-sm text-ink-muted">Нажмите на карту, чтобы поставить точку будущего бизнеса.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {LAYER_TOGGLES.map(({ key, label, icon: Icon }) => {
              const on = Boolean(layers[key]);
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setLayers((l) => ({ ...l, [key]: !l[key] }))}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition-colors",
                    on ? "border-cyan-brand/50 bg-cyan-brand/15 text-ink-foreground" : "border-ink-border text-ink-muted hover:text-ink-foreground",
                  )}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              );
            })}
          </div>

          <div className="glass-dark flex items-center gap-4 rounded-2xl p-4">
            <ScoreGauge value={analysis.locationScore} size={110} stroke={9} label="Локация" tone="dark" />
            <div className="space-y-1.5 text-sm">
              <div className="flex items-center gap-1.5 text-ink-muted">
                <MapPin className="size-3.5 text-cyan-brand" /> Ваша точка
              </div>
              <div>
                Конкурентов в 500 м: <span className="font-semibold">{analysis.competitors500m}</span>
              </div>
              <div className="text-ink-muted">
                Рядом: {analysis.anchorPlaces.length ? analysis.anchorPlaces.map((p) => p.name).join(", ") : "нет якорей в 800 м"}
              </div>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs uppercase tracking-wider text-ink-muted">Ближайшие конкуренты</div>
            {nearest.length ? (
              <ul className="space-y-1.5 text-sm">
                {nearest.map((c) => (
                  <li key={c.id} className="flex items-center justify-between rounded-lg bg-ink-2 px-3 py-2">
                    <span>{c.name}</span>
                    <span className="flex items-center gap-3 text-xs text-ink-muted">
                      {c.rating && (
                        <span className="flex items-center gap-1"><Star className="size-3 fill-warning text-warning" /> {c.rating}</span>
                      )}
                      {c.d} м
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">В радиусе 1 км конкурентов нет.</p>
            )}
          </div>

          <MapLegend />
        </aside>

        <div className="order-1 h-[60vh] lg:order-2 lg:h-auto lg:flex-1">
          <MapView pin={pin} onPick={setPin} layers={layers} />
        </div>
      </div>
    </div>
  );
}
