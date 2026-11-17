import { describe, expect, it } from "vitest";

import { runAgent, type AgentContext, type AgentEvent } from "@/lib/mockAgent";

async function collect(goal: string, prev: AgentContext | null) {
  const events: AgentEvent[] = [];
  for await (const e of runAgent(goal, prev)) events.push(e);
  return events;
}

describe("mock agent", { timeout: 60_000 }, () => {
  it("demo coffee goal ends with PulTikma score 78", async () => {
    const events = await collect("Хочу открыть кофейню в Ташкенте, бюджет 100 млн сум", null);
    const final = events.at(-1);
    expect(final?.type).toBe("final");
    if (final?.type === "final") expect(final.context.result.pultikmaScore).toBe(78);
  });
});
