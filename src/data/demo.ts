import type { BusinessType, EngineInput } from "@/lib/engine";

export const DEMO_INPUT: EngineInput = {
  type: "cafe",
  city: "Ташкент",
  district: "Мирзо-Улугбек",
  investment: 100,
  anchors: { university: true, metro: false, mall: false },
  competitors500m: 5,
  marketDemand: 85,
  designAppeal: 90,
};

export const BUSINESS_TYPES: { id: BusinessType; emoji: string; label: string }[] = [
  { id: "cafe", emoji: "☕", label: "Кафе" },
  { id: "shop", emoji: "🏪", label: "Магазин" },
  { id: "beauty", emoji: "💄", label: "Салон красоты" },
  { id: "fashion", emoji: "👗", label: "Fashion-бренд" },
  { id: "production", emoji: "🏭", label: "Производство" },
  { id: "service", emoji: "💻", label: "Сервис" },
];

export const DISTRICTS = [
  "Юнусабад",
  "Чиланзар",
  "Мирзо-Улугбек",
  "Сергели",
  "Шайхантахур",
  "Яккасарай",
] as const;

export const SCORE_LABELS = {
  marketDemand: "Спрос на рынке",
  financialStability: "Финансовая устойчивость",
  competition: "Конкуренция",
  designAppeal: "Привлекательность дизайна",
  locationQuality: "Качество локации",
} as const;
