/** Local mock backend (identical response format) so the demo works offline. */

import scenarioSnapshots from "./mockScenarios.json";
import {
  SCENARIOS,
  type Alternative,
  type AnalyzeRequest,
  type AnalyzeResponse,
  type Category,
  type ChatRequest,
  type ChatResponse,
  type ClosedBusiness,
  type Competitor,
  type Factors,
  type ScenarioKey,
  type TrafficGenerator,
  type Verdict,
} from "./types";

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

/** Category remembered by the mock chat for a session (used by the localStorage history). */
export function mockSessionCategory(id: string): Category | undefined {
  return sessions.get(id)?.category;
}
