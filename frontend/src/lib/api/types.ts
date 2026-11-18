/** Backend contract types (mirrors backend/app/core/models.py) and shared labels. */

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
