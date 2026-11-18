/** Thin fetch wrapper for the FastAPI backend: base URL, timeouts and JSON request helpers. */

export const BASE: string = (
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.["VITE_API_URL"] ?? "http://localhost:8000"
).replace(/\/$/, "");
export const TIMEOUT_MS = 4000;
/** LLM chat replies take ~20-60 s, so chat() gets a much longer timeout than analyze()/history calls. */
export const CHAT_TIMEOUT_MS = 90_000;

export async function request<T>(
  method: "GET" | "POST" | "DELETE",
  path: string,
  body?: unknown,
  timeoutMs: number = TIMEOUT_MS,
): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? null : JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}
export const post = <T,>(path: string, body: unknown, timeoutMs?: number) => request<T>("POST", path, body, timeoutMs);
