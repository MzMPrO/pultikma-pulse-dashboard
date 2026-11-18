
## Frontend

- **Single `/app` screen.** Old wizard / agent / map / fashion pages removed; `app.tsx` is a plain layout, `app.index.tsx` is the map + chat + results screen, `app.$.tsx` redirects any other `/app/*` to `/app`. `?scenario=inha|chilanzar|novza` auto-runs an analysis.
- **One backend door: `src/lib/api` (import from `"@/lib/api"`).** `analyze()` / `chat()` hit `VITE_API_URL` (default `http://localhost:8000`) with a ~4 s timeout; on network error, timeout or non-OK they fall back to a deterministic local mock with the identical response shape (the three demo scenarios return a static snapshot of the real backend responses, `src/lib/api/mockScenarios.json`: exactly 84 / 39 / 79). The demo therefore works with the backend off.
- **Leaflet is client-only.** `LeafletMap.tsx` (imports `leaflet` + its CSS) is loaded through `React.lazy` and only rendered after mount, so TanStack Start SSR never touches `window`.
- **Basemap.** CARTO Dark Matter (`basemaps.cartocdn.com/dark_all`) currently answers keyless requests with an "API KEY REQUIRED" watermark tile. Default is therefore OSM tiles darkened by a CSS filter (`.scout-osm .leaflet-tile-pane`). Set `VITE_TILE_URL` to the CARTO URL (with a valid key/plan) to use real Dark Matter tiles.
- **Items from the mock/backend with `source === "synthetic"`** get a small "demo data" badge in the results list.
- **Report download** is `window.print()` with `@media print` rules that show only the results panel.
- **Old engine/store/data removed.** The pre-backend demo engine (`engine`, `mockAgent`, `forecast`, `parser`, `stream`, demo/market data, dashboard widgets) was dead code and has been deleted; the only surviving piece of the old store is the locale store used by landing i18n (`src/shared/i18n`).
- **Lockfiles.** Dependencies `leaflet`, `react-leaflet`, `@types/leaflet` were added with npm (`package-lock.json`); `bun.lock` has since been regenerated (`bun install --lockfile-only`) and the unused `three` / `@react-three/*` packages were dropped.

## Backend

- **Stack**: FastAPI (Python 3.11) in `backend/`; PostgreSQL 16 + PostGIS via `docker-compose.yml` (`postgis/postgis:16-3.4`);
  deterministic scoring in Python, the LLM never produces numbers.
- **Repository abstraction** (`backend/app/repo`): `PostgisRepository` when `DATABASE_URL` is reachable and the tables are
  loaded, otherwise `MemoryRepository` reading `backend/data/*.csv` with haversine. `/api/health` returns
  `"repository": "postgis" | "memory"`. While on the fallback with `DATABASE_URL` set, the backend re-probes the DB every 30 s,
  so running `load_data.py` after the backend started is picked up without a restart.
  Radius queries use `ST_DWithin(geom::geography, point, 500)`; PostGIS uses the WGS84 spheroid and the in-memory repo a
  sphere (haversine), so points within ~0.3% of the 500 m boundary could differ - the seed keeps anchor objects >=40 m
  from the boundary. The top-3 alternatives grid (~320 points) is scored with numpy over tables cached from the DB
  (5 min TTL), so it stays well below 2 s with either repository.
- **Scoring**: `traffic=min(sum(daily_flow<=500m)/30000,1)`, `competition=max(0,1-open_same_category/5)`,
  `closures=max(0,1-closed_same_category/4)`, `rent=clip((350000-avg_rent)/200000,0,1)` (average of rent objects within
  500 m, else the nearest district's average, else mean of districts), `visibility=1` if the nearest rent object within
  500 m has `first_line`. Weights 0.25/0.25/0.25/0.10/0.15; verdict >70 go, 50-70 change, <50 no.
  Alternatives: 250 m grid within 2.5 km, same category, greedy best-first, >=400 m from the origin and from each other.
- **Data = the user's real (Gemini) Tashkent dataset** in `backend/data/` (`competitors, closures, traffic_generators, rent,
  districts, business_for_sale, benchmarks` + `schema.sql` + `README_dataset.md`). Be aware that the dataset itself marks
  nearly every row `source=synthetic`/`estimated` (see its README); `source` is passed through to the API and the UI badge.
  The old synthetic generator `backend/scripts/make_seed.py` was removed (it was no longer the data source).
  Demo anchors on this data, spec formula unchanged: Inha coffee (41.3378, 69.3338) = **84**, Chilanzar fastfood
  (41.2738, 69.2052) = **39**, Novza pharmacy (41.2912, 69.2210) = **79** (raw 0.844 / 0.394 / 0.788).
  The dataset README quotes slightly different Chilanzar coordinates (41.278, 69.206); that point scores 11 (5 open
  competitors, traffic 9,650), so the spec point (39) is the one used for the demo.
- **Bug found while loading it: closed places counted as competitors.** `competitors.csv` also lists
  `status=closed_permanently` rows (27 of 70). Counting them gave 84 / **29** / **74** (7 instead of 3 Chilanzar
  competitors, 3 instead of 2 at Novza). Only `status=open` rows are competitors now (memory repo, PostGIS dataset cache
  and radius query alike); closed businesses are counted via `closures.csv`, never twice. (Two closed competitors, C69 and
  C70, have no row in `closures.csv`; they are simply not counted.)
- **Column / name mapping** (CSV reader and DB rows share it, `repo/base.py`): `est_daily_people`->`daily_flow`,
  `closure_reason`->`reason`, `price_per_m2_uzs`->`rent_per_m2_uzs`, `street`/`title`->`name`, category `fast_food`->`fastfood`.
  PostGIS stores the dataset spelling (`fast_food`), so radius queries use `category = ANY(variants)`.
- **District rent without district coordinates.** `districts.csv` has names only (`Mirzo-Ulugbek`, `Chilonzor` and a
  city-wide `Tashkent` row). When no rent object lies within 500 m, a point's district is the district of the **nearest
  located object** (rent, competitor, closure, traffic generator; all carry `district`) and that district's
  `avg_rent_per_m2_uzs` is used; the final fallback is the `Tashkent` row (235,000), else the mean of districts, else
  350,000. The 3 demo anchors all have rent objects in range, so this fallback does not affect them.
- **`load_data.py`** drops the 7 tables, runs the (unchanged) `schema.sql`, and loads the CSV columns that exist in each table
  (so `source` is kept). Not run here (no Docker/PostgreSQL available); CSV headers were checked against `schema.sql`.
  Optional `traffic_generators_osm.csv` still takes precedence over `traffic_generators.csv`.
- **USD/UZS**: `GET https://cbu.uz/ru/arkhiv-kursov-valyut/json/USD/` -> `float(data[0]["Rate"])`, cached 24 h in memory,
  fetched at startup in a background thread (2 s timeout; a failed fetch is not retried for 5 min), fallback: last known
  value, else 12800. `backend/scripts/live_data.py` (OSM Overpass) can generate `traffic_generators_osm.csv` with live
  traffic generators; until then generators come from `traffic_generators.csv`.
- **AI agent**: plain OpenAI-compatible `/chat/completions` over httpx, configured only by `LLM_BASE_URL`, `LLM_API_KEY`,
  `LLM_MODEL`. Tools `ask_clarification` and `analyze_location`; the system prompt forbids inventing numbers. Sessions
  are in memory (`session_id`). Category gate: if the category is not recognised (ru/uz/en keywords) the LLM is not called
  and the category question is asked. Any LLM error falls back to the scripted flow: category -> format (skipped for
  pharmacy; asked once) -> `need_location` -> analysis with template text. Scripted chat answers in Uzbek when the user writes
  Uzbek; `/api/analyze` texts are Russian.
- **Contract**: `/api/analyze` and `/api/chat` shapes are fixed by `backend/app/core/models.py`; the frontend depends on them.
- **Chat memory** (`backend/app/chat_store.py`). Problem: the assistant forgot earlier chats (new `session_id` on every page load,
  sessions only in RAM). Identity is an anonymous `user_id` generated by the frontend (localStorage `pulse.user_id`) and sent
  with every `/api/chat`; without it the old stateless-contract behaviour is unchanged (in-memory session, no persistence).
  Storage is a small stdlib-`sqlite3` file (`CHAT_DB_PATH`, default `backend/var/chat.db`, gitignored, docker volume `/app/var`),
  independent of PostGIS so it also works with the memory/CSV repository. Two tables: `sessions` (PK `user_id, session_id`:
  title, slots as JSON, last 40 messages, last analysis, timestamps) and `analyses` (one row per analysis: category, place label,
  lat/lng, score, verdict). One short connection per operation + a write lock (safe from FastAPI's thread pool, WAL mode).
  `agent.get_session` is an in-memory cache that loads from the DB on a miss; every turn is saved after the reply is built
  (persistence is best-effort: a DB error is logged and never breaks the chat; if the file cannot be opened the store is
  disabled and `/api/chats*` return 503). **Cross-chat context**: the LLM system prompt gets "Прошлые анализы пользователя"
  (<=5 newest analyses from the user's OTHER sessions, same spot+category once; category, place label, coords, score,
  verdict, date). The prompt allows referring to / comparing with them but numbers only from that block or `analyze_location`.
  The scripted fallback appends "Раньше вы смотрели: ..." with the newest one. Place label = nearest traffic generator within
  600 m ("у <name>"), taken from the analysis itself, never invented. Chat title = "<Category> · lat, lng" after an analysis, else the
  first user message. Frontend keeps the current `session_id` in localStorage (`pulse.session_id`) and restores messages, result
  panel and map point on reload; «История» drawer lists chats, «Новый чат» starts a fresh session. In mock mode (backend
  unreachable) `api.ts` stores the same shapes in localStorage (`pulse.chats.v1`, last 20 chats), so history works offline.
  Limits: the `?scenario=` demo buttons call `/api/analyze` directly and are not stored; chat quick-reply chips are not
  persisted (a restored chat shows the default chips); no authentication, so anyone who knows a `user_id` can read its chats.

## Repository layout / Lovable removal

- **Monorepo.** Everything frontend moved from the repo root into `frontend/` (`git mv`, history preserved); `backend/` is unchanged. Root keeps only `docker-compose.yml`, `.env.example` (compose vars), `README.md`, `AGENTS.md`, `.gitignore`, `docs/`. Paths mentioned in older sections of this file as `src/...` now live under `frontend/src/...`. Tag `pre-restructure` marks the last commit of the old flat layout (rollback target; it is local until pushed).
- **Lovable is no longer used.** Removed `.lovable/`, the `LOVABLE:BEGIN/END` block in `AGENTS.md` and `src/lib/lovable-error-reporting.ts` (it only forwarded errors to Lovable editor hooks and was a no-op elsewhere; the call in `__root.tsx` was dropped).
- **`@lovable.dev/vite-tanstack-config` is KEPT** (devDependency, used by `frontend/vite.config.ts`). It bundles `tanstackStart`, `viteReact`, `tailwindcss`, tsconfig paths, the `@` alias, the VITE_* env injection and the nitro build config; replacing it with hand-written Vite/Nitro plugin config is non-trivial and risky for no functional gain. It is just a preset now, with no Lovable runtime dependency. Revisit later if desired (would need explicit `tanstackStart`/`nitro`/`@tailwindcss/vite` setup). `bunfig.toml` release-age excludes were trimmed to this one package.
- **Env var names unchanged.** The landing's Google Maps keys are still read from `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY` / `..._TRACKING_ID` (the name only; they are plain Google keys). Renaming would be a code + server-env change; left as is.
- **Env split.** `frontend/.env` (VITE_*; no longer tracked in git, ignored via `.gitignore`; template `frontend/.env.example`), `backend/.env` (secrets, ignored as before), root `.env` (docker-compose variables only; template `.env.example`). The VITE keys are public by nature (they ship in the browser bundle) but are no longer committed going forward; they remain in git history, so rotate/restrict them by domain in the MapTiler / Google consoles if that matters. The server must create `frontend/.env` before building (README, `docs/SERVER_MIGRATION.md`).
- **Frontend container (UNTESTED).** `frontend/Dockerfile` (node 22, `npm ci`, `NITRO_PRESET=node-server npm run build`, `node .output/server/index.mjs` on port 3000, `VITE_API_URL` build arg) and a `frontend` service in `docker-compose.yml` (published on `127.0.0.1:3000`) were added. Docker was not available when this was written, so the image was never built; the equivalent non-Docker steps (`NITRO_PRESET=node-server npm run build` and running `.output/server/index.mjs`) were verified. The production server keeps using the systemd service + nginx, so it must start compose with `docker compose up -d db backend` only (the compose `frontend` would fight over port 3000).
