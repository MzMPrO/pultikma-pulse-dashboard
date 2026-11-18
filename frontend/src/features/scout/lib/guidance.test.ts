import { describe, expect, it } from "vitest";

import {
  buildHeadline,
  deriveStep,
  describeFactor,
  extremes,
  mentionsCategory,
  plural,
  scoreBand,
  shouldShowOnboarding,
} from "./guidance";
import { mockAnalyze, type AnalyzeResponse } from "@/lib/api";

const base = {
  categoryKnown: false,
  hasPoint: false,
  analyzing: false,
  busy: false,
  hasResult: false,
};

type Over = Omit<Partial<AnalyzeResponse>, "factors" | "kpi"> & {
  factors?: Partial<AnalyzeResponse["factors"]>;
  kpi?: Partial<AnalyzeResponse["kpi"]>;
};

function fake(over: Over = {}): AnalyzeResponse {
  const a = mockAnalyze({ lat: 41.3, lng: 69.25, category: "coffee" });
  return {
    ...a,
    ...over,
    factors: {
      traffic: 0.6,
      competition: 0.6,
      closures: 0.6,
      rent: 0.6,
      visibility: 0.6,
      ...over.factors,
    },
    kpi: { ...a.kpi, ...(over.kpi ?? {}) },
  };
}

describe("plural", () => {
  const f: [string, string, string] = ["заведение", "заведения", "заведений"];
  it("picks the right Russian form", () => {
    expect([1, 2, 5, 11, 12, 21, 22, 25].map((n) => plural(n, f))).toEqual([
      "заведение",
      "заведения",
      "заведений",
      "заведений",
      "заведений",
      "заведение",
      "заведения",
      "заведений",
    ]);
  });
});

describe("deriveStep", () => {
  it("starts at step 1 until a category is known", () => {
    expect(deriveStep(base).step).toBe(1);
    expect(deriveStep(base).label).toBe("Шаг 1 из 3 · Выберите тип бизнеса");
  });
  it("step 2 once the category is known and no point is chosen", () => {
    const s = deriveStep({ ...base, categoryKnown: true });
    expect(s.step).toBe(2);
    expect(s.label).toBe("Шаг 2 из 3 · Кликните на карте, где хотите открыться");
  });
  it("step 3 while analysing or while the request for a chosen point is in flight", () => {
    expect(deriveStep({ ...base, categoryKnown: true, hasPoint: true, analyzing: true }).step).toBe(
      3,
    );
    expect(deriveStep({ ...base, categoryKnown: true, hasPoint: true, busy: true }).step).toBe(3);
    expect(deriveStep({ ...base, categoryKnown: true, hasPoint: true, busy: true }).label).toBe(
      "Шаг 3 из 3 · Анализируем район…",
    );
  });
  it("a click before choosing a category keeps step 1 (the agent will ask for it)", () => {
    expect(deriveStep({ ...base, hasPoint: true, busy: true }).step).toBe(1);
  });
  it("step 4 when the result is on screen; a new analysis goes back to 3", () => {
    expect(deriveStep({ ...base, categoryKnown: true, hasPoint: true, hasResult: true })).toEqual({
      step: 4,
      label: "Готово · Результаты справа",
    });
    expect(
      deriveStep({ ...base, categoryKnown: true, hasPoint: true, hasResult: true, analyzing: true })
        .step,
    ).toBe(3);
  });
});

describe("mentionsCategory", () => {
  it("recognises cards and free text", () => {
    for (const t of [
      "Кофейня",
      "фастфуд",
      "Кафе",
      "Аптека",
      "кофейня с собой для студентов, чек 25 000",
    ]) {
      expect(mentionsCategory(t)).toBe(true);
    }
    expect(mentionsCategory("Анализируй точку 41.3, 69.2")).toBe(false);
    expect(mentionsCategory("Другая точка")).toBe(false);
  });
});

describe("shouldShowOnboarding", () => {
  it("shows only on a first visit without ?scenario=", () => {
    expect(shouldShowOnboarding(undefined, false)).toBe(true);
    expect(shouldShowOnboarding(undefined, true)).toBe(false);
    expect(shouldShowOnboarding("inha", false)).toBe(false);
  });
});

describe("scoreBand", () => {
  it("matches the 0-49 / 50-70 / 71+ scale", () => {
    expect([0, 49, 50, 70, 71, 100].map(scoreBand)).toEqual([
      "risk",
      "risk",
      "maybe",
      "maybe",
      "good",
      "good",
    ]);
  });
});

describe("buildHeadline", () => {
  it("names closures as the weakest factor with the real count", () => {
    const r = fake({
      verdict: "no",
      factors: { closures: 0.1 },
      kpi: { ...fake().kpi, closures: 4 },
    });
    expect(extremes(r).weakest).toBe("closures");
    expect(buildHeadline(r)).toBe("Не открывать: рядом уже закрылись 4 похожих заведения");
  });
  it("singular and competition wording", () => {
    const one = fake({
      verdict: "no",
      factors: { closures: 0.1 },
      kpi: { ...fake().kpi, closures: 1 },
    });
    expect(buildHeadline(one)).toBe("Не открывать: рядом уже закрылось 1 похожее заведение");
    const comp = fake({
      verdict: "change",
      factors: { competition: 0.1, traffic: 0.5, closures: 0.5, rent: 0.5, visibility: 0.5 },
      kpi: { ...fake().kpi, competitors: 9 },
    });
    expect(buildHeadline(comp)).toBe("Можно доработать: в 500 м уже 9 конкурентов");
  });
  it("go: leads with the biggest strength and uses the traffic number", () => {
    const r = fake({
      verdict: "go",
      factors: { traffic: 0.95 },
      kpi: { ...fake().kpi, traffic_per_day: 12300 },
    });
    const h = buildHeadline(r);
    expect(h.startsWith("Запускать: большой поток, около ")).toBe(true);
    expect(h).toContain("12");
    expect(h).not.toContain("но");
  });
  it("change: mentions both the weak spot and a strong side", () => {
    const r = fake({ verdict: "change", factors: { visibility: 0.1, traffic: 0.9 } });
    const h = buildHeadline(r);
    expect(h).toContain("Можно доработать: это не первая линия");
    expect(h).toContain(", но большой поток");
  });
  it("does not claim «около 0 человек» when there is no traffic", () => {
    const r = fake({
      verdict: "change",
      factors: { traffic: 0, competition: 0.5, closures: 0.5, rent: 0.5, visibility: 0.5 },
      kpi: { ...fake().kpi, traffic_per_day: 0 },
    });
    expect(buildHeadline(r)).toBe("Можно доработать: рядом нет заметного пешеходного потока");
    expect(describeFactor("traffic", r)).toBe("Пешеходного потока рядом не обнаружено");
  });
  it("works for the real demo scenarios and never emits NaN/undefined", () => {
    for (const c of ["coffee", "fastfood", "pharmacy"] as const) {
      const h = buildHeadline(mockAnalyze({ lat: 41.3378, lng: 69.3338, category: c }));
      expect(h).not.toMatch(/NaN|undefined/);
      expect(h.length).toBeGreaterThan(15);
    }
  });
});

describe("describeFactor", () => {
  it("uses numbers from kpi only", () => {
    const r = fake({
      kpi: {
        ...fake().kpi,
        competitors: 3,
        closures: 0,
        traffic_per_day: 5000,
        rent_per_m2_uzs: 150000,
      },
    });
    expect(describeFactor("competition", r)).toBe("3 открытых конкурента в 500 м");
    expect(describeFactor("closures", r)).toBe("Закрытий рядом не было");
    expect(describeFactor("traffic", r)).toContain("5");
    expect(describeFactor("rent", r)).toContain("150");
    expect(describeFactor("visibility", fake({ factors: { visibility: 0.9 } }))).toContain(
      "Первая линия",
    );
  });
});
