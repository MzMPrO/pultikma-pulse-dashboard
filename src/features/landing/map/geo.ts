/** 1 map unit ≈ 85 m. */
export const UNIT_M = 85;
export const metersToUnits = (m: number) => m / UNIT_M;

export interface Point {
  x: number;
  y: number;
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const distM = (a: Point, b: Point) => Math.round(dist(a, b) * UNIT_M);

/**
 * Projection between the 0–100 × 0–80 demo canvas and real Tashkent coordinates.
 * Canvas centre (50, 40) sits on Amir Temur Square; 1 unit = UNIT_M metres.
 */
const CENTER = { lat: 41.3111, lng: 69.2797 };
const LAT_PER_UNIT = UNIT_M / 111_320;
const LNG_PER_UNIT = UNIT_M / (111_320 * Math.cos((CENTER.lat * Math.PI) / 180));

export const toLatLng = (p: Point) => ({
  lat: CENTER.lat - (p.y - 40) * LAT_PER_UNIT,
  lng: CENTER.lng + (p.x - 50) * LNG_PER_UNIT,
});

export const fromLatLng = (ll: { lat: number; lng: number }): Point => ({
  x: Math.round((50 + (ll.lng - CENTER.lng) / LNG_PER_UNIT) * 10) / 10,
  y: Math.round((40 - (ll.lat - CENTER.lat) / LAT_PER_UNIT) * 10) / 10,
});
