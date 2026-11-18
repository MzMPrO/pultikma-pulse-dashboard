/**
 * The ONLY backend access of the frontend.
 * analyze() / chat() call the FastAPI backend (VITE_API_URL, default http://localhost:8000);
 * on network error, timeout (~4s) or non-OK response they fall back to a local deterministic mock
 * that returns the identical format, so the demo always works offline.
 *
 * Layout: types.ts (contract) | client.ts (fetch + timeouts) | chats.ts (user id + history)
 *         mock.ts (offline backend) | endpoints.ts (analyze / chat)
 */

export * from "./types";
export { CHAT_TIMEOUT_MS } from "./client";
export { analyze, chat } from "./endpoints";
export { deleteChat, getChat, getStoredSessionId, getUserId, listChats, newSessionId, storeSessionId } from "./chats";
export { distanceM, mockAnalyze, mockChat, resetMockSession } from "./mock";
