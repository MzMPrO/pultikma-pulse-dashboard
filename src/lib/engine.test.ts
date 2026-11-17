import { describe, expect, it } from "vitest";

import { DEMO_INPUT } from "@/data/demo";
import { simulate } from "@/lib/engine";

describe("engine — demo coffee shop (Ташкент, 100 млн сум)", () => {
  const r = simulate(DEMO_INPUT);
  it("70 customers/day", () => expect(r.customersPerDay).toBe(70));
  it("45 млн revenue", () => expect(r.monthlyRevenue).toBe(45));
  it("30 млн expenses", () => expect(r.monthlyExpenses).toBe(30));
  it("15 млн profit", () => expect(r.monthlyProfit).toBe(15));
  it("break-even 10 months", () => expect(r.breakEvenMonths).toBe(10));
  it("risk Средний", () => expect(r.riskLevel).toBe("Средний"));
  it("PulTikma score 78", () => expect(r.pultikmaScore).toBe(78));
  it("success probability 78%", () => expect(r.successProbability).toBe(78));
  it("recommends opening near universities", () =>
    expect(r.recommendation).toMatch(/^Открыть рядом с университетами/));
  it("verdict Запускать", () => expect(r.verdict).toBe("Запускать"));
});

describe("engine rules", () => {
  const base = { ...DEMO_INPUT, anchors: { university: false, metro: false, mall: false } };

  it("higher investment → higher revenue and lower risk", () => {
    const low = simulate({ ...base, investment: 60 });
    const high = simulate({ ...base, investment: 300 });
    expect(high.monthlyRevenue).toBeGreaterThan(low.monthlyRevenue);
    expect(high.riskScore).toBeLessThan(low.riskScore);
  });

  it("university / metro / mall nearby → more customers", () => {
    const none = simulate(base).customersPerDay;
    for (const key of ["university", "metro", "mall"] as const) {
      const withAnchor = simulate({ ...base, anchors: { ...base.anchors, [key]: true } });
      expect(withAnchor.customersPerDay).toBeGreaterThan(none);
    }
  });

  it("many competitors within 500 m → higher risk, lower revenue", () => {
    const few = simulate({ ...base, competitors500m: 2 });
    const many = simulate({ ...base, competitors500m: 12 });
    expect(many.riskScore).toBeGreaterThan(few.riskScore);
    expect(many.monthlyRevenue).toBeLessThan(few.monthlyRevenue);
  });

  it("strong market demand → higher success probability", () => {
    const weak = simulate({ ...base, marketDemand: 40 });
    const strong = simulate({ ...base, marketDemand: 95 });
    expect(strong.successProbability).toBeGreaterThan(weak.successProbability);
  });
});
