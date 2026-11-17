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
