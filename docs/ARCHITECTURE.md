# PulTikma AI — структура кода и стек

## Как это работает
```
Браузер ──► Фронт (frontend/: React/TanStack Start, SSR)
              │  frontend/src/lib/api  (analyze(), chat(); 4 c таймаут → mock)
              ▼
           FastAPI backend :8000  ── /api/analyze, /api/chat, /api/rate/usd, /api/health
              │        │                     │
              │        │                     └─► cbu.uz (курс USD/UZS, кэш 24 ч)
              │        └─► LLM (OpenAI-совместимый, из .env) — только диалог и объяснение
              ▼
           Скоринг (детерминированный Python, радиус 500 м)
              │
     PostGIS (ST_DWithin)  или  CSV в памяти (haversine) — выбирается автоматически
```

## Структура
```
.
├── frontend/                     # React + TanStack Start (cd frontend && npm run dev)
│   ├── src/                      # Фронтенд (feature-based)
│   │   ├── routes/                   # TanStack Router (file routes, тонкие — только head() и страница из features/)
│   │   │   ├── __root.tsx            # корневой layout
│   │   │   ├── index.tsx             # / — лендинг (LandingPage)
│   │   │   ├── app.tsx               # /app layout
│   │   │   ├── app.index.tsx         # /app — главный экран (читает ?scenario=)
│   │   │   └── app.$.tsx             # /app/* → редирект на /app
│   │   ├── features/
│   │   │   ├── landing/
│   │   │   │   ├── components/       #   LandingPage + секции (Hero, HowItWorks, Features,
│   │   │   │   │                     #   ScoreSection — 5 факторов, DemoTeaser — 3 сценария, CTA)
│   │   │   │   └── map/              #   декоративная карта лендинга: MapView (SVG + Google Maps при ключе), geo, places
│   │   │   └── scout/                # экран /app
│   │   │       ├── components/
│   │   │       │   ├── ScoutPage.tsx     # чат с агентом, чипы, анимация анализа, состояние
│   │   │       │   ├── LeafletMap.tsx    # карта MapTiler dark, маркеры, круг 500 м, радар, flyTo
│   │   │       │   ├── ResultsPanel.tsx  # Score, вердикт, радар факторов, KPI, закрытия,
│   │   │       │   │                     #   топ-3, «Сравнить», «Скачать отчёт», дисклеймер
│   │   │       │   └── …                 # ChatHistory, Onboarding, EmptyState, StepPill, FactorList, Hint, MiniMarkdown
│   │   │       ├── lib/guidance.ts   #   чистые хелперы (заголовок, шаги, факторы) + тесты
│   │   │       └── map/panels.ts     #   геометрия панелей над картой
│   │   ├── shared/
│   │   │   ├── components/           # ScoreGauge, CountUp, FadeUp, Logo
│   │   │   ├── map/                  # iconSvg, markers — Leaflet-маркеры для /app и лендинга
│   │   │   └── i18n/                 # ru (основной), uz + стор локали (zustand)
│   │   ├── components/ui/            # shadcn/ui (components.json)
│   │   ├── hooks/                    # use-mobile (shadcn sidebar)
│   │   ├── lib/
│   │   │   ├── api/                  # ЕДИНСТВЕННАЯ точка доступа к бэкенду: import … from "@/lib/api"
│   │   │   │   ├── types.ts          #   контракт (Category, AnalyzeResponse, ChatResponse…), SCENARIOS
│   │   │   │   ├── client.ts         #   fetch + таймауты (4 c / 90 c для чата)
│   │   │   │   ├── endpoints.ts      #   analyze(), chat() с mock-фолбэком
│   │   │   │   ├── chats.ts          #   user_id, текущая сессия, история чатов (бэкенд → localStorage)
│   │   │   │   ├── mock.ts           #   офлайн-бэкенд того же формата
│   │   │   │   ├── mockScenarios.json#   снимок реальных ответов для Inha/Чиланзар/Новза
│   │   │   │   └── index.ts          #   публичный API (реэкспорт)
│   │   │   ├── utils.ts              # cn()
│   │   │   └── error-*.ts
│   │   └── styles.css                # Tailwind v4 + стили карты/маркеров
│   ├── public/, package.json, vite.config.ts, vitest.config.ts, tsconfig.json
│   ├── Dockerfile                # node 22, NITRO_PRESET=node-server (не проверен)
│   └── .env.example              # VITE_API_URL, VITE_TILE_*, Google Maps (frontend/.env не в git)
│
├── backend/                      # FastAPI (uvicorn app.main:app)
│   ├── app/
│   │   ├── main.py               # только сборка: lifespan, CORS, include_router
│   │   ├── api/                  # роутеры: analyze.py, chat.py, chats.py, misc.py (health, курс)
│   │   ├── core/
│   │   │   ├── config.py         #   env + загрузка backend/.env
│   │   │   └── models.py         #   Pydantic-контракт analyze/chat
│   │   ├── services/
│   │   │   ├── scoring.py        #   формула Score + поиск топ-3 (сетка 250 м, 2,5 км, ≥400 м)
│   │   │   ├── agent.py          #   агент: слоты, function calling, сценарный фолбэк
│   │   │   ├── llm.py            #   OpenAI-совместимый клиент (LLM_BASE_URL/KEY/MODEL)
│   │   │   ├── fx.py             #   курс ЦБ, кэш 24 ч
│   │   │   ├── chat_store.py     #   SQLite-память чатов
│   │   │   ├── texts.py          #   шаблоны ответов ru/uz
│   │   │   └── geo.py            #   haversine, сетка
│   │   └── repo/                 # репозитории данных
│   │       ├── base.py           #   маппинг колонок CSV/БД, фолбэк аренды по району
│   │       ├── memory.py         #   CSV в памяти
│   │       ├── postgis.py        #   PostGIS (ST_DWithin)
│   │       └── __init__.py       #   авто-выбор, повторная проверка БД каждые 30 с
│   ├── data/                     # датасет Ташкента (CSV + schema.sql)
│   ├── scripts/
│   │   ├── load_data.py          # схема + загрузка CSV в PostGIS
│   │   └── live_data.py          # OSM Overpass + курс ЦБ → data/traffic_generators_osm.csv
│   ├── tests/                    # pytest: 84/39/79, данные, чат, альтернативы
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml            # db (PostGIS 16) + backend + frontend
├── docs/
│   ├── DECISIONS.md              # принятые решения
│   ├── DEPLOY_PROMPT.md          # промт деплоя на pultikma.mzmpro.uz
│   ├── SERVER_MIGRATION.md       # промт миграции сервера на структуру frontend/ + backend/
│   └── ARCHITECTURE.md           # этот файл
├── .env.example                  # только переменные docker compose
├── AGENTS.md                     # правила проекта для агентов
└── README.md                     # запуск
```

## Стек
**Фронтенд:** React 19, TypeScript, Vite, TanStack Start + TanStack Router (SSR), Tailwind CSS v4, shadcn/ui (Radix), framer-motion, recharts (радар-диаграмма), Leaflet + react-leaflet (карта), тайлы CARTO Dark Matter (© OpenStreetMap contributors © CARTO), lucide-react, Vitest.

**Бэкенд:** Python 3.11, FastAPI, Uvicorn, Pydantic, httpx, numpy/pandas (векторный расчёт альтернатив), psycopg (PostgreSQL), pytest.

**Данные/инфра:** PostgreSQL 16 + PostGIS (docker-compose), CSV-датасет Ташкента (Gemini), OpenStreetMap Overpass API (`backend/scripts/live_data.py`), API ЦБ Узбекистана cbu.uz (курс USD/UZS).

**AI:** любой OpenAI-совместимый LLM через `.env` (сейчас OmniRoute → Claude Sonnet 4.5 через kiro), function calling (`ask_clarification`, `analyze_location`). Все цифры — только из детерминированного скоринга; LLM их не придумывает.

## Скоринг
```
traffic  = min(поток_500м / 30000, 1)
competit = max(0, 1 - открытые_конкуренты / 5)
closures = max(0, 1 - закрытия / 4)
rent     = clip((350000 - аренда_м2) / 200000, 0, 1)
visible  = 1, если ближайший объект аренды на 1-й линии
score    = 100 × (0.25·traffic + 0.25·competit + 0.25·closures + 0.10·rent + 0.15·visible)
```
Демо: Inha кофейня → 84, Чиланзар фастфуд → 39, Новза аптека → 79.

## Как делалось (инструменты разработки)
Claude Code (Opus 5.5 — планирование и постановка задач), субагенты Sonnet 5.5 — написание кода (фронт, бэкенд, подключение датасета), проверка в встроенном браузере, git/GitHub.
