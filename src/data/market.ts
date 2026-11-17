import type { BusinessType } from "@/lib/engine";

export interface DistrictInfo {
  name: string;
  x: number;
  y: number;
  /** Base market demand 0–100 */
  demand: number;
  /** Rent, тыс сум за м² в месяц */
  rent: number;
  /** Foot traffic index 0–100 */
  traffic: number;
}

export const DISTRICTS_INFO: DistrictInfo[] = [
  { name: "Мирзо-Улугбек", x: 62, y: 34, demand: 85, rent: 180, traffic: 82 },
  { name: "Юнусабад", x: 47, y: 30, demand: 80, rent: 200, traffic: 78 },
  { name: "Чиланзар", x: 24, y: 68, demand: 74, rent: 140, traffic: 76 },
  { name: "Сергели", x: 46, y: 74, demand: 62, rent: 95, traffic: 58 },
  { name: "Шайхантахур", x: 30, y: 44, demand: 77, rent: 160, traffic: 80 },
  { name: "Яккасарай", x: 40, y: 64, demand: 72, rent: 170, traffic: 66 },
];

export const TYPE_DEMAND_OFFSET: Record<BusinessType, number> = {
  cafe: 0,
  shop: -3,
  beauty: 2,
  fashion: -4,
  production: -10,
  service: 3,
};

export function marketDemandFor(type: BusinessType, district: string | undefined): number {
  const base = DISTRICTS_INFO.find((d) => d.name === district)?.demand ?? 78;
  return Math.max(0, Math.min(100, base + TYPE_DEMAND_OFFSET[type]));
}

export const MARKET_TRENDS = [
  { month: "Янв", cafe: 62, beauty: 55, fashion: 48 },
  { month: "Фев", cafe: 64, beauty: 58, fashion: 50 },
  { month: "Мар", cafe: 68, beauty: 62, fashion: 57 },
  { month: "Апр", cafe: 71, beauty: 63, fashion: 60 },
  { month: "Май", cafe: 75, beauty: 66, fashion: 64 },
  { month: "Июн", cafe: 79, beauty: 68, fashion: 66 },
  { month: "Июл", cafe: 82, beauty: 70, fashion: 68 },
  { month: "Авг", cafe: 84, beauty: 71, fashion: 72 },
  { month: "Сен", cafe: 85, beauty: 73, fashion: 75 },
];
