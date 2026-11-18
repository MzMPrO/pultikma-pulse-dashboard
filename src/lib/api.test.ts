import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SCENARIOS,
  chat,
  deleteChat,
  getChat,
  getStoredSessionId,
  getUserId,
  listChats,
  mockAnalyze,
  mockChat,
  storeSessionId,
  type ScenarioKey,
} from "./api";

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

describe("chat memory: user_id + history", () => {
  const offline = () => vi.fn().mockRejectedValue(new TypeError("offline"));
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("getUserId is generated once and persisted", () => {
    const id = getUserId();
    expect(id).toMatch(/^u-/);
    expect(getUserId()).toBe(id);
    expect(localStorage.getItem("pulse.user_id")).toBe(id);
  });

  it("getUserId and session storage survive a broken localStorage", () => {
    const spy = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    const setSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("denied");
    });
    try {
      const id = getUserId();
      expect(id).toMatch(/^u-/);
      expect(getUserId()).toBe(id); // stable within the page load
      expect(getStoredSessionId()).toBeNull();
      expect(() => storeSessionId("s-1")).not.toThrow();
    } finally {
      spy.mockRestore();
      setSpy.mockRestore();
    }
  });

  it("chat() sends user_id with every request (and keeps an explicit one)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ reply: "ok", quick_replies: [], need_location: false }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await chat({ session_id: "s-x", message: "привет" });
    await chat({ session_id: "s-x", message: "ещё", user_id: "custom" });
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string));
    expect(bodies[0]).toMatchObject({ session_id: "s-x", message: "привет", user_id: getUserId() });
    expect(bodies[1].user_id).toBe("custom");
  });

  it("history requests carry user_id in the query", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);
    await listChats();
    await getChat("s a/1");
    await deleteChat("s-1");
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls[0]).toContain(`/api/chats?user_id=${getUserId()}`);
    expect(urls[1]).toContain(`/api/chats/${encodeURIComponent("s a/1")}?user_id=`);
    expect((fetchMock.mock.calls[2]![1] as RequestInit).method).toBe("DELETE");
  });

  it("mock fallback stores chats in localStorage and lists / restores / deletes them", async () => {
    vi.stubGlobal("fetch", offline());
    const sid = "s-mock-1";
    await chat({ session_id: sid, message: "Хочу кофейню" });
    await chat({ session_id: sid, message: "С собой" });
    const inha = SCENARIOS.inha;
    const r = await chat({ session_id: sid, message: "Вот точка", lat: inha.lat, lng: inha.lng });
    expect(r.analysis?.score).toBe(84);
    await chat({ session_id: "s-mock-2", message: "привет" });

    const list = await listChats();
    expect(list.map((c) => c.session_id)).toEqual(["s-mock-2", sid]); // newest first
    const first = list[1]!;
    expect(first).toMatchObject({ last_score: 84, category: "coffee", title: "Кофейня · 41.338, 69.334" });
    expect(Date.parse(first.updated_at)).not.toBeNaN();
    expect(list[0]).toMatchObject({ last_score: null, title: "привет" });

    const detail = await getChat(sid);
    expect(detail?.messages[0]).toEqual({ role: "user", content: "Хочу кофейню" });
    expect(detail?.messages.at(-1)?.role).toBe("assistant");
    expect(detail?.analysis?.score).toBe(84);
    expect(detail?.location).toMatchObject({ lat: inha.lat, lng: inha.lng });
    expect(await getChat("nope")).toBeNull();

    await deleteChat(sid);
    expect(await getChat(sid)).toBeNull();
    expect((await listChats()).map((c) => c.session_id)).toEqual(["s-mock-2"]);
  });

  it("stored session id round-trips", () => {
    expect(getStoredSessionId()).toBeNull();
    storeSessionId("s-abc");
    expect(getStoredSessionId()).toBe("s-abc");
  });
});
