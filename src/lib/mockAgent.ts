/**
 * Simulated autonomous agent. An async generator that emits timeline events with
 * realistic delays. All numbers come from engine.ts — nothing leaves the browser.
 */
import { marketDemandFor } from "@/data/market";
import { CANDIDATE_SPOTS, type Place } from "@/data/places";
import { runScenarios, simulate, type BusinessType, type EngineInput, type EngineResult, type Scenario } from "@/lib/engine";
import { analyzePoint, type Point } from "@/lib/geo";
import { parseIdea } from "@/lib/parser";
import { sleep } from "@/lib/stream";

export type StepId = "understand" | "locations" | "competitors" | "traffic" | "simulate" | "score" | "report";
export type StepStatus = "pending" | "running" | "done" | "cached";
export type AnchorFocus = "university" | "metro" | "mall";

export interface AgentStep {
  id: StepId;
  title: string;
  tool: string;
  status: StepStatus;
  input?: unknown;
  output?: unknown;
}

export interface AgentContext {
  goal: string;
  type: BusinessType;
  investment: number;
  focus: AnchorFocus;
  pin: Point;
  district: string;
  address: string;
  candidates: (Point & { label: string; score: number })[];
  competitorIds: string[];
  input: EngineInput;
  result: EngineResult;
  scenarios: Scenario[];
  best: Scenario["id"];
}

export type AgentEvent =
  | { type: "plan"; steps: AgentStep[] }
  | { type: "step"; step: AgentStep }
  | { type: "reveal-candidates"; candidates: AgentContext["candidates"] }
  | { type: "reveal-competitor"; place: Place }
  | { type: "final"; context: AgentContext; message: string; delta: { from: number; to: number } | null };

const BASE_STEPS: Omit<AgentStep, "status">[] = [
  { id: "understand", title: "Понял задачу", tool: "parse_goal" },
  { id: "locations", title: "Нашёл локации", tool: "search_places" },
  { id: "competitors", title: "Проанализировал конкурентов", tool: "analyze_location" },
  { id: "traffic", title: "Рассчитал трафик клиентов", tool: "estimate_traffic" },
  { id: "simulate", title: "Запустил симуляцию 3 сценариев", tool: "run_simulation" },
  { id: "score", title: "Рассчитал PulTikma Score", tool: "calculate_pultikma_score" },
  { id: "report", title: "Сформировал отчёт", tool: "generate_report" },
];

const FOCUS_LABEL: Record<AnchorFocus, string> = {
  university: "университетов",
  metro: "метро",
  mall: "торговых центров",
};

const TYPE_LABEL: Record<BusinessType, string> = {
  cafe: "кофейня",
  shop: "магазин",
  beauty: "салон красоты",
  fashion: "fashion-бренд",
  production: "производство",
  service: "сервис",
};

const delay = (signal?: AbortSignal) => sleep(600 + Math.random() * 900, signal);

/** Which steps a follow-up needs to re-run (index into BASE_STEPS). */
function firstStepToRun(goal: string, prev: AgentContext | null): number {
  if (!prev) return 0;
  const p = parseIdea(goal);
  if (p.type && p.type !== prev.type) return 0;
  if (p.anchor || p.district) return 1;
  if (p.investment) return 3;
  return 0;
}

export async function* runAgent(goal: string, prev: AgentContext | null, signal?: AbortSignal): AsyncGenerator<AgentEvent> {
  const start = firstStepToRun(goal, prev);
  const parsed = parseIdea(goal);
  const steps: AgentStep[] = BASE_STEPS.map((s, i) => ({ ...s, status: i < start ? "cached" : "pending" }));
  yield { type: "plan", steps: steps.map((s) => ({ ...s })) };

  const type: BusinessType = parsed.type ?? prev?.type ?? "cafe";
  const investment = parsed.investment ?? prev?.investment ?? 100;
  const focus: AnchorFocus = parsed.anchor ?? (start === 0 ? undefined : prev?.focus) ?? "university";

  const update = (i: number, patch: Partial<AgentStep>) => {
    const step = { ...steps[i]!, ...patch };
    steps[i] = step;
    return { type: "step" as const, step: { ...step } };
  };

  // 1. Understand
  if (start <= 0) {
    yield update(0, { status: "running" });
    await delay(signal);
    yield update(0, {
      status: "done",
      input: { goal },
      output: { type, city: "Ташкент", budget: `${investment} млн сум`, focus },
    });
  }

  // 2. Locations
  let candidates = prev?.candidates ?? [];
  let pin = prev?.pin ?? { x: 62, y: 34 };
  let district = prev?.district ?? "Мирзо-Улугбек";
  let address = prev?.address ?? "";
  if (start <= 1) {
    yield update(1, { status: "running", title: `Ищу локации рядом с ${FOCUS_LABEL[focus]}` });
    const spots = CANDIDATE_SPOTS[focus].filter((s) => !parsed.district || s.district === parsed.district);
    const pool = spots.length ? spots : CANDIDATE_SPOTS[focus];
    candidates = pool
      .map((s) => {
        const a = analyzePoint(s);
        const r = simulate({ type, city: "Ташкент", district: s.district, investment, anchors: a.anchors, competitors500m: a.competitors500m, marketDemand: marketDemandFor(type, s.district), designAppeal: 90 });
        return { ...s, score: r.pultikmaScore };
      })
      .sort((a, b) => b.score - a.score);
    await delay(signal);
    yield { type: "reveal-candidates", candidates };
    const best = candidates[0]!;
    pin = { x: best.x, y: best.y };
    district = (pool.find((s) => s.label === best.label) ?? pool[0]!).district;
    address = best.label;
    yield update(1, {
      status: "done",
      title: `Нашёл ${candidates.length} локации рядом с ${FOCUS_LABEL[focus]}`,
      input: { query: `${TYPE_LABEL[type]} рядом с ${FOCUS_LABEL[focus]}`, city: "Ташкент" },
      output: candidates.map((c) => ({ address: c.label, score: c.score })),
    });
  }

  // 3. Competitors
  const analysis = analyzePoint(pin);
  const competitors1km = analysis.competitorsWithin(1000);
  let competitorIds = prev?.competitorIds ?? [];
  if (start <= 2) {
    yield update(2, { status: "running", title: "Сканирую конкурентов в радиусе 1 км" });
    for (const c of competitors1km) {
      await sleep(90, signal);
      yield { type: "reveal-competitor", place: c };
    }
    competitorIds = competitors1km.map((c) => c.id);
    yield update(2, {
      status: "done",
      title: `Проанализировал ${competitors1km.length} конкурентов в радиусе 1 км`,
      input: { lat_lng: pin, radius_m: 1000 },
      output: {
        within_500m: analysis.competitors500m,
        within_1km: competitors1km.length,
        avg_rating: +(competitors1km.reduce((s, c) => s + (c.rating ?? 4), 0) / Math.max(1, competitors1km.length)).toFixed(1),
      },
    });
  }

  const input: EngineInput = {
    type,
    city: "Ташкент",
    district,
    investment,
    anchors: analysis.anchors,
    competitors500m: analysis.competitors500m,
    marketDemand: marketDemandFor(type, district),
    designAppeal: 90,
  };
  const result = simulate(input);
  const { scenarios, best } = runScenarios(input);

  // 4. Traffic
  yield update(3, { status: "running" });
  await delay(signal);
  yield update(3, {
    status: "done",
    input: { anchors: analysis.anchors, investment },
    output: { customers_per_day: result.customersPerDay, monthly_revenue: `${result.monthlyRevenue} млн` },
  });

  // 5. Simulation
  yield update(4, { status: "running" });
  await delay(signal);
  yield update(4, {
    status: "done",
    input: { scenarios: ["A", "B", "C"] },
    output: Object.fromEntries(scenarios.map((s) => [s.id, { score: s.result.pultikmaScore, profit: s.result.monthlyProfit }])),
  });

  // 6. Score
  yield update(5, { status: "running" });
  await delay(signal);
  yield update(5, { status: "done", input: { weights: "demand .2 / finance .3 / competition .25 / design .05 / location .2" }, output: { score: result.pultikmaScore, ...result.breakdown } });

  // 7. Report
  yield update(6, { status: "running" });
  await delay(signal);
  yield update(6, { status: "done", output: { verdict: result.verdict, pages: 6 } });

  const context: AgentContext = { goal, type, investment, focus, pin, district, address, candidates, competitorIds, input, result, scenarios, best };
  const delta = prev ? { from: prev.result.pultikmaScore, to: result.pultikmaScore } : null;
  const message =
    `Я проверил ${candidates.length} локации рядом с ${FOCUS_LABEL[focus]} и ${competitors1km.length} конкурентов в радиусе 1 км. ` +
    `Лучшая точка — ${address} (${district}). Вероятность успеха ${result.successProbability}%. ` +
    `Рекомендую сценарий ${best}${type === "cafe" && focus === "university" ? " и студенческие абонементы" : ""}.` +
    (delta && delta.from !== delta.to ? ` Скор ${delta.from} → ${delta.to}.` : "");
  yield { type: "final", context, message, delta };
}
