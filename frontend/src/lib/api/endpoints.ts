/** analyze() / chat(): the backend first, the local deterministic mock when it is unreachable. */

import { CHAT_TIMEOUT_MS, post } from "./client";
import { getUserId, recordLocalTurn } from "./chats";
import { mockAnalyze, mockChat } from "./mock";
import type { AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse } from "./types";

export async function analyze(req: AnalyzeRequest): Promise<AnalyzeResponse> {
  try {
    const r = await post<AnalyzeResponse>("/api/analyze", req);
    return { ...r, category: req.category };
  } catch {
    return mockAnalyze(req);
  }
}

export async function chat(req: ChatRequest): Promise<ChatResponse> {
  const full: ChatRequest = { ...req, user_id: req.user_id ?? getUserId() };
  try {
    return await post<ChatResponse>("/api/chat", full, CHAT_TIMEOUT_MS);
  } catch {
    // network error, timeout (90 s) or non-OK: fall back to the local mock so the UI never hangs
    const res = mockChat(full);
    recordLocalTurn(full, res);
    return res;
  }
}
