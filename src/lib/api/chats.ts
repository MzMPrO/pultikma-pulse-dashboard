/** Anonymous user id, current-session storage and chat history (backend first, localStorage in mock mode). */

import { request } from "./client";
import { mockSessionCategory, resetMockSession } from "./mock";
import {
  CATEGORY_LABEL,
  type Category,
  type ChatDetail,
  type ChatRequest,
  type ChatResponse,
  type ChatSummary,
} from "./types";

/* ------------------------------------------------------------------ */
/* Identity + local persistence (all localStorage access is guarded)   */
/* ------------------------------------------------------------------ */

const USER_KEY = "pulse.user_id";
const SESSION_KEY = "pulse.session_id";
const LOCAL_CHATS_KEY = "pulse.chats.v1";
const MAX_LOCAL_CHATS = 20;

function lsGet(key: string): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}
function lsSet(key: string, value: string): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(key, value);
  } catch {
    /* private mode / quota: memory only */
  }
}
const randomId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

let memoryUserId: string | null = null;
/** Anonymous persistent user id (localStorage). Falls back to a per-page-load id when storage is unavailable. */
export function getUserId(): string {
  const stored = lsGet(USER_KEY);
  if (stored) return stored;
  const id = memoryUserId ?? randomId("u");
  memoryUserId = id;
  lsSet(USER_KEY, id);
  return id;
}

export function newSessionId(): string {
  return randomId("s");
}
/** The chat the user was in before the reload (or null). */
export function getStoredSessionId(): string | null {
  return lsGet(SESSION_KEY);
}
export function storeSessionId(id: string): void {
  lsSet(SESSION_KEY, id);
}

type LocalChats = Record<string, ChatDetail>;
function readLocalChats(): LocalChats {
  try {
    const raw = lsGet(LOCAL_CHATS_KEY);
    const v = raw ? (JSON.parse(raw) as unknown) : null;
    return v && typeof v === "object" ? (v as LocalChats) : {};
  } catch {
    return {};
  }
}
function writeLocalChats(all: LocalChats): void {
  const ids = Object.keys(all).sort((a, b) => all[b]!.updated_at.localeCompare(all[a]!.updated_at));
  for (const id of ids.slice(MAX_LOCAL_CHATS)) delete all[id];
  lsSet(LOCAL_CHATS_KEY, JSON.stringify(all));
}

const placeTitle = (cat: Category, lat: number, lng: number) => `${CATEGORY_LABEL[cat]} · ${lat.toFixed(3)}, ${lng.toFixed(3)}`;

/** Mock-mode memory: remember a turn in localStorage with the same shapes the backend returns. */
export function recordLocalTurn(req: ChatRequest, res: ChatResponse): void {
  const all = readLocalChats();
  const chat: ChatDetail = all[req.session_id] ?? {
    session_id: req.session_id,
    title: "",
    updated_at: "",
    category: null,
    messages: [],
    analysis: null,
    location: null,
  };
  if (req.message.trim()) chat.messages.push({ role: "user", content: req.message });
  chat.messages.push({ role: "assistant", content: res.reply });
  chat.messages = chat.messages.slice(-40);
  chat.category = mockSessionCategory(req.session_id) ?? chat.category;
  if (res.analysis) {
    chat.analysis = res.analysis;
    chat.location = res.analysis.location;
    chat.category = res.analysis.category ?? chat.category;
  }
  if (chat.analysis && chat.category) {
    chat.title = placeTitle(chat.category, chat.analysis.location.lat, chat.analysis.location.lng);
  } else if (!chat.title) {
    const first = req.message.trim().replace(/\s+/g, " ");
    chat.title = first.length > 46 ? `${first.slice(0, 45)}…` : first || "Новый чат";
  }
  // strictly newer than every stored chat, so "newest first" is stable even within one millisecond
  const newest = Math.max(0, ...Object.values(all).map((c) => Date.parse(c.updated_at) || 0));
  chat.updated_at = new Date(Math.max(Date.now(), newest + 1)).toISOString();
  all[req.session_id] = chat;
  writeLocalChats(all);
}

/** Chat history, newest first. Backend first, local (mock-mode) chats when it is unreachable. */
export async function listChats(): Promise<ChatSummary[]> {
  try {
    return await request<ChatSummary[]>("GET", `/api/chats?user_id=${encodeURIComponent(getUserId())}`);
  } catch {
    const all = readLocalChats();
    return Object.values(all)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
      .map((c) => ({
        session_id: c.session_id,
        title: c.title,
        updated_at: c.updated_at,
        last_score: c.analysis?.score ?? null,
        category: c.category,
      }));
  }
}

/** One chat with its messages and last analysis (to restore the result panel), or null if unknown. */
export async function getChat(sessionId: string): Promise<ChatDetail | null> {
  try {
    return await request<ChatDetail>(
      "GET",
      `/api/chats/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(getUserId())}`,
    );
  } catch {
    return readLocalChats()[sessionId] ?? null;
  }
}

export async function deleteChat(sessionId: string): Promise<void> {
  const all = readLocalChats();
  if (all[sessionId]) {
    delete all[sessionId];
    writeLocalChats(all);
  }
  resetMockSession(sessionId);
  try {
    await request<unknown>(
      "DELETE",
      `/api/chats/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(getUserId())}`,
    );
  } catch {
    /* offline or not stored on the server */
  }
}
