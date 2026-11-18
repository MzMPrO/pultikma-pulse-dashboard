// Client-only module: imported lazily from ScoutMap (never during SSR).
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { LocateFixed, Minus, Plus } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Circle, MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";

import {
  CATEGORY_RU,
  COLORS,
  GEN_TYPE_RU,
  HIT,
  altHtml,
  centerPinHtml,
  closedHtml,
  competitorHtml,
  trafficHtml,
} from "@/shared/map/markers";
import { panelPadding, visibleCenter } from "@/features/scout/map/panels";
import { Tip as UiTip } from "./Hint";
import { StepPill } from "./StepPill";
import type { StepInfo } from "@/features/scout/lib/guidance";
import type { AnalyzeResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

export interface FlyTarget {
  lat: number;
  lng: number;
  zoom: number;
  nonce: number;
}

/** Fly to a marker and open its tooltip (e.g. click in the "closed" list). id = "x<id>" | "a<rank>". */
export interface FocusTarget {
  id: string;
  lat: number;
  lng: number;
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
  focus: FocusTarget | null;
  /** step indicator state (replaces the old «click on the map» hint) */
  step: StepInfo;
  onPick: (lat: number, lng: number) => void;
  onAltClick: (rank: number) => void;
  onReady?: (() => void) | undefined;
}

// CARTO Dark Matter basemap (no API key needed); overridable via env.
const ENV = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const TILES = ENV["VITE_TILE_URL"] || "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTR = ENV["VITE_TILE_ATTRIBUTION"] || "© OpenStreetMap contributors © CARTO";
const DEFAULT_CENTER: [number, number] = [41.31, 69.27];
const DEFAULT_ZOOM = 13;

type LayerKey = "point" | "competitors" | "closed" | "traffic" | "alts" | "radius";
type Hidden = Record<LayerKey, boolean>;
const NONE_HIDDEN: Hidden = { point: false, competitors: false, closed: false, traffic: false, alts: false, radius: false };

const nf = (n: number) => n.toLocaleString("ru-RU");

// ---------- icons (cached) ----------
const iconCache = new Map<string, L.DivIcon>();
function mk(key: string, html: string, anchor: [number, number] = [HIT / 2, HIT / 2], size = HIT) {
  const hit = iconCache.get(key);
  if (hit) return hit;
  const icon = L.divIcon({ className: "scout-marker", iconSize: [size, size], iconAnchor: anchor, html });
  iconCache.set(key, icon);
  return icon;
}
const competitorIcon = () => mk("comp", competitorHtml());
const closedIcon = () => mk("closed", closedHtml());
const trafficIcon = (type: string) => mk("tr:" + type, trafficHtml(type));
const altIcon = (rank: number, selected: boolean) => mk(`alt:${rank}:${selected}`, altHtml(rank, selected), [HIT / 2, HIT]);
const pinIcon = () => mk("pin", centerPinHtml(), [22, 22], 44);

// ---------- camera helpers ----------
function fitResult(map: L.Map, r: AnalyzeResponse, withAlts: boolean, animate = true) {
  const radius = r.location.radius_m || 500;
  const bounds = L.latLng(r.location.lat, r.location.lng).toBounds(radius * 2);
  if (withAlts) r.alternatives.forEach((a) => bounds.extend([a.lat, a.lng]));
  const pad = panelPadding();
  // on desktop the legend sits bottom-left of the free area: keep points clear of it
  if (window.innerWidth >= 1024) pad.bottom += 150;
  map.invalidateSize();
  map.fitBounds(bounds, {
    paddingTopLeft: [pad.left + 32, pad.top + 32],
    paddingBottomRight: [pad.right + 32, pad.bottom + 32],
    maxZoom: 16,
    animate,
  });
}

function flyVisible(map: L.Map, lat: number, lng: number, zoom: number, duration = 1.2) {
  try {
    map.invalidateSize();
    const c = visibleCenter(map, [lat, lng], zoom);
    const sz = map.getSize();
    if (sz.x > 0 && sz.y > 0) map.flyTo(c, zoom, { duration });
    else map.setView(c, zoom, { animate: false });
  } catch {
    map.setView([lat, lng], zoom, { animate: false });
  }
}

// ---------- map-internal helpers ----------
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
    if (fly) flyVisible(map, fly.lat, fly.lng, fly.zoom);
  }, [fly, map]);
  return null;
}

/** After analysis: fit the 500 m circle + alternatives into the area not covered by panels. */
function AutoFit({ result, withAlts }: { result: AnalyzeResponse | null; withAlts: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (!result || !withAlts) return;
    const t = setTimeout(() => fitResult(map, result, true), 120);
    return () => clearTimeout(t);
  }, [map, result, withAlts]);
  return null;
}

function Focuser({ focus, markers }: { focus: FocusTarget | null; markers: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    if (!focus) return;
    flyVisible(map, focus.lat, focus.lng, 17, 1);
    let done = false;
    const open = () => {
      if (done) return;
      done = true;
      markers.current.forEach((m, k) => k !== focus.id && m.closeTooltip());
      markers.current.get(focus.id)?.openTooltip();
    };
    map.once("moveend", open);
    const t = setTimeout(open, 1400);
    return () => {
      done = true;
      map.off("moveend", open);
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce, map]);
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

/** Exposes the Leaflet map instance to the overlay controls rendered outside <MapContainer>. */
function MapBridge({ mapRef }: { mapRef: React.RefObject<L.Map | null> }) {
  const map = useMap();
  useEffect(() => {
    mapRef.current = map;
    return () => {
      mapRef.current = null;
    };
  }, [map, mapRef]);
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

// ---------- tooltips ----------
function Tip({ title, lines, offset = -12 }: { title: string; lines: string[]; offset?: number }) {
  return (
    <Tooltip direction="top" offset={[0, offset]} className="scout-tip">
      <b>{title}</b>
      {lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </Tooltip>
  );
}

// ---------- legend ----------
const LEGEND: { key: LayerKey; label: string; swatch: string; hint?: string }[] = [
  { key: "point", label: "Ваша точка", swatch: `<div class="scout-legend-pin"></div>` },
  { key: "competitors", label: "Конкуренты", swatch: competitorHtml() },
  { key: "closed", label: "Закрытые", swatch: closedHtml() },
  { key: "traffic", label: "Генераторы трафика", swatch: trafficHtml("metro") },
  { key: "alts", label: "Лучшие места (№1–3)", swatch: altHtml(1) },
  { key: "radius", label: "Радиус 500 м", swatch: `<div class="scout-legend-ring"></div>` },
];

function Legend({
  counts,
  hidden,
  onToggle,
}: {
  counts: Partial<Record<LayerKey, number>>;
  hidden: Hidden;
  onToggle: (k: LayerKey) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="scout-noprint glass-dark absolute bottom-[calc(40vh+1rem)] left-2 z-[1000] rounded-2xl bg-[#0b0f1a]/80 text-xs text-ink-foreground lg:bottom-4 lg:left-[392px]"
      data-testid="map-legend"
    >
      <UiTip
        label="Обозначения на карте. Нажмите на пункт, чтобы скрыть или показать слой"
        side="top"
      >
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 px-3 py-2 font-medium lg:hidden"
          aria-expanded={open}
        >
          Легенда
        </button>
      </UiTip>
      <div className={cn("space-y-0.5 p-1.5", open ? "block" : "hidden lg:block")}>
        <UiTip label="Нажмите на пункт, чтобы скрыть или показать этот слой на карте" side="top">
          <div className="hidden cursor-help px-2 pb-1 pt-0.5 text-[10px] uppercase tracking-wider text-ink-muted lg:block">
            Легенда · нажмите, чтобы скрыть
          </div>
        </UiTip>
        {LEGEND.map((it) => {
          const n = counts[it.key];
          return (
            <button
              key={it.key}
              type="button"
              onClick={() => onToggle(it.key)}
              aria-pressed={!hidden[it.key]}
              data-off={hidden[it.key]}
              title={hidden[it.key] ? "Показать слой" : "Скрыть слой"}
              className="scout-legend-item flex w-full items-center gap-2 rounded-lg px-2 py-1 text-left transition-colors hover:bg-ink-foreground/10"
            >
              <span className="scout-legend-sw" dangerouslySetInnerHTML={{ __html: it.swatch }} />
              <span className="scout-legend-name flex-1 whitespace-nowrap">{it.label}</span>
              {n != null && <span className="ml-2 tabular-nums text-ink-muted">{n}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------- main ----------
export default function LeafletMap(p: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRefs = useRef(new Map<string, L.Marker>());
  const [hidden, setHidden] = useState<Hidden>(NONE_HIDDEN);
  const toggle = useCallback((k: LayerKey) => setHidden((h) => ({ ...h, [k]: !h[k] })), []);

  const reg = useCallback(
    (id: string) => (m: L.Marker | null) => {
      if (m) markerRefs.current.set(id, m);
      else markerRefs.current.delete(id);
    },
    [],
  );

  // make sure a focused marker's layer is visible
  useEffect(() => {
    if (!p.focus) return;
    const k: LayerKey | null = p.focus.id.startsWith("x") ? "closed" : p.focus.id.startsWith("a") ? "alts" : null;
    if (k) setHidden((h) => (h[k] ? { ...h, [k]: false } : h));
  }, [p.focus]);

  const recenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (p.result && p.showAlternatives) fitResult(map, p.result, true);
    else if (p.point) flyVisible(map, p.point.lat, p.point.lng, 15, 0.8);
    else map.flyTo(visibleCenter(map, DEFAULT_CENTER, DEFAULT_ZOOM), DEFAULT_ZOOM, { duration: 0.8 });
  };

  const items: { key: string; layer: LayerKey; node: React.ReactNode }[] = [];
  if (p.result) {
    const r = p.result;
    r.competitors.forEach((c) => {
      const cat = CATEGORY_RU[c.category];
      items.push({
        key: "c" + c.id,
        layer: "competitors",
        node: (
          <Marker position={[c.lat, c.lng]} icon={competitorIcon()} ref={reg("c" + c.id)}>
            <Tip title={c.name} lines={[cat ? `Конкурент · ${cat}` : "Конкурент"]} />
          </Marker>
        ),
      });
    });
    r.closed.forEach((c) =>
      items.push({
        key: "x" + c.id,
        layer: "closed",
        node: (
          <Marker position={[c.lat, c.lng]} icon={closedIcon()} ref={reg("x" + c.id)}>
            <Tip title={c.name} lines={[`Закрыто в ${c.closed_year}`, `Причина: ${c.reason}`]} />
          </Marker>
        ),
      }),
    );
    r.traffic_generators.forEach((g) =>
      items.push({
        key: "g" + g.id,
        layer: "traffic",
        node: (
          <Marker position={[g.lat, g.lng]} icon={trafficIcon(g.type)} ref={reg("g" + g.id)}>
            <Tip title={g.name} lines={[`${GEN_TYPE_RU[g.type] ?? "Генератор трафика"} · ~${nf(g.daily_flow)} чел/день`]} />
          </Marker>
        ),
      }),
    );
  }

  const counts: Partial<Record<LayerKey, number>> = p.result
    ? {
        competitors: p.result.competitors.length,
        closed: p.result.closed.length,
        traffic: p.result.traffic_generators.length,
        alts: p.result.alternatives.length,
      }
    : {};

  return (
    <div className={cn("relative h-full w-full", !p.point && !p.analyzing && "scout-crosshair")}>
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} zoomControl={false} className="h-full w-full" worldCopyJump={false}>
        <TileLayer url={TILES} attribution={ATTR} subdomains="abcd" maxZoom={20} />
        <MapEvents onPick={p.onPick} enabled={!p.analyzing} />
        <MapBridge mapRef={mapRef} />
        <ReadyNotifier onReady={p.onReady} />
        <Flyer fly={p.fly} />
        <Focuser focus={p.focus} markers={markerRefs} />
        <AutoFit result={p.result} withAlts={p.showAlternatives} />
        {p.point && (
          <>
            {!hidden.point && <Marker position={[p.point.lat, p.point.lng]} icon={pinIcon()} interactive={false} zIndexOffset={1000} />}
            {!hidden.radius && (
              <Circle
                center={[p.point.lat, p.point.lng]}
                radius={500}
                pathOptions={{
                  color: COLORS.point,
                  weight: 2,
                  fillColor: COLORS.point,
                  fillOpacity: 0.09,
                  dashArray: p.analyzing ? "6 6" : undefined,
                }}
                interactive={false}
              />
            )}
            {p.analyzing && <Radar lat={p.point.lat} lng={p.point.lng} />}
          </>
        )}
        {items
          .slice(0, p.visible)
          .filter((it) => !hidden[it.layer])
          .map((it) => (
            <Fragment key={it.key}>{it.node}</Fragment>
          ))}
        {p.showAlternatives &&
          !hidden.alts &&
          p.result?.alternatives.map((a) => (
            <Marker
              key={"a" + a.rank}
              position={[a.lat, a.lng]}
              icon={altIcon(a.rank, a.rank === p.selectedAlt)}
              zIndexOffset={a.rank === p.selectedAlt ? 900 : 800}
              ref={reg("a" + a.rank)}
              eventHandlers={{ click: () => p.onAltClick(a.rank) }}
            >
              <Tip title={`Лучшее место №${a.rank}`} lines={[`Score ${a.score} · ${nf(a.distance_m)} м от вашей точки`]} offset={-34} />
            </Marker>
          ))}
      </MapContainer>

      {/* step indicator (top-center of the free map area) */}
      <StepPill info={p.step} />
      {p.step.step === 2 && (
        <div
          className="scout-pulse-ring scout-noprint pointer-events-none absolute inset-0 z-[999]"
          aria-hidden
        />
      )}

      {/* zoom + recenter */}
      <div className="scout-noprint absolute bottom-[calc(40vh+1rem)] right-2 z-[1000] flex flex-col items-end gap-2 lg:bottom-auto lg:left-[392px] lg:right-auto lg:top-4 lg:items-start">
        <div className="glass-dark flex flex-col overflow-hidden rounded-xl bg-[#0b0f1a]/80 text-ink-foreground">
          <UiTip label="Приблизить" side="right">
            <button
              type="button"
              aria-label="Приблизить"
              onClick={() => mapRef.current?.zoomIn()}
              className="grid size-10 place-items-center transition-colors hover:bg-ink-foreground/10"
            >
              <Plus className="size-4" />
            </button>
          </UiTip>
          <div className="h-px bg-ink-border" />
          <UiTip label="Отдалить" side="right">
            <button
              type="button"
              aria-label="Отдалить"
              onClick={() => mapRef.current?.zoomOut()}
              className="grid size-10 place-items-center transition-colors hover:bg-ink-foreground/10"
            >
              <Minus className="size-4" />
            </button>
          </UiTip>
        </div>
        <UiTip label="Вернуть камеру к вашей точке и лучшим местам" side="right">
          <button
            type="button"
            onClick={recenter}
            className="glass-dark flex h-10 items-center gap-1.5 rounded-xl bg-[#0b0f1a]/80 px-3 text-xs text-ink-foreground transition-colors hover:bg-ink-foreground/10"
          >
            <LocateFixed className="size-4 text-cyan-brand" /> Центрировать
          </button>
        </UiTip>
      </div>

      <Legend counts={counts} hidden={hidden} onToggle={toggle} />
    </div>
  );
}
