// Helpers that keep the map camera clear of the floating chat / results panels.
// Panels opt in with a `data-map-panel` attribute; we measure them at call time.
import type L from "leaflet";

export interface Pad {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** Screen space (px) currently covered by panels, per side of the viewport. */
export function panelPadding(): Pad {
  const pad: Pad = { top: 0, right: 0, bottom: 0, left: 0 };
  if (typeof document === "undefined") return pad;
  const W = window.innerWidth;
  const H = window.innerHeight;
  document.querySelectorAll<HTMLElement>("[data-map-panel]").forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return;
    if (r.width > W * 0.8) {
      // full-width sheet docked to the top or bottom (mobile)
      if (r.top + r.height / 2 < H / 2) pad.top = Math.max(pad.top, r.bottom);
      else pad.bottom = Math.max(pad.bottom, H - r.top);
    } else if (r.left + r.width / 2 < W / 2) {
      pad.left = Math.max(pad.left, r.right);
    } else {
      pad.right = Math.max(pad.right, W - r.left);
    }
  });
  return pad;
}

/** Map center that puts `latlng` in the middle of the part of the map not hidden by panels. */
export function visibleCenter(map: L.Map, latlng: L.LatLngExpression, zoom: number): L.LatLng {
  const pad = panelPadding();
  const dx = (pad.left - pad.right) / 2;
  const dy = (pad.top - pad.bottom) / 2;
  const target = map.project(latlng as L.LatLngExpression, zoom);
  return map.unproject(target.subtract([dx, dy]), zoom);
}
