// Client-only module: imported lazily from ScoutMap (never during SSR).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

import type { AnalyzeResponse } from "@/lib/api";

export interface FlyTarget {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}

export interface LeafletMapProps {
  point: { lat: number; lng: number } | null;
  analyzing: boolean;
  result: AnalyzeResponse | null;
  /** how many of competitors+closed+generators are already revealed (one-by-one animation) */
  visible: number;
  showAlternatives: boolean;
  selectedAlt: number | null;
  fly: FlyTarget | null;
  onPick: (lat: number, lng: number) => void;
  onAltClick: (rank: number) => void;
  onReady?: (() => void) | undefined;
}

// CARTO Dark Matter basemap (no API key needed); overridable via env.
const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const TILES = ENV["VITE_TILE_URL"] || "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTR = ENV["VITE_TILE_ATTRIBUTION"] || "© OpenStreetMap contributors © CARTO";
const MAP_CLASS = "h-full w-full";

const GEN_ICON: Record<string, string> = {
  metro: "🚇",
  university: "🎓",
  bazaar: "🛒",
  mall: "🏬",
  hospital: "🏥",
};

const iconCache = new Map<string, L.DivIcon>();
function dot(size: number, bg: string, inner = "", extra = "") {
  const k = `${size}|${bg}|${inner}|${extra}`;
  const hit = iconCache.get(k);
  if (hit) return hit;
  const icon = L.divIcon({
    className: "scout-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="scout-dot" style="background:${bg};${extra}">${inner}</div>`,
  });
  iconCache.set(k, icon);
  return icon;
}

function MapEvents({ onPick, enabled }: { onPick: LeafletMapProps["onPick"]; enabled: boolean }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function Flyer({ fly }: { fly: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!fly) return;
    try {
      map.invalidateSize();
      const sz = map.getSize();
      if (sz.x > 0 && sz.y > 0) map.flyTo([fly.lat, fly.lng], fly.zoom, { duration: 1.2 });
      else map.setView([fly.lat, fly.lng], fly.zoom, { animate: false });
    } catch {
      map.setView([fly.lat, fly.lng], fly.zoom, { animate: false });
    }
  }, [fly, map]);
  return null;
}

function ReadyNotifier({ onReady }: { onReady?: (() => void) | undefined }) {
  const map = useMap();
  useEffect(() => {
    map.whenReady(() => {
      map.invalidateSize();
      onReady?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);
  return null;
}

/** 500 m radar sweep drawn as a divIcon sized to the current pixel radius of 500 m. */
function Radar({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoom: () => setZoom(map.getZoom()), zoomend: () => setZoom(map.getZoom()) });
  const px = Math.max(40, Math.round(500 / ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / Math.pow(2, zoom))));
  const icon = useMemo(
    () =>
      L.divIcon({
        className: "scout-marker",
        iconSize: [px * 2, px * 2],
        iconAnchor: [px, px],
        html: `<div class="scout-radar"></div>`,
      }),
    [px],
  );
  return <Marker position={[lat, lng]} icon={icon} interactive={false} zIndexOffset={-500} />;
}

export default function LeafletMap(p: LeafletMapProps) {
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: "scout-marker",
        iconSize: [44, 44],
        iconAnchor: [22, 22],
        html: `<div class="scout-pin"><i></i></div>`,
      }),
    [],
  );

  const items: { key: string; node: React.ReactNode }[] = [];
  if (p.result) {
    const r = p.result;
    r.competitors.forEach((c) =>
      items.push({
        key: "c" + c.id,
        node: (
          <Marker position={[c.lat, c.lng]} icon={dot(16, "#ef4444")}>
            <Tooltip direction="top" offset={[0, -8]}>{`Конкурент: ${c.name}`}</Tooltip>
          </Marker>
        ),
      }),
    );
    r.closed.forEach((c) =>
      items.push({
        key: "x" + c.id,
        node: (
          <Marker position={[c.lat, c.lng]} icon={dot(20, "#6b7280", "✕")}>
            <Tooltip direction="top" offset={[0, -10]}>{`Закрыто: ${c.name} — ${c.reason}`}</Tooltip>
          </Marker>
        ),
      }),
    );
    r.traffic_generators.forEach((g) =>
      items.push({
        key: "g" + g.id,
        node: (
          <Marker position={[g.lat, g.lng]} icon={dot(26, "#14b8a6", GEN_ICON[g.type] ?? "📍", "font-size:14px")}>
            <Tooltip direction="top" offset={[0, -12]}>{`${g.name} · ~${g.daily_flow.toLocaleString("ru-RU")} чел/день`}</Tooltip>
          </Marker>
        ),
      }),
    );
  }

  return (
    <MapContainer center={[41.31, 69.27]} zoom={13} zoomControl={false} className={MAP_CLASS} worldCopyJump={false}>
      <TileLayer url={TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />
      <MapEvents onPick={p.onPick} enabled={!p.analyzing} />
      <ReadyNotifier onReady={p.onReady} />
      <Flyer fly={p.fly} />
      {p.point && (
        <>
          <Marker position={[p.point.lat, p.point.lng]} icon={pinIcon} interactive={false} zIndexOffset={1000} />
          <Circle
            center={[p.point.lat, p.point.lng]}
            radius={500}
            pathOptions={{ color: "#2dd4bf", weight: 1.5, fillColor: "#2dd4bf", fillOpacity: 0.07, dashArray: p.analyzing ? "6 6" : undefined }}
            interactive={false}
          />
          {p.analyzing && <Radar lat={p.point.lat} lng={p.point.lng} />}
        </>
      )}
      {items.slice(0, p.visible).map((it) => (
        <Fragment key={it.key}>{it.node}</Fragment>
      ))}
      {p.showAlternatives &&
        p.result?.alternatives.map((a) => (
          <Marker
            key={"a" + a.rank}
            position={[a.lat, a.lng]}
            icon={dot(a.rank === p.selectedAlt ? 34 : 28, "#22c55e", String(a.rank), a.rank === p.selectedAlt ? "font-size:15px;box-shadow:0 0 0 4px rgb(34 197 94 / 40%)" : "font-size:14px")}
            zIndexOffset={800}
            eventHandlers={{ click: () => p.onAltClick(a.rank) }}
          >
            <Tooltip direction="top" offset={[0, -12]}>{`Альтернатива #${a.rank} · Score ${a.score} · ${a.distance_m} м`}</Tooltip>
          </Marker>
        ))}
    </MapContainer>
  );
}
