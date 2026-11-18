/// <reference types="google.maps" />
import { useEffect, useRef, useState } from "react";

import type { MapViewProps } from "./MapView";
import { PLACES, type PlaceKind } from "@/features/landing/map/places";
import { distM, fromLatLng, toLatLng } from "@/features/landing/map/geo";
import { cn } from "@/lib/utils";

/** Google Maps needs literal colours; these mirror the brand tokens in styles.css. */
const KIND_COLOR: Record<PlaceKind, string> = {
  university: "#9b6bff",
  metro: "#4fd6f0",
  mall: "#f2b84b",
  competitor: "#ef5a4a",
  candidate: "#34c27a",
};
const KIND_LABEL: Record<PlaceKind, string> = {
  university: "Университет",
  metro: "Метро",
  mall: "Торговый центр",
  competitor: "Конкурент",
  candidate: "Кандидат",
};

const DARK_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#141625" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8fa8" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#141625" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ visibility: "on" }, { color: "#16261f" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#262a40" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#33385a" }] },
  { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#0d2a3a" }] },
  { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#2a2e48" }] },
];

declare global {
  interface Window {
    __pultikmaGmapsReady?: () => void;
    gm_authFailure?: () => void;
  }
}

let loader: Promise<void> | null = null;
const authFailListeners = new Set<() => void>();

function loadGoogleMaps(key: string): Promise<void> {
  if (window.google?.maps?.Map) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    window.__pultikmaGmapsReady = () => resolve();
    window.gm_authFailure = () => authFailListeners.forEach((fn) => fn());
    const channel = (import.meta.env["VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"] as string | undefined) ?? "";
    const s = document.createElement("script");
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}` +
      `&loading=async&callback=__pultikmaGmapsReady&language=ru&region=UZ&channel=${encodeURIComponent(channel)}`;
    s.async = true;
    s.onerror = () => {
      loader = null;
      reject(new Error("Google Maps failed to load"));
    };
    document.head.appendChild(s);
  });
  return loader;
}

type Props = MapViewProps & { apiKey: string; onFail: () => void };

/** Real Google map of Tashkent. Mock places are projected onto real coordinates. */
export default function GoogleMap({
  apiKey,
  onFail,
  className,
  pin = { x: 62, y: 34 },
  onPick,
  layers = { competitor: true, university: true, metro: true, mall: true, heat: false },
  radii = [500, 1000],
  candidates = [],
  visibleCompetitorIds,
  showPopup = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  const [ready, setReady] = useState(false);
  const interactive = Boolean(onPick || showPopup);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const fail = () => !cancelled && onFail();
    authFailListeners.add(fail);
    const timeout = window.setTimeout(fail, 12000);
    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !ref.current) return;
        const map = new google.maps.Map(ref.current, {
          center: toLatLng({ x: 50, y: 40 }),
          zoom: 13,
          styles: DARK_STYLE,
          backgroundColor: "#141625",
          clickableIcons: false,
          disableDefaultUI: true,
          zoomControl: interactive,
          gestureHandling: interactive ? "cooperative" : "none",
          keyboardShortcuts: interactive,
        });
        map.fitBounds(
          new google.maps.LatLngBounds(toLatLng({ x: 8, y: 76 }), toLatLng({ x: 92, y: 6 })),
          0,
        );
        map.addListener("click", (e: google.maps.MapMouseEvent) => {
          infoRef.current?.close();
          if (e.latLng && onPickRef.current) onPickRef.current(fromLatLng(e.latLng.toJSON()));
        });
        google.maps.event.addListenerOnce(map, "tilesloaded", () => {
          window.clearTimeout(timeout);
          if (!cancelled) setReady(true);
        });
        mapRef.current = map;
      })
      .catch(fail);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      authFailListeners.delete(fail);
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiKey]);

  // Sync markers, circles and pin whenever the inputs change.
  const overlayKey = JSON.stringify({ pin, layers, radii, candidates, visibleCompetitorIds, showPopup });
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    const overlays: { setMap: (m: google.maps.Map | null) => void }[] = [];
    const info = infoRef.current ?? (infoRef.current = new google.maps.InfoWindow());

    const visible = PLACES.filter((p) => {
      if (p.kind === "competitor") {
        if (!layers.competitor) return false;
        return !visibleCompetitorIds || visibleCompetitorIds.includes(p.id);
      }
      return Boolean(layers[p.kind as keyof typeof layers]);
    });

    if (layers.heat) {
      PLACES.filter((p) => p.kind === "competitor" && (!visibleCompetitorIds || visibleCompetitorIds.includes(p.id))).forEach((p) =>
        overlays.push(
          new google.maps.Circle({
            map,
            center: toLatLng(p),
            radius: 380,
            fillColor: KIND_COLOR.competitor,
            fillOpacity: 0.14,
            strokeOpacity: 0,
            clickable: false,
          }),
        ),
      );
    }

    if (pin) {
      radii.forEach((m, i) =>
        overlays.push(
          new google.maps.Circle({
            map,
            center: toLatLng(pin),
            radius: m,
            fillColor: i === 0 ? "#6c63ff" : "#9b6bff",
            fillOpacity: i === 0 ? 0.12 : 0.05,
            strokeColor: i === 0 ? "#6c63ff" : "#9b6bff",
            strokeOpacity: 0.6,
            strokeWeight: 1,
            clickable: false,
          }),
        ),
      );
    }

    visible.forEach((p) => {
      const marker = new google.maps.Marker({
        map,
        position: toLatLng(p),
        title: p.name,
        clickable: showPopup,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: p.kind === "competitor" ? 4.5 : 7,
          fillColor: KIND_COLOR[p.kind],
          fillOpacity: 1,
          strokeColor: "#141625",
          strokeWeight: 1.5,
        },
      });
      if (showPopup) {
        marker.addListener("click", () => {
          const box = document.createElement("div");
          box.className = "min-w-40 pr-1 text-xs text-foreground";
          const kind = document.createElement("div");
          kind.className = "uppercase tracking-wider text-muted-foreground text-[10px]";
          kind.textContent = KIND_LABEL[p.kind];
          const name = document.createElement("div");
          name.className = "mt-0.5 text-sm font-semibold";
          name.textContent = p.name;
          const meta = document.createElement("div");
          meta.className = "mt-1 text-muted-foreground";
          meta.textContent = [p.rating ? `★ ${p.rating}` : null, p.note, pin ? `${distM(p, pin)} м от точки` : null]
            .filter(Boolean)
            .join(" · ");
          box.append(kind, name, meta);
          info.setContent(box);
          info.open({ map, anchor: marker });
        });
      }
      overlays.push(marker);
    });

    candidates.forEach((c, i) =>
      overlays.push(
        new google.maps.Marker({
          map,
          position: toLatLng(c),
          title: c.label ?? `Кандидат ${String.fromCharCode(65 + i)}`,
          label: { text: String.fromCharCode(65 + i), color: "#ffffff", fontSize: "11px", fontWeight: "700" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 10,
            fillColor: KIND_COLOR.candidate,
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 1.5,
          },
          zIndex: 50,
        }),
      ),
    );

    if (pin) {
      overlays.push(
        new google.maps.Marker({
          map,
          position: toLatLng(pin),
          title: "Ваша точка",
          clickable: false,
          zIndex: 100,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: "#ffffff",
            fillOpacity: 1,
            strokeColor: "#6c63ff",
            strokeWeight: 4,
          },
        }),
      );
    }

    return () => overlays.forEach((o) => o.setMap(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, overlayKey]);

  return (
    <div
      ref={ref}
      className={cn("absolute inset-0 transition-opacity duration-700", ready ? "opacity-100" : "pointer-events-none opacity-0", className)}
    />
  );
}
