import { useEffect, useRef } from "react";

import type { MapViewProps } from "./MapView";
import { PLACES } from "@/data/places";

/** Normalized map coords → real Tashkent lng/lat. */
const toLngLat = (x: number, y: number): [number, number] => [69.17 + (x / 100) * 0.2, 41.37 - (y / 80) * 0.12];

declare global {
  interface Window {
    ymaps3?: any;
  }
}

function loadScript(apiKey: string) {
  return new Promise<void>((resolve, reject) => {
    if (window.ymaps3) return resolve();
    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/v3/?apikey=${encodeURIComponent(apiKey)}&lang=ru_RU`;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("ymaps3 failed"));
    document.head.appendChild(s);
  });
}

/** Optional real map (Yandex Maps JS API v3). Calls onFail so MapView falls back to SVG. */
export default function YandexMap({ apiKey, className, pin, onFail }: MapViewProps & { apiKey: string; onFail: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: any;
    let cancelled = false;
    (async () => {
      try {
        await loadScript(apiKey);
        const ymaps3 = window.ymaps3;
        await ymaps3.ready;
        if (cancelled || !ref.current) return;
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker } = ymaps3;
        map = new YMap(ref.current, { location: { center: [69.2797, 41.3111], zoom: 12 }, theme: "dark" });
        map.addChild(new YMapDefaultSchemeLayer({}));
        map.addChild(new YMapDefaultFeaturesLayer({}));
        const marker = (x: number, y: number, color: string, size = 10) => {
          const el = document.createElement("div");
          el.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:${color};box-shadow:0 0 10px ${color}`;
          map.addChild(new YMapMarker({ coordinates: toLngLat(x, y) }, el));
        };
        const colors = { university: "#8b5cf6", metro: "#22d3ee", mall: "#f59e0b", competitor: "#ef4444", candidate: "#22c55e" } as const;
        PLACES.forEach((p) => marker(p.x, p.y, colors[p.kind], p.kind === "competitor" ? 8 : 11));
        if (pin) marker(pin.x, pin.y, "#ffffff", 16);
      } catch {
        if (!cancelled) onFail();
      }
    })();
    return () => {
      cancelled = true;
      map?.destroy?.();
    };
  }, [apiKey, pin, onFail]);

  return <div ref={ref} className={className} style={{ width: "100%", height: "100%" }} />;
}
