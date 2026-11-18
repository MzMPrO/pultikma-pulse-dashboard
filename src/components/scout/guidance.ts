// Pure helpers behind the "user friendly" layer of /app: onboarding flag, step indicator,
// plain-language headline and per-factor explanations. No React, no DOM — easy to unit-test.
import type { AnalyzeResponse, Factors } from "@/lib/api";

// ---------------------------------------------------------------- formatting

const nf = (n: number) => n.toLocaleString("ru-RU");

/** Russian plural: plural(1, ["заведение","заведения","заведений"]) -> "заведение". */
export function plural(n: number, forms: [string, string, string]): string {
  const a = Math.abs(Math.trunc(n)) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}

// ---------------------------------------------------------------- onboarding

export const ONBOARDING_KEY = "pultikma.onboarded.v1";

/** First visit to /app without an explicit ?scenario= -> show the welcome overlay. */
export function shouldShowOnboarding(scenario: string | undefined, seen: boolean): boolean {
  return !scenario && !seen;
}

export function hasSeenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    /* private mode / blocked storage: the overlay will simply show again */
  }
}

// ---------------------------------------------------------------- step indicator

export type StepNo = 1 | 2 | 3 | 4;

export interface StepInput {
  /** business category already chosen (card/chip/typed text/backend need_location) */
  categoryKnown: boolean;
  /** a point is selected on the map */
  hasPoint: boolean;
  /** radar animation is running */
  analyzing: boolean;
  /** a chat/analyze request is in flight */
  busy: boolean;
  /** analysis result is on screen */
  hasResult: boolean;
}

export interface StepInfo {
  step: StepNo;
  /** full pill text, e.g. «Шаг 2 из 3 · Кликните на карте, где хотите открыться» */
  label: string;
}

const STEP_LABEL: Record<StepNo, string> = {
  1: "Шаг 1 из 3 · Выберите тип бизнеса",
  2: "Шаг 2 из 3 · Кликните на карте, где хотите открыться",
  3: "Шаг 3 из 3 · Анализируем район…",
  4: "Готово · Результаты справа",
};

export function deriveStep(i: StepInput): StepInfo {
  let step: StepNo;
  if (i.analyzing) step = 3;
  else if (i.hasResult) step = 4;
  else if (i.busy && i.hasPoint && i.categoryKnown) step = 3;
  else if (i.categoryKnown) step = 2;
  else step = 1;
  return { step, label: STEP_LABEL[step] };
}

/** Does free text (card, chip or typed message) already name a business category? */
export function mentionsCategory(text: string): boolean {
  return /кофе|фастфуд|фаст-фуд|fast\s?food|кафе|аптек|ресторан|пекар|столов/i.test(text);
}

// ---------------------------------------------------------------- score scale

export function scoreColor(score: number) {
  return score > 70 ? "#22c55e" : score >= 50 ? "#eab308" : "#ef4444";
}

export type ScoreBand = "risk" | "maybe" | "good";

/** Same thresholds as scoreColor(): >70 good, 50..70 can be improved, <50 risk. */
export function scoreBand(score: number): ScoreBand {
  return score > 70 ? "good" : score >= 50 ? "maybe" : "risk";
}

// ---------------------------------------------------------------- factors

export type FactorKey = keyof Factors;

/** Display order of the factor list. */
export const FACTOR_ORDER: FactorKey[] = [
  "traffic",
  "competition",
  "closures",
  "rent",
  "visibility",
];

export const FACTOR_INFO: Record<FactorKey, { label: string; tip: string }> = {
  traffic: {
    label: "Поток клиентов",
    tip: "Сколько людей проходит рядом за день: метро, вузы, торговые центры, остановки.",
  },
  competition: {
    label: "Конкуренция",
    tip: "Открытые конкуренты той же категории в радиусе 500 м. Чем их меньше, тем выше оценка.",
  },
  closures: {
    label: "Закрываемость",
    tip: "Сколько похожих заведений рядом уже закрылось. Чем меньше закрытий, тем выше оценка.",
  },
  rent: {
    label: "Аренда",
    tip: "Средняя ставка аренды за м² в районе. Чем она ниже, тем выше оценка.",
  },
  visibility: {
    label: "Видимость",
    tip: "Первая линия или нет: насколько заведение заметно с улицы.",
  },
};

/** One-line explanation of a factor; numbers come only from the analysis object. */
export function describeFactor(key: FactorKey, r: AnalyzeResponse): string {
  const v = r.factors[key];
  switch (key) {
    case "traffic":
      return r.kpi.traffic_per_day <= 0
        ? "Пешеходного потока рядом не обнаружено"
        : `Около ${nf(r.kpi.traffic_per_day)} человек в день рядом`;
    case "competition": {
      const n = r.kpi.competitors;
      return n === 0
        ? "Открытых конкурентов в 500 м нет"
        : `${n} ${plural(n, ["открытый конкурент", "открытых конкурента", "открытых конкурентов"])} в 500 м`;
    }
    case "closures": {
      const n = r.kpi.closures;
      return n === 0
        ? "Закрытий рядом не было"
        : `Рядом закрыл${plural(n, ["ось", "ись", "ись"])} ${n} ${plural(n, ["похожее заведение", "похожих заведения", "похожих заведений"])}`;
    }
    case "rent":
      return `Около ${nf(r.kpi.rent_per_m2_uzs)} сум за м²`;
    case "visibility":
      return v >= 0.7
        ? "Первая линия: заведение хорошо видно"
        : v >= 0.4
          ? "Видно частично, не самая заметная линия"
          : "Не первая линия: заметность низкая";
  }
}

// ---------------------------------------------------------------- headline

/** Tie-break for equal factor values: heavier scoring weight first. */
const WEIGHT_RANK: FactorKey[] = ["traffic", "competition", "closures", "visibility", "rent"];

function pick(f: Factors, dir: "min" | "max"): FactorKey {
  let best: FactorKey = WEIGHT_RANK[0] as FactorKey;
  for (const k of WEIGHT_RANK) {
    if (dir === "min" ? f[k] < f[best] : f[k] > f[best]) best = k;
  }
  return best;
}

function weakPhrase(k: FactorKey, r: AnalyzeResponse): string {
  switch (k) {
    case "traffic":
      return r.kpi.traffic_per_day <= 0
        ? "рядом нет заметного пешеходного потока"
        : `поток всего около ${nf(r.kpi.traffic_per_day)} человек в день`;
    case "competition": {
      const n = r.kpi.competitors;
      return `в 500 м уже ${n} ${plural(n, ["конкурент", "конкурента", "конкурентов"])}`;
    }
    case "closures": {
      const n = r.kpi.closures;
      if (n <= 0) return "в районе много закрытий";
      return `рядом уже закры${plural(n, ["лось", "лись", "лись"])} ${n} ${plural(n, ["похожее заведение", "похожих заведения", "похожих заведений"])}`;
    }
    case "rent":
      return `аренда высокая, около ${nf(r.kpi.rent_per_m2_uzs)} сум за м²`;
    case "visibility":
      return "это не первая линия, заведение плохо заметно";
  }
}

function strongPhrase(k: FactorKey, r: AnalyzeResponse): string {
  switch (k) {
    case "traffic":
      return `большой поток, около ${nf(r.kpi.traffic_per_day)} человек в день`;
    case "competition": {
      const n = r.kpi.competitors;
      return n === 0 ? "рядом нет прямых конкурентов" : `конкурентов немного: ${n} в 500 м`;
    }
    case "closures": {
      const n = r.kpi.closures;
      return n === 0 ? "рядом ничего не закрывалось" : `закрытий почти нет: всего ${n}`;
    }
    case "rent":
      return `доступная аренда, около ${nf(r.kpi.rent_per_m2_uzs)} сум за м²`;
    case "visibility":
      return "первая линия, заведение хорошо видно";
  }
}

/** Weakest / strongest factor of an analysis (for tests and the headline). */
export function extremes(r: AnalyzeResponse): { weakest: FactorKey; strongest: FactorKey } {
  return { weakest: pick(r.factors, "min"), strongest: pick(r.factors, "max") };
}

/** One plain-language sentence under the score, e.g. «Не открывать: рядом уже закрылись 4 похожих заведения». */
export function buildHeadline(r: AnalyzeResponse): string {
  const { weakest, strongest } = extremes(r);
  const weak = weakPhrase(weakest, r);
  const strong = strongPhrase(strongest, r);
  switch (r.verdict) {
    case "no":
      return `Не открывать: ${weak}`;
    case "change":
      return r.factors[strongest] >= 0.6 && strongest !== weakest
        ? `Можно доработать: ${weak}, но ${strong}`
        : `Можно доработать: ${weak}`;
    case "go":
      return r.factors[weakest] < 0.45 && strongest !== weakest
        ? `Запускать: ${strong}, но ${weak}`
        : `Запускать: ${strong}`;
  }
}
