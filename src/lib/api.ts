/**
 * The ONLY backend access of the frontend.
 * analyze() / chat() call the FastAPI backend (VITE_API_URL, default http://localhost:8000);
 * on network error, timeout (~4s) or non-OK response they fall back to a local deterministic mock
 * that returns the identical format, so the demo always works offline.
 */

import scenarioSnapshots from "./mockScenarios.json";

export type Category = "coffee" | "fastfood" | "cafe" | "pharmacy";
export type Verdict = "go" | "change" | "no";

export interface Factors {
  traffic: number;
  competition: number;
  closures: number;
  rent: number;
  visibility: number;
}

export interface AnalyzeRequest {
  lat: number;
  lng: number;
  category: Category;
  format?: string | undefined;
  avg_check?: number | undefined;
  audience?: string | undefined;
  budget?: number | undefined;
}

export interface Competitor {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  source: string;
}
export interface ClosedBusiness {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  reason: string;
  closed_year: number;
  source: string;
}
export interface TrafficGenerator {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: string;
  daily_flow: number;
  source: string;
}
export interface Alternative {
  rank: number;
  lat: number;
  lng: number;
  score: number;
  factors: Factors;
  distance_m: number;
}

export interface AnalyzeResponse {
  score: number;
  verdict: Verdict;
  verdict_text: string;
  factors: Factors;
  kpi: {
    competitors: number;
    closures: number;
    traffic_per_day: number;
    rent_per_m2_uzs: number;
    rent_per_m2_usd: number | null;
    usd_rate: number | null;
  };
  location: { lat: number; lng: number; radius_m: number };
  competitors: Competitor[];
  closed: ClosedBusiness[];
  traffic_generators: TrafficGenerator[];
  alternatives: Alternative[];
  explanation: string;
  /** client-side only: category used for the request */
  category?: Category;
}

export interface ChatRequest {
  session_id: string;
  message: string;
  lat?: number | undefined;
  lng?: number | undefined;
  /** anonymous persistent id; added automatically by chat() when omitted */
  user_id?: string | undefined;
}
export interface ChatResponse {
  reply: string;
  quick_replies: string[];
  need_location: boolean;
  analysis?: AnalyzeResponse;
}

/** One row of the chat history list (GET /api/chats). */
export interface ChatSummary {
  session_id: string;
  title: string;
  updated_at: string;
  last_score: number | null;
  category: Category | null;
}
export interface StoredMessage {
  role: "user" | "assistant";
  content: string;
}
/** A restored chat (GET /api/chats/{id}). */
export interface ChatDetail {
  session_id: string;
  title: string;
  updated_at: string;
  category: Category | null;
  messages: StoredMessage[];
  analysis: AnalyzeResponse | null;
  location: { lat: number; lng: number; radius_m?: number } | null;
}

export const SCENARIOS = {
  inha: { lat: 41.3378, lng: 69.3338, category: "coffee" as Category, label: "Кофейня у Inha" },
  chilanzar: { lat: 41.2738, lng: 69.2052, category: "fastfood" as Category, label: "Фастфуд у метро Чиланзар" },
  novza: { lat: 41.2912, lng: 69.221, category: "pharmacy" as Category, label: "Аптека у Новзы" },
};
export type ScenarioKey = keyof typeof SCENARIOS;

export const CATEGORY_LABEL: Record<Category, string> = {
  coffee: "Кофейня",
  fastfood: "Фастфуд",
  cafe: "Кафе",
  pharmacy: "Аптека",
};

const BASE: string = (
  (import.meta as unknown as { env?: Record<string, string | undefined> }).env?.["VITE_API_URL"] ?? "http://localhost:8000"
).replace(/\/$/, "");
const TIMEOUT_MS = 4000;
/** LLM chat replies take ~20-60 s, so chat() gets a much longer timeout than analyze()/history calls. */
export const CHAT_TIMEOUT_MS = 90_000;

async function request<T>(
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
const post = <T,>(path: string, body: unknown, timeoutMs?: number) => request<T>("POST", path, body, timeoutMs);

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
function recordLocalTurn(req: ChatRequest, res: ChatResponse): void {
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
  chat.category = sessions.get(req.session_id)?.category ?? chat.category;
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
  sessions.delete(sessionId);
  try {
    await request<unknown>(
      "DELETE",
      `/api/chats/${encodeURIComponent(sessionId)}?user_id=${encodeURIComponent(getUserId())}`,
    );
  } catch {
    /* offline or not stored on the server */
  }
}

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

/* ------------------------------------------------------------------ */
/* Local mock (identical format)                                       */
/* ------------------------------------------------------------------ */

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rng(seed: number) {
  let a = seed || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const M_LAT = 1 / 111_320;
function offset(lat: number, lng: number, dx: number, dy: number) {
  return { lat: lat + dy * M_LAT, lng: lng + (dx * M_LAT) / Math.cos((lat * Math.PI) / 180) };
}
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const dy = (a.lat - b.lat) * 111_320;
  const dx = (a.lng - b.lng) * 111_320 * Math.cos((a.lat * Math.PI) / 180);
  return Math.round(Math.hypot(dx, dy));
}

const clamp01 = (x: number) => Math.max(0.03, Math.min(0.99, x));
const r2 = (x: number) => Math.round(x * 100) / 100;

const CLOSED_NAMES: Record<Category, string[]> = {
  coffee: ["Coffee Point", "Bean & Go", "Кофе Дом", "Latte Corner"],
  fastfood: ["Burger Stop", "Lavash Express", "Street Doner", "Fry House"],
  cafe: ["Кафе Малика", "Choyxona Plus", "Bistro 24", "Sweet Corner"],
  pharmacy: ["Аптека Шифо", "Dori Plus", "Sog'lom Apteka", "Apteka 24"],
};
const COMP_NAMES: Record<Category, string[]> = {
  coffee: ["Safia Coffee", "Bonjour Cafe", "Coffee Lab", "Kofemania", "Black Bean", "Cup & Cake"],
  fastfood: ["Evos", "Max Way", "Oqtepa Lavash", "Burger House", "Kebab Point", "Street Food"],
  cafe: ["Ugra Lagman", "Cafe Anor", "Bon!", "Samarqand Oshxona", "Pizza Hub", "Sushi Mix"],
  pharmacy: ["Dori-Darmon", "Gripp Apteka", "Apteka Plus", "Nur Pharm", "Med Tochka", "Aptekа 36.6"],
};
const REASONS = [
  "высокая аренда",
  "нет парковки",
  "2-я линия, нет видимости",
  "низкий поток клиентов",
  "сильная конкуренция рядом",
  "сезонный спад выручки",
];
const GEN_TYPES: { type: string; names: string[]; flow: [number, number] }[] = [
  { type: "metro", names: ["Метро"], flow: [14000, 26000] },
  { type: "university", names: ["Университет", "Колледж"], flow: [4000, 9000] },
  { type: "bazaar", names: ["Базар", "Рынок"], flow: [8000, 18000] },
  { type: "mall", names: ["ТЦ"], flow: [6000, 15000] },
  { type: "hospital", names: ["Поликлиника", "Больница"], flow: [2500, 6000] },
];

/**
 * Static snapshot of the REAL backend /api/analyze responses for the three demo scenarios (real dataset,
 * spec formula): inha 84, chilanzar 39, novza 79. Regenerate it when the data or the formula change.
 */
const SCENARIO_SNAPSHOTS = scenarioSnapshots as unknown as Record<ScenarioKey, AnalyzeResponse>;

function matchScenario(lat: number, lng: number, cat: Category): ScenarioKey | null {
  for (const k of Object.keys(SCENARIOS) as ScenarioKey[]) {
    const s = SCENARIOS[k];
    if (s.category === cat && distanceM({ lat, lng }, s) < 250) return k;
  }
  return null;
}

const weightedScore = (f: Factors) =>
  Math.round(100 * (f.traffic * 0.3 + f.competition * 0.25 + f.closures * 0.2 + f.rent * 0.1 + f.visibility * 0.15));

const verdictOf = (score: number): Verdict => (score > 70 ? "go" : score >= 50 ? "change" : "no");
const verdictTextOf = (v: Verdict) => (v === "go" ? "Запускать" : v === "change" ? "Изменить" : "Не открывать");

export function mockAnalyze(req: AnalyzeRequest): AnalyzeResponse {
  const { lat, lng, category } = req;
  const key = matchScenario(lat, lng, category);
  if (key) {
    // the three demo scenarios: identical to what the backend returns for them on the real dataset
    const snap = SCENARIO_SNAPSHOTS[key];
    return { ...structuredClone(snap), category };
  }
  const seed = hashStr(`${lat.toFixed(3)}|${lng.toFixed(3)}|${category}`);
  const rand = rng(seed);

  const factors: Factors = {
    traffic: r2(clamp01(0.25 + rand() * 0.7)),
    competition: r2(clamp01(0.2 + rand() * 0.75)),
    closures: r2(clamp01(0.3 + rand() * 0.65)),
    rent: r2(clamp01(0.3 + rand() * 0.6)),
    visibility: r2(clamp01(0.2 + rand() * 0.75)),
  };
  const score = weightedScore(factors);
  const verdict = verdictOf(score);

  const nComp = Math.round(2 + (1 - factors.competition) * 8);
  const nClosed = Math.round((1 - factors.closures) * 5);
  const traffic = Math.round(4000 + factors.traffic * 26000);
  const rentUzs = Math.round((330_000 - factors.rent * 200_000) / 1000) * 1000;

  const pointAt = (i: number, n: number, minR: number, maxR: number) => {
    const ang = ((i + rand() * 0.6) / n) * Math.PI * 2 + rand() * 0.5;
    const rad = minR + rand() * (maxR - minR);
    return offset(lat, lng, Math.cos(ang) * rad, Math.sin(ang) * rad);
  };

  const compNames = COMP_NAMES[category];
  const competitors: Competitor[] = Array.from({ length: nComp }, (_, i) => ({
    id: `c${i + 1}`,
    name: compNames[i % compNames.length]!,
    ...pointAt(i, nComp, 60, 470),
    category,
    source: "synthetic",
  }));

  const closedNames = CLOSED_NAMES[category];
  const reasonsList = REASONS;
  const closed: ClosedBusiness[] = Array.from({ length: nClosed }, (_, i) => ({
    id: `x${i + 1}`,
    name: closedNames[i % closedNames.length]!,
    ...pointAt(i, Math.max(nClosed, 1), 80, 450),
    category,
    reason: reasonsList[(i + Math.floor(rand() * REASONS.length)) % reasonsList.length]!,
    closed_year: 2022 + Math.floor(rand() * 3),
    source: "synthetic",
  }));

  const gens = Array.from({ length: 2 + Math.floor(rand() * 2) }, () => {
    const g = GEN_TYPES[Math.floor(rand() * GEN_TYPES.length)]!;
    return {
      type: g.type,
      name: g.names[Math.floor(rand() * g.names.length)]!,
      flow: Math.round(g.flow[0] + rand() * (g.flow[1] - g.flow[0])),
    };
  });
  const traffic_generators: TrafficGenerator[] = gens.map((g, i) => ({
    id: `g${i + 1}`,
    name: g.name,
    ...pointAt(i, gens.length, 90, 430),
    type: g.type,
    daily_flow: g.flow,
    source: "synthetic",
  }));

  const altScores = [
    Math.min(95, score + 12 + Math.floor(rand() * 8)),
    Math.min(93, score + 8 + Math.floor(rand() * 6)),
    Math.min(91, score + 4 + Math.floor(rand() * 5)),
  ].sort((a, b) => b - a);
  const alternatives: Alternative[] = altScores.map((s, i) => {
    const p = pointAt(i, 3, 380, 900);
    const f: Factors = {
      traffic: r2(clamp01(factors.traffic * 0.85 + rand() * 0.15)),
      competition: r2(clamp01(factors.competition + 0.1 + rand() * 0.15)),
      closures: r2(clamp01(factors.closures + 0.1 + rand() * 0.1)),
      rent: r2(clamp01(factors.rent + (rand() - 0.4) * 0.2)),
      visibility: r2(clamp01(factors.visibility + 0.12 + rand() * 0.15)),
    };
    return { rank: i + 1, lat: p.lat, lng: p.lng, score: s, factors: f, distance_m: distanceM({ lat, lng }, p) };
  });

  const usdRate = 12_700;
  const explanation = `В радиусе 500 м: ${nComp} конкурентов, закрытий — ${nClosed}, ориентировочный поток около ${traffic.toLocaleString("ru-RU")} человек в день. ${
      verdict === "go"
        ? "Локация выглядит сильной."
        : verdict === "change"
          ? "Есть риски — стоит скорректировать формат или рассмотреть соседние точки."
          : "Риски выше потенциала — рассмотрите альтернативы."
    }`;

  return {
    score,
    verdict,
    verdict_text: verdictTextOf(verdict),
    factors,
    kpi: {
      competitors: nComp,
      closures: nClosed,
      traffic_per_day: traffic,
      rent_per_m2_uzs: rentUzs,
      rent_per_m2_usd: r2(rentUzs / usdRate),
      usd_rate: usdRate,
    },
    location: { lat, lng, radius_m: 500 },
    competitors,
    closed,
    traffic_generators,
    alternatives,
    explanation,
    category,
  };
}

/* ---- mock chat ---- */

interface Session {
  category?: Category | undefined;
  format?: string | undefined;
  lat?: number | undefined;
  lng?: number | undefined;
  awaiting?: boolean | undefined;
  uz?: boolean | undefined;
  unsupportedCount?: number | undefined;
  lastUnsupported?: string | undefined;
}
const sessions = new Map<string, Session>();

const CHIPS_CATEGORY = ["Кофейня", "Фастфуд", "Кафе", "Аптека"];
const CHIPS_FORMAT = ["С собой", "С посадкой"];

function detectCategory(text: string): Category | undefined {
  const t = text.toLowerCase();
  if (/фаст|fast|бургер|burger|шаурм|shawarma|лаваш|lavash|хот-?\s?дог|hot-?\s?dog|донер|doner|стрит|tez(kor)? ovqat/.test(t))
    return "fastfood";
  if (/кофе|coffee|капуч|qahva|kofe/.test(t)) return "coffee";
  if (/аптек|pharm|лекарств|apteka|dorixona|dorihona|дорихон/.test(t)) return "pharmacy";
  if (/кафе|ресторан|cafe|kafe|restoran|restaurant|столов|пицц|чайхан|choyxona|choyhona|oshxona/.test(t)) return "cafe";
  return undefined;
}
function detectFormat(text: string): string | undefined {
  const t = text.toLowerCase();
  if (/с собой|takeaway|навынос/.test(t)) return "takeaway";
  if (/посадк|зал|dine|в зале/.test(t)) return "dine_in";
  return undefined;
}

const GENERIC = /^(привет|здравств|салом|салам|salom|assalom|hello|hi|hey|помощ|help|yordam|не знаю|bilmayman|да|ha|нет|ok|ок|хорошо|бизнес|biznes|точк|nuqta|анализ|tahlil|оцени|хочу открыть|открыть)/i;

/** Short quote-safe echo of the unsupported business the user named, or undefined for generic chatter. */
function businessWord(message: string): string | undefined {
  const w = message.replace(/[\s"'«»“”]+/g, " ").replace(/^[\s.,!?:;\-–—]+|[\s.,!?:;\-–—]+$/g, "");
  if (!w || message.includes("?") || w.length > 40 || w.split(" ").length > 4) return undefined;
  if (GENERIC.test(w) && w.split(" ").length <= 3) return undefined;
  return w;
}

const UZ_STEMS = /qahva|dorixona|apteka|olib|zalda|kerak|ochmoq|salom|rahmat|boshqa|kafe|fastfud|biznes|ochish|menga|uchun|yaxshi/i;
const UNSUPPORTED_RU = [
  "Пока я анализирую только кофейни, фастфуд, кафе и аптеки — для «{w}» у меня нет данных о конкурентах и закрытиях. Выберите одну из категорий или ближайший формат:",
  "Выберите, пожалуйста, одну из четырёх категорий ниже 👇",
  "Для «{w}» данных нет. Нажмите на одну из кнопок: кофейня, фастфуд, кафе или аптека.",
];
const UNSUPPORTED_UZ = [
  "Hozircha men faqat qahvaxona, fastfud, kafe va dorixonalarni tahlil qilaman — «{w}» bo'yicha raqobatchilar va yopilganlar haqida ma'lumotim yo'q. Toifalardan birini yoki eng yaqin formatni tanlang:",
  "Iltimos, quyidagi to'rt toifadan birini tanlang 👇",
  "«{w}» bo'yicha ma'lumot yo'q. Tugmalardan birini bosing: qahvaxona, fastfud, kafe yoki dorixona.",
];
const CHIPS_CATEGORY_UZ = ["Qahvaxona", "Fastfud", "Kafe", "Dorixona"];

export function mockChat(req: ChatRequest): ChatResponse {
  const s = sessions.get(req.session_id) ?? {};
  sessions.set(req.session_id, s);
  const cat = detectCategory(req.message);
  if (cat) s.category = cat;
  const fmt = detectFormat(req.message);
  if (fmt) s.format = fmt;
  if (req.lat != null && req.lng != null) {
    s.lat = req.lat;
    s.lng = req.lng;
  }

  if (!s.category) {
    const hasPoint = req.lat != null && req.lng != null;
    const word = s.awaiting && !hasPoint && !/другая категория/i.test(req.message) ? businessWord(req.message) : undefined;
    s.awaiting = true;
    if (/[а-яё]/i.test(req.message)) s.uz = false;
    else if (UZ_STEMS.test(req.message)) s.uz = true;
    if (word) {
      const uz = !!s.uz;
      const key = word.toLowerCase();
      s.unsupportedCount = key === s.lastUnsupported ? (s.unsupportedCount ?? 0) + 1 : 0;
      s.lastUnsupported = key;
      const v = uz ? UNSUPPORTED_UZ : UNSUPPORTED_RU;
      const n = s.unsupportedCount;
      const text = v[n === 0 ? 0 : 1 + ((n - 1) % (v.length - 1))]!;
      return { reply: text.replace("{w}", word), quick_replies: uz ? CHIPS_CATEGORY_UZ : CHIPS_CATEGORY, need_location: false };
    }
    return { reply: "Уточните, какой бизнес вы хотите открыть?", quick_replies: CHIPS_CATEGORY, need_location: false };
  }
  s.awaiting = false;
  s.unsupportedCount = 0;
  s.lastUnsupported = undefined;
  // pharmacy has no meaningful dine-in/takeaway format
  if (!s.format && s.category !== "pharmacy") {
    return { reply: "Отлично! Какой формат: с собой или с посадкой?", quick_replies: CHIPS_FORMAT, need_location: false };
  }
  if (s.lat == null || s.lng == null) {
    return {
      reply: "Принято. Теперь отметьте точку на карте 📍 — я проверю район в радиусе 500 м.",
      quick_replies: [],
      need_location: true,
    };
  }
  const analysis = mockAnalyze({ lat: s.lat, lng: s.lng, category: s.category, format: s.format });
  // allow the next question to re-use category but ask for a new point
  s.lat = undefined;
  s.lng = undefined;
  return {
    reply: "Принято, запускаю анализ района в радиусе 500 м.",
    quick_replies: ["Сравнить с альтернативой", "Другая точка"],
    need_location: false,
    analysis,
  };
}

export function resetMockSession(id: string) {
  sessions.delete(id);
}
