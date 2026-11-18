import { describe, expect, it } from "vitest";
import { SCENARIOS, mockAnalyze, mockChat, type ScenarioKey } from "./api";

// Real-dataset anchors (backend/tests/test_scoring.py): the mock must return exactly what the backend returns.
const EXPECTED: Record<ScenarioKey, { score: number; verdict: string; competitors: number; closures: number; traffic: number }> = {
  inha: { score: 84, verdict: "go", competitors: 1, closures: 0, traffic: 19_700 },
  chilanzar: { score: 39, verdict: "no", competitors: 3, closures: 4, traffic: 75_350 },
  novza: { score: 79, verdict: "go", competitors: 2, closures: 1, traffic: 59_300 },
};

describe("mock scenarios (snapshot of the real backend response)", () => {
  for (const key of Object.keys(EXPECTED) as ScenarioKey[]) {
    it(`${key} matches the backend`, () => {
      const s = SCENARIOS[key];
      const r = mockAnalyze({ lat: s.lat, lng: s.lng, category: s.category });
      const e = EXPECTED[key];
      expect(r.score).toBe(e.score);
      expect(r.verdict).toBe(e.verdict);
      expect(r.kpi.competitors).toBe(e.competitors);
      expect(r.kpi.closures).toBe(e.closures);
      expect(r.kpi.traffic_per_day).toBe(e.traffic);
      expect(r.competitors).toHaveLength(e.competitors);
      expect(r.closed).toHaveLength(e.closures);
      expect(r.traffic_generators.reduce((a, g) => a + g.daily_flow, 0)).toBe(e.traffic);
      expect(r.alternatives).toHaveLength(3);
      expect(r.category).toBe(s.category);
    });
  }

  it("returns an independent copy each call", () => {
    const s = SCENARIOS.inha;
    const a = mockAnalyze({ lat: s.lat, lng: s.lng, category: s.category });
    a.score = 1;
    expect(mockAnalyze({ lat: s.lat, lng: s.lng, category: s.category }).score).toBe(84);
  });

  it("chat without a category asks a clarifying question", () => {
    const r = mockChat({ session_id: "t-api-1", message: "привет" });
    expect(r.quick_replies).toEqual(["Кофейня", "Фастфуд", "Кафе", "Аптека"]);
    expect(r.analysis).toBeUndefined();
  });
});
