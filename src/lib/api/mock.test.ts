import { describe, expect, it } from "vitest";

import { SCENARIOS, mockAnalyze, mockChat, type ScenarioKey } from "./index";

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

  it("chat: unsupported business gets an honest reply with 4 chips, varies on repeat, keeps the point", () => {
    const id = "t-api-unsupported";
    expect(mockChat({ session_id: id, message: "хочу открыть бизнес" }).reply).toMatch(/Уточните/);
    const a = mockChat({ session_id: id, message: "частная школа" });
    expect(a.reply).toContain("«частная школа»");
    expect(a.reply).toContain("нет данных");
    expect(a.quick_replies).toEqual(["Кофейня", "Фастфуд", "Кафе", "Аптека"]);
    const b = mockChat({ session_id: id, message: "частная школа" });
    expect(b.reply).not.toBe(a.reply);
    expect(b.reply.length).toBeLessThan(a.reply.length);
    expect(mockChat({ session_id: id, message: "частная школа" }).reply).not.toBe(b.reply);
    expect(mockChat({ session_id: id, message: "Школа" }).reply).toContain("«Школа»");
    // point is given while the category is still unknown: kept, and a chip then leads straight to analysis
    mockChat({ session_id: id, message: "Анализируй точку", lat: 41.2912, lng: 69.221 });
    const done = mockChat({ session_id: id, message: "Аптека" });
    expect(done.analysis).toBeDefined();
    expect(done.need_location).toBe(false);
  });

  it("chat: uzbek reply and synonyms", () => {
    mockChat({ session_id: "t-uz", message: "salom" });
    const r = mockChat({ session_id: "t-uz", message: "maktab" });
    expect(r.reply).toContain("«maktab»");
    expect(r.quick_replies).toEqual(["Qahvaxona", "Fastfud", "Kafe", "Dorixona"]);
    expect(mockChat({ session_id: "t-syn", message: "хот-дог" }).reply).toMatch(/формат/);
    expect(mockChat({ session_id: "t-syn2", message: "choyxona" }).reply).toMatch(/формат/);
  });
});
