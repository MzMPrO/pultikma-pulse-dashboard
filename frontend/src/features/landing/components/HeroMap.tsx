// Client-only module: imported lazily from HeroVisual (never during SSR).
// Non-interactive real map of Mirzo-Ulugbek (around Inha) with the same markers as /app.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

import { HIT, centerPinHtml, closedHtml, competitorHtml, trafficHtml } from "@/shared/map/markers";
import scenarios from "@/lib/api/mockScenarios.json";

const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const TILES = ENV["VITE_TILE_URL"] || "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTR = ENV["VITE_TILE_ATTRIBUTION"] || "© OpenStreetMap contributors © CARTO";

const inha = scenarios.inha;
const CENTER: [number, number] = [inha.location.lat, inha.location.lng];

function icon(html: string, size = HIT, anchor: [number, number] = [size / 2, size / 2]) {
  return L.divIcon({ className: "scout-marker", iconSize: [size, size], iconAnchor: anchor, html });
}

export default function HeroMap({ onReady }: { onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const map = L.map(el, {
      center: CENTER,
      zoom: 14.5,
      zoomSnap: 0.25,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
      touchZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
    });
    L.control.attribution({ prefix: false, position: "bottomright" }).addAttribution(ATTR).addTo(map);
    const tiles = L.tileLayer(TILES, { subdomains: "abcd", maxZoom: 20, keepBuffer: 0 }).addTo(map);
    tiles.once("load", () => onReady?.());

    const circle = L.circle(CENTER, {
      radius: inha.location.radius_m,
      color: "#2dd4bf",
      weight: 1.5,
      fillColor: "#2dd4bf",
      fillOpacity: 0.08,
      interactive: false,
    }).addTo(map);

    const add = (lat: number, lng: number, html: string, z = 0) =>
      L.marker([lat, lng], { icon: icon(html), interactive: false, keyboard: false, zIndexOffset: z }).addTo(map);
    inha.competitors.forEach((c) => add(c.lat, c.lng, competitorHtml()));
    (inha.closed as { lat: number; lng: number }[]).forEach((c) => add(c.lat, c.lng, closedHtml()));
    inha.traffic_generators.forEach((g) => add(g.lat, g.lng, trafficHtml(g.type)));
    L.marker(CENTER, { icon: icon(centerPinHtml(), 44), interactive: false, keyboard: false, zIndexOffset: 1000 }).addTo(map);

    map.invalidateSize();
    map.fitBounds(circle.getBounds(), { padding: [4, 4], animate: false });
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
      map.fitBounds(circle.getBounds(), { padding: [4, 4], animate: false });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} className="hero-map h-full w-full" aria-hidden="true" />;
}
