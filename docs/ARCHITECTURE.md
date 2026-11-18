# PulTikma AI — структура кода и стек

## Как это работает
```
Браузер ──► Фронт (React/TanStack Start, SSR)
              │  src/lib/api.ts  (analyze(), chat(); 4 c таймаут → mock)
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
├── src/                          # Фронтенд
│   ├── routes/                   # TanStack Router (file routes)
│   │   ├── __root.tsx            # корневой layout
│   │   ├── index.tsx             # / — лендинг
│   │   ├── app.tsx               # /app layout
│   │   ├── app.index.tsx         # /app — главный экран (читает ?scenario=)
│   │   └── app.$.tsx             # /app/* → редирект на /app
│   ├── components/
│   │   ├── landing/              # секции лендинга (Hero, HowItWorks, Features,
│   │   │                         #   ScoreSection — 5 факторов, DemoTeaser — 3 сценария, CTA)
│   │   ├── scout/                # экран /app
│   │   │   ├── ScoutPage.tsx     #   чат с агентом, чипы, анимация анализа, состояние
│   │   │   ├── LeafletMap.tsx    #   карта CARTO dark, маркеры, круг 500 м, радар, flyTo
│   │   │   └── ResultsPanel.tsx  #   Score, вердикт, радар факторов, KPI, закрытия,
│   │   │                         #   топ-3, «Сравнить», «Скачать отчёт», дисклеймер
│   │   ├── shared/               # переиспользуемое: ScoreGauge, CountUp, FadeUp, Logo…
│   │   └── ui/                   # shadcn/ui
│   ├── lib/
│   │   ├── api.ts                # ЕДИНСТВЕННАЯ точка доступа к бэкенду + mock-фолбэк
│   │   ├── mockScenarios.json    # снимок реальных ответов для Inha/Чиланзар/Новза
│   │   └── api.test.ts           # тесты контракта/mock
│   ├── i18n/                     # ru (основной), uz
│   └── styles.css                # Tailwind v4 + стили карты/маркеров
│
├── backend/                      # FastAPI
│   ├── app/
│   │   ├── main.py               # роуты, CORS
│   │   ├── models.py             # Pydantic-контракт analyze/chat
│   │   ├── scoring.py            # формула Score + поиск топ-3 (сетка 250 м, 2,5 км, ≥400 м)
│   │   ├── geo.py                # haversine, сетка
│   │   ├── repo/                 # репозитории данных
│   │   │   ├── base.py           #   маппинг колонок CSV/БД, фолбэк аренды по району
│   │   │   ├── memory.py         #   CSV в памяти
│   │   │   ├── postgis.py        #   PostGIS (ST_DWithin)
│   │   │   └── __init__.py       #   авто-выбор, повторная проверка БД каждые 30 с
│   │   ├── agent.py              # агент: слоты, function calling, сценарный фолбэк
│   │   ├── llm.py                # OpenAI-совместимый клиент (LLM_BASE_URL/KEY/MODEL)
│   │   ├── texts.py              # шаблоны ответов ru/uz
│   │   ├── fx.py                 # курс ЦБ, кэш 24 ч
│   │   └── config.py             # env + загрузка backend/.env
│   ├── data/                     # датасет Ташкента (CSV + schema.sql), live_data.py (OSM)
│   ├── scripts/
│   │   ├── load_data.py          # схема + загрузка CSV в PostGIS
│   │   └── make_seed.py          # старый синтетический генератор (не используется)
│   ├── tests/                    # pytest: 84/39/79, данные, чат, альтернативы
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml            # db (PostGIS 16) + backend
├── docs/
│   ├── DECISIONS.md              # принятые решения
│   ├── DEPLOY_PROMPT.md          # промт деплоя на pultikma.mzmpro.uz
│   └── ARCHITECTURE.md           # этот файл
└── README.md                     # запуск
```

## Стек
**Фронтенд:** React 19, TypeScript, Vite, TanStack Start + TanStack Router (SSR), Tailwind CSS v4, shadcn/ui (Radix), framer-motion, recharts (радар-диаграмма), Leaflet + react-leaflet (карта), тайлы CARTO Dark Matter (© OpenStreetMap contributors © CARTO), lucide-react, Vitest. Шаблон — Lovable.

**Бэкенд:** Python 3.11, FastAPI, Uvicorn, Pydantic, httpx, numpy/pandas (векторный расчёт альтернатив), psycopg (PostgreSQL), pytest.

**Данные/инфра:** PostgreSQL 16 + PostGIS (docker-compose), CSV-датасет Ташкента (Gemini), OpenStreetMap Overpass API (`live_data.py`), API ЦБ Узбекистана cbu.uz (курс USD/UZS).

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
