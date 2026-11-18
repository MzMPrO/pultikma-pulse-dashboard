import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SCENARIOS,
  chat,
  deleteChat,
  getChat,
  getStoredSessionId,
  getUserId,
  listChats,
  storeSessionId,
} from "./index";

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
