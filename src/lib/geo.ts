import { PLACES, type Place } from "@/data/places";
import { locationScore, type Anchors } from "@/lib/engine";

/** 1 map unit ≈ 85 m. */
export const UNIT_M = 85;
export const metersToUnits = (m: number) => m / UNIT_M;
export const ANCHOR_RADIUS = metersToUnits(800);
export const COMPETITOR_RADIUS = metersToUnits(500);

export interface Point {
  x: number;
  y: number;
}

export const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export const distM = (a: Point, b: Point) => Math.round(dist(a, b) * UNIT_M);

export interface PointAnalysis {
  anchors: Anchors;
  anchorPlaces: Place[];
  competitors500m: number;
  competitorsWithin: (meters: number) => Place[];
  locationScore: number;
}

export function analyzePoint(pt: Point): PointAnalysis {
  const near = (p: Place) => dist(p, pt) <= ANCHOR_RADIUS;
  const anchorPlaces = PLACES.filter((p) => p.kind !== "competitor" && p.kind !== "candidate" && near(p));
  const anchors: Anchors = {
    university: anchorPlaces.some((p) => p.kind === "university"),
    metro: anchorPlaces.some((p) => p.kind === "metro"),
    mall: anchorPlaces.some((p) => p.kind === "mall"),
  };
  const competitorsWithin = (meters: number) =>
    PLACES.filter((p) => p.kind === "competitor" && dist(p, pt) <= metersToUnits(meters));
  const competitors500m = competitorsWithin(500).length;
  return {
    anchors,
    anchorPlaces,
    competitors500m,
    competitorsWithin,
    locationScore: locationScore(anchors, competitors500m),
  };
}

/** Closest district by center. */
export function nearestDistrict<T extends Point & { name: string }>(pt: Point, list: T[]): T {
  return list.reduce((best, d) => (dist(d, pt) < dist(best, pt) ? d : best), list[0]!);
}

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
