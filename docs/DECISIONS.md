
## Frontend

- **Single `/app` screen.** Old wizard / agent / map / fashion pages removed; `app.tsx` is a plain layout, `app.index.tsx` is the map + chat + results screen, `app.$.tsx` redirects any other `/app/*` to `/app`. `?scenario=inha|chilanzar|novza` auto-runs an analysis.
- **One backend door: `src/lib/api.ts`.** `analyze()` / `chat()` hit `VITE_API_URL` (default `http://localhost:8000`) with a ~4 s timeout; on network error, timeout or non-OK they fall back to a deterministic local mock with the identical response shape (the three demo scenarios return exactly 84 / 39 / 79). The demo therefore works with the backend off.
- **Leaflet is client-only.** `LeafletMap.tsx` (imports `leaflet` + its CSS) is loaded through `React.lazy` and only rendered after mount, so TanStack Start SSR never touches `window`.
- **Basemap.** CARTO Dark Matter (`basemaps.cartocdn.com/dark_all`) currently answers keyless requests with an "API KEY REQUIRED" watermark tile. Default is therefore OSM tiles darkened by a CSS filter (`.scout-osm .leaflet-tile-pane`). Set `VITE_TILE_URL` to the CARTO URL (with a valid key/plan) to use real Dark Matter tiles.
- **Items from the mock/backend with `source === "synthetic"`** get a small "demo data" badge in the results list.
- **Report download** is `window.print()` with `@media print` rules that show only the results panel.
- **Old engine/store/data kept.** `src/lib/engine.ts`, `mockAgent.ts`, `store`, `data` and their tests are untouched (still pass) but no longer used by the landing or `/app`.
- **Lockfiles.** Dependencies `leaflet`, `react-leaflet`, `@types/leaflet` were added with npm (`package-lock.json`); `bun.lock` was not regenerated.
