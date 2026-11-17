/**
 * PulTikma simulated "AI" engine — pure, deterministic, no network.
 * All business numbers in the app come from here. Money values are in млн сум.
 */

export type BusinessType = "cafe" | "shop" | "beauty" | "fashion" | "production" | "service";
export type RiskLevel = "Низкий" | "Средний" | "Высокий";
export type Verdict = "Запускать" | "Изменить" | "Не инвестировать";

export interface Anchors {
  university: boolean;
  metro: boolean;
  mall: boolean;
}

export interface EngineInput {
  type: BusinessType;
  city: string;
  district?: string;
  /** Initial investment, млн сум */
  investment: number;
  /** Monthly expenses override, млн сум. Derived from type + investment when omitted. */
  monthlyExpenses?: number;
  anchors: Anchors;
  /** Competitors within 500 m */
  competitors500m: number;
  /** Market demand 0–100 */
  marketDemand: number;
  /** Interior / brand appeal 0–100 */
  designAppeal?: number;
  /** Optional customers/day override from the user */
  expectedCustomers?: number;
}

export interface ScoreBreakdown {
  marketDemand: number;
  financialStability: number;
  competition: number;
  designAppeal: number;
  locationQuality: number;
}

export interface EngineResult {
  customersPerDay: number;
  monthlyRevenue: number;
  monthlyExpenses: number;
  monthlyProfit: number;
  /** null when the business never pays back */
  breakEvenMonths: number | null;
  riskScore: number;
  riskLevel: RiskLevel;
  successProbability: number;
  pultikmaScore: number;
  breakdown: ScoreBreakdown;
  verdict: Verdict;
  recommendation: string;
}

interface TypeProfile {
  baseCustomers: number;
  /** Average check, сум */
  avgCheck: number;
  /** Fixed monthly costs, млн сум */
  fixedCosts: number;
}

export const TYPE_PROFILES: Record<BusinessType, TypeProfile> = {
  cafe: { baseCustomers: 50, avgCheck: 21_430, fixedCosts: 18 },
  shop: { baseCustomers: 60, avgCheck: 28_000, fixedCosts: 20 },
  beauty: { baseCustomers: 14, avgCheck: 120_000, fixedCosts: 16 },
  fashion: { baseCustomers: 8, avgCheck: 350_000, fixedCosts: 22 },
  production: { baseCustomers: 6, avgCheck: 900_000, fixedCosts: 45 },
  service: { baseCustomers: 10, avgCheck: 180_000, fixedCosts: 12 },
};

const ANCHOR_CUSTOMERS = { university: 24, metro: 16, mall: 12 } as const;
const ANCHOR_LOCATION = { university: 20, metro: 14, mall: 10 } as const;
const SCORE_WEIGHTS = {
  marketDemand: 0.2,
  financialStability: 0.3,
  competition: 0.25,
  designAppeal: 0.05,
  locationQuality: 0.2,
} as const;
/** First months run below full capacity, so payback is slower than investment / profit. */
const RAMP_UP = 0.7;

const clamp = (v: number, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

export function locationScore(anchors: Anchors, competitors500m: number): number {
  let score = 62;
  if (anchors.university) score += ANCHOR_LOCATION.university;
  if (anchors.metro) score += ANCHOR_LOCATION.metro;
  if (anchors.mall) score += ANCHOR_LOCATION.mall;
  score -= Math.max(0, competitors500m - 6) * 3;
  return Math.round(clamp(score));
}

export function simulate(input: EngineInput): EngineResult {
  const profile = TYPE_PROFILES[input.type];
  const demand = clamp(input.marketDemand);
  const design = clamp(input.designAppeal ?? 90);
  const investment = Math.max(1, input.investment);

  // Customers
  let anchorBonus = 0;
  if (input.anchors.university) anchorBonus += ANCHOR_CUSTOMERS.university;
  if (input.anchors.metro) anchorBonus += ANCHOR_CUSTOMERS.metro;
  if (input.anchors.mall) anchorBonus += ANCHOR_CUSTOMERS.mall;
  const scale = profile.baseCustomers / 50;
  const demandFactor = 0.6 + (0.4 * demand) / 85;
  const investFactor = Math.max(0.4, 1 + 0.25 * Math.log2(investment / 100));
  const competitionPenalty = Math.max(0, input.competitors500m - 3) * 2 * scale;
  const modeled =
    (profile.baseCustomers + anchorBonus * scale) * demandFactor * investFactor -
    competitionPenalty;
  const customersPerDay = Math.max(
    0,
    Math.round(input.expectedCustomers ?? modeled),
  );

  // Money
  const monthlyRevenue = round1((customersPerDay * profile.avgCheck * 30) / 1_000_000);
  const monthlyExpenses = round1(
    input.monthlyExpenses ?? profile.fixedCosts + 12 * Math.sqrt(investment / 100),
  );
  const monthlyProfit = round1(monthlyRevenue - monthlyExpenses);
  const breakEvenMonths =
    monthlyProfit > 0 ? Math.ceil(investment / (monthlyProfit * RAMP_UP)) : null;

  // Risk
  const investmentCushion = clamp(5 * Math.log2(investment / 50), -10, 15);
  const riskScore = clamp(
    40 + input.competitors500m * 3 - (demand - 50) * 0.3 - investmentCushion,
  );
  const riskLevel: RiskLevel = riskScore < 30 ? "Низкий" : riskScore < 60 ? "Средний" : "Высокий";

  // Score
  const margin = monthlyRevenue > 0 ? monthlyProfit / monthlyRevenue : -1;
  const breakdown: ScoreBreakdown = {
    marketDemand: Math.round(demand),
    financialStability: Math.round(
      clamp(40 + margin * 105 - Math.max(0, (breakEvenMonths ?? 60) - 12) * 2),
    ),
    competition: Math.round(clamp(100 - input.competitors500m * 6)),
    designAppeal: Math.round(design),
    locationQuality: locationScore(input.anchors, input.competitors500m),
  };
  const rawScore = (Object.keys(SCORE_WEIGHTS) as (keyof ScoreBreakdown)[]).reduce(
    (sum, k) => sum + breakdown[k] * SCORE_WEIGHTS[k],
    0,
  );
  const pultikmaScore = Math.round(clamp(rawScore));
  const successProbability = Math.round(
    clamp(rawScore + (demand - 85) * 0.3 - (riskScore - 40) * 0.3, 1, 99),
  );

  const verdict: Verdict =
    pultikmaScore >= 70 && monthlyProfit > 0 && (breakEvenMonths ?? 99) <= 18
      ? "Запускать"
      : pultikmaScore >= 50 && monthlyProfit > 0
        ? "Изменить"
        : "Не инвестировать";

  return {
    customersPerDay,
    monthlyRevenue,
    monthlyExpenses,
    monthlyProfit,
    breakEvenMonths,
    riskScore: Math.round(riskScore),
    riskLevel,
    successProbability,
    pultikmaScore,
    breakdown,
    verdict,
    recommendation: buildRecommendation(input, verdict),
  };
}

function buildRecommendation(input: EngineInput, verdict: Verdict): string {
  const tips: string[] = [];
  if (input.type === "cafe" || input.type === "shop") {
    tips.push(
      input.anchors.university
        ? "Открыть рядом с университетами — студенческий трафик даёт стабильный поток клиентов. Добавьте студенческие абонементы."
        : "Открыть рядом с университетами: студенческий трафик повышает поток клиентов на 30–40%.",
    );
  }
  if (!input.anchors.metro && input.type !== "production") {
    tips.push("Рассмотрите точку в 5 минутах от метро для утреннего трафика.");
  }
  if (input.competitors500m > 8) {
    tips.push("Высокая конкуренция в радиусе 500 м — выделитесь концепцией или смените локацию.");
  }
  if (input.investment < 60) {
    tips.push("Бюджет ограничен: начните с компактного формата и онлайн-продаж.");
  }
  if (verdict === "Не инвестировать") {
    tips.unshift("Модель пока убыточна — пересмотрите расходы и локацию перед запуском.");
  }
  return tips.slice(0, 3).join(" ") || "Запускайте с пилотного формата и отслеживайте метрики первые 3 месяца.";
}

export interface Scenario {
  id: "A" | "B" | "C";
  name: string;
  input: EngineInput;
  result: EngineResult;
}

/** Low / Medium / Premium variants of the same idea. */
export function runScenarios(base: EngineInput): { scenarios: Scenario[]; best: Scenario["id"] } {
  const variants: Array<[Scenario["id"], string, number, number]> = [
    ["A", "Низкие инвестиции", 0.6, 75],
    ["B", "Средние инвестиции", 1, base.designAppeal ?? 90],
    ["C", "Премиум", 1.8, 96],
  ];
  const scenarios = variants.map(([id, name, k, design]) => {
    const { expectedCustomers: _ignored, monthlyExpenses, ...rest } = base;
    const input: EngineInput = {
      ...rest,
      investment: Math.round(base.investment * k),
      designAppeal: design,
      ...(monthlyExpenses ? { monthlyExpenses: round1(monthlyExpenses * (0.7 + 0.3 * k)) } : {}),
    };
    return { id, name, input, result: simulate(input) };
  });
  const best = scenarios.reduce((a, b) => (b.result.pultikmaScore > a.result.pultikmaScore ? b : a));
  return { scenarios, best: best.id };
}
