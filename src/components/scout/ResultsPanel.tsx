import { Download, GitCompare, MapPin } from "lucide-react";
import { useEffect, useState } from "react";
import { PolarAngleAxis, PolarGrid, Radar, RadarChart, ResponsiveContainer } from "recharts";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AnalyzeResponse, Factors } from "@/lib/api";
import { cn } from "@/lib/utils";

export const FACTOR_LABELS: Record<keyof Factors, string> = {
  traffic: "Поток клиентов",
  competition: "Конкуренция",
  closures: "Закрываемость района",
  rent: "Аренда",
  visibility: "Видимость (1-я линия)",
};
const FACTOR_KEYS = Object.keys(FACTOR_LABELS) as (keyof Factors)[];

export function scoreColor(score: number) {
  return score > 70 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
}
const VERDICT_RU = { go: "Запускать", change: "Изменить", no: "Не открывать" } as const;

/** Radar axis label: wraps long names onto two lines and anchors them away from the center. */
function AxisTick(props: { x?: number; y?: number; cx?: number; payload?: { value: string } }) {
  const { x = 0, y = 0, cx = 0, payload } = props;
  const text = payload?.value ?? "";
  const words = text.split(" ");
  const lines = words.length > 1 ? [words[0] ?? "", words.slice(1).join(" ")] : [text];
  const anchor = Math.abs(x - cx) < 6 ? "middle" : x > cx ? "start" : "end";
  return (
    <text x={x} y={y} textAnchor={anchor} fill="#b4bccd" fontSize={10}>
      {lines.map((l, i) => (
        <tspan key={i} x={x} dy={i === 0 ? (lines.length > 1 ? "-0.4em" : "0.35em") : "1.15em"}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function useCount(to: number, ms = 1400) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      setV(Math.round((1 - Math.pow(1 - k, 3)) * to));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms]);
  return v;
}

function ScoreCircle({ score }: { score: number }) {
  const v = useCount(score);
  const size = 150;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = scoreColor(v);
  return (
    <div className="relative" style={{ width: size, height: size }} data-testid="score-circle">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 10%)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          style={{ filter: `drop-shadow(0 0 8px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <div className="text-5xl font-bold tabular-nums leading-none" style={{ color }}>
            {v}
          </div>
          <div className="mt-1 text-[10px] uppercase tracking-widest text-ink-muted">PulTikma Score</div>
        </div>
      </div>
    </div>
  );
}

function Demo() {
  return (
    <span className="ml-1.5 shrink-0 rounded bg-ink-foreground/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-ink-muted">
      demo data
    </span>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string | undefined }) {
  return (
    <div className="rounded-xl border border-ink-border bg-ink-foreground/5 p-3">
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="mt-0.5 text-xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="text-[11px] text-ink-muted">{sub}</div>}
    </div>
  );
}

const nf = (n: number) => n.toLocaleString("ru-RU");

export function ResultsPanel({
  result,
  selectedAlt,
  compareNonce = 0,
  onFly,
  onFocusMarker,
  onSelectAlt,
}: {
  result: AnalyzeResponse;
  selectedAlt: number | null;
  compareNonce?: number;
  onFly: (lat: number, lng: number) => void;
  /** fly to a marker on the map and open its tooltip; id = "x<closedId>" */
  onFocusMarker?: ((id: string, lat: number, lng: number) => void) | undefined;
  onSelectAlt: (rank: number) => void;
}) {
  const [compare, setCompare] = useState(false);
  useEffect(() => {
    if (compareNonce > 0) setCompare(true);
  }, [compareNonce]);
  const color = scoreColor(result.score);
  const data = FACTOR_KEYS.map((k) => ({ factor: FACTOR_LABELS[k], value: Math.round(result.factors[k] * 100) }));
  const alt = result.alternatives.find((a) => a.rank === (selectedAlt ?? 1)) ?? result.alternatives[0];

  return (
    <div className="space-y-5 p-4">
      <div className="flex flex-col items-center gap-3">
        <ScoreCircle score={result.score} />
        <div
          className="rounded-full px-4 py-1.5 text-sm font-semibold"
          style={{ background: `${color}22`, color, border: `1px solid ${color}66` }}
          data-testid="verdict"
        >
          {result.verdict_text || VERDICT_RU[result.verdict]}
        </div>
        <p className="text-center text-xs leading-relaxed text-ink-muted">{result.explanation}</p>
      </div>

      <div className="h-56 rounded-xl border border-ink-border bg-ink-foreground/5">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} outerRadius="58%" margin={{ top: 12, right: 24, bottom: 12, left: 24 }}>
            <PolarGrid stroke="rgb(255 255 255 / 15%)" />
            <PolarAngleAxis dataKey="factor" tick={<AxisTick />} />
            <Radar dataKey="value" stroke={color} fill={color} fillOpacity={0.35} isAnimationActive />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Kpi label="Конкурентов в 500 м" value={String(result.kpi.competitors)} />
        <Kpi label="Закрылось рядом" value={String(result.kpi.closures)} />
        <Kpi label="Поток в день" value={nf(result.kpi.traffic_per_day)} sub="человек (оценка)" />
        <Kpi
          label="Аренда за м²"
          value={`${nf(result.kpi.rent_per_m2_uzs)} сум`}
          sub={result.kpi.rent_per_m2_usd != null ? `≈ $${result.kpi.rent_per_m2_usd}` : undefined}
        />
      </div>

      {result.closed.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Закрывшиеся рядом</h3>
          <ul className="space-y-2">
            {result.closed.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => (onFocusMarker ? onFocusMarker("x" + c.id, c.lat, c.lng) : onFly(c.lat, c.lng))}
                  className="w-full rounded-xl border border-ink-border bg-ink-foreground/5 p-2.5 text-left transition-colors hover:bg-ink-foreground/10"
                >
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span className="flex min-w-0 items-center">
                      <span className="mr-2 grid size-5 shrink-0 place-items-center rounded-full bg-gray-500 text-[10px]">✕</span>
                      <span className="truncate">{c.name}</span>
                      {c.source === "synthetic" && <Demo />}
                    </span>
                    <span className="ml-2 shrink-0 text-xs text-ink-muted">{c.closed_year}</span>
                  </div>
                  <div className="mt-1 pl-7 text-xs text-ink-muted">Причина: {c.reason}</div>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Топ-3 лучших места рядом</h3>
        <ul className="space-y-2">
          {result.alternatives.map((a) => (
            <li key={a.rank}>
              <button
                onClick={() => {
                  onSelectAlt(a.rank);
                  onFly(a.lat, a.lng);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-colors hover:bg-ink-foreground/10",
                  selectedAlt === a.rank ? "border-green-500/60 bg-green-500/10" : "border-ink-border bg-ink-foreground/5",
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-green-500 text-sm font-bold text-white">{a.rank}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">Score {a.score}</span>
                  <span className="flex items-center gap-1 text-xs text-ink-muted">
                    <MapPin className="size-3" /> {a.distance_m} м от выбранной
                  </span>
                </span>
                <span className="text-sm font-semibold" style={{ color: scoreColor(a.score) }}>
                  +{a.score - result.score}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <div className="scout-noprint grid grid-cols-2 gap-2">
        <Button variant="glass" onClick={() => setCompare(true)} disabled={!alt}>
          <GitCompare /> Сравнить
        </Button>
        <Button variant="hero" onClick={() => window.print()}>
          <Download /> Скачать отчёт
        </Button>
      </div>

      <p className="text-center text-[11px] leading-relaxed text-ink-muted">
        Это аналитическая рекомендация, а не гарантия дохода
      </p>

      {alt && (
        <Dialog open={compare} onOpenChange={setCompare}>
          <DialogContent className="border-ink-border bg-ink text-ink-foreground sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Сравнение: выбранная точка vs #{alt.rank}</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-3 text-sm">
              <div />
              <div className="text-center text-xs text-ink-muted">Выбранная</div>
              <div className="text-center text-xs text-green-400">Альтернатива #{alt.rank}</div>
              <div className="font-semibold">Score</div>
              <div className="text-center text-xl font-bold" style={{ color: scoreColor(result.score) }}>{result.score}</div>
              <div className="text-center text-xl font-bold" style={{ color: scoreColor(alt.score) }}>{alt.score}</div>
              {FACTOR_KEYS.map((k) => {
                const a = Math.round(result.factors[k] * 100);
                const b = Math.round(alt.factors[k] * 100);
                return (
                  <div key={k} className="contents">
                    <div className="text-ink-muted">{FACTOR_LABELS[k]}</div>
                    <div className={cn("text-center tabular-nums", a >= b ? "font-semibold text-ink-foreground" : "text-ink-muted")}>{a}</div>
                    <div className={cn("text-center tabular-nums", b >= a ? "font-semibold text-green-400" : "text-ink-muted")}>{b}</div>
                  </div>
                );
              })}
              <div className="text-ink-muted">Расстояние</div>
              <div className="text-center">—</div>
              <div className="text-center">{alt.distance_m} м</div>
            </div>
            <p className="text-xs text-ink-muted">
              {alt.score > result.score
                ? `Альтернатива #${alt.rank} лучше на ${alt.score - result.score} п.`
                : "Выбранная точка не уступает альтернативе."}{" "}
              Это аналитическая рекомендация, а не гарантия дохода.
            </p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
