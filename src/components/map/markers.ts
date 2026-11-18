// Shared marker visuals for the /app map and the landing hero map.
// Pure string builders (no Leaflet / React import) so they are SSR-safe.
import { ICON_SVG } from "./iconSvg";

export const COLORS = {
  point: "#2dd4bf",
  competitor: "#ef4444",
  closed: "#6b7280",
  traffic: "#14b8a6",
  alt: "#22c55e",
} as const;

export const CATEGORY_RU: Record<string, string> = {
  coffee: "кофейня",
  fastfood: "фастфуд",
  cafe: "кафе",
  pharmacy: "аптека",
};

export const GEN_TYPE_RU: Record<string, string> = {
  metro: "Метро",
  university: "Университет",
  school: "Школа",
  bus_stop: "Остановка",
  office_center: "Офисный центр",
  residential_complex: "Жилой комплекс",
  mall: "ТЦ",
  bazaar: "Базар",
  hospital: "Больница",
};

const GEN_ICON_KEY: Record<string, string> = {
  metro: "metro",
  university: "university",
  school: "school",
  bus_stop: "bus",
  office_center: "office",
  residential_complex: "home",
  mall: "store",
  bazaar: "store",
  hospital: "hospital",
};

export function svgIcon(key: string, size: number, stroke = 2.2): string {
  const inner = ICON_SVG[key] ?? ICON_SVG["pin"] ?? "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

/** Hit area (px) of the Leaflet divIcon box — bigger than the visible glyph. */
export const HIT = 40;

/** Red round marker with a cup icon. */
export function competitorHtml(): string {
  return `<div class="scout-m scout-m--comp">${svgIcon("coffee", 15)}</div>`;
}
/** Grey dashed round marker with ✕. */
export function closedHtml(): string {
  return `<div class="scout-m scout-m--closed">${svgIcon("x", 14, 3)}</div>`;
}
/** Teal rounded-square marker with the generator type icon. */
export function trafficHtml(type: string): string {
  return `<div class="scout-m scout-m--traffic">${svgIcon(GEN_ICON_KEY[type] ?? "pin", 16)}</div>`;
}
/** Green teardrop pin with the rank number. */
export function altHtml(rank: number, selected = false): string {
  return `<div class="scout-m scout-m--alt${selected ? " is-selected" : ""}"><span>${rank}</span></div>`;
}
/** Pulsing center pin (existing animation). */
export function centerPinHtml(): string {
  return `<div class="scout-pin"><i></i></div>`;
}
