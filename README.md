# PulTikma AI

AI-помощник для предпринимателей Ташкента: опишите бизнес, выберите точку на карте — агент уточнит детали, проанализирует радиус 500 м (конкуренты, закрытые бизнесы и причины, генераторы трафика, аренда) и выдаст **PulTikma Score 0–100**, вердикт простым языком и **топ-3 лучших места рядом**.

**Прод:** https://pultikma.mzmpro.uz · **Демо-сценарии:** `/app?scenario=inha` (84), `/app?scenario=chilanzar` (39), `/app?scenario=novza` (79)

> Это аналитическая рекомендация, а не гарантия дохода.

## Возможности
- Лендинг `/` и рабочий экран `/app`: карта Ташкента (MapTiler dark), чат с агентом, анимация анализа, результаты.
- Агент задаёт уточняющие вопросы (категория, формат, чек, аудитория, бюджет), отвечает на русском или узбекском.
- Категории: **кофейня, фастфуд, кафе, аптека** (для других честно сообщает, что данных нет).
- Результаты: Score с вердиктом («Запускать / Изменить / Не открывать»), радар 5 факторов, KPI, закрытые бизнесы рядом с причинами, топ-3 альтернативы, сравнение, печать отчёта.
- Карта: легенда с переключением слоёв, маркеры с иконками и подсказками, круг 500 м.
- Если бэкенд недоступен — фронт работает на mock с тем же форматом.

## Скоринг (детерминированный Python, не LLM)
```
traffic  = min(поток_500м / 30000, 1)
competit = max(0, 1 - открытые_конкуренты / 5)
closures = max(0, 1 - закрытия / 4)
rent     = clip((350000 - аренда_м2) / 200000, 0, 1)
visible  = 1, если ближайший объект аренды на 1-й линии
score    = 100 × (0.25·traffic + 0.25·competit + 0.25·closures + 0.10·rent + 0.15·visible)
```
LLM только ведёт диалог и объясняет результат — все цифры приходят из скоринга.

## Стек
- **Фронт:** React 19, TypeScript, Vite, TanStack Start/Router, Tailwind v4, shadcn/ui, Leaflet, recharts, framer-motion, Vitest.
- **Бэкенд:** Python 3.11, FastAPI, Pydantic, numpy/pandas, httpx, psycopg, pytest.
- **Данные:** PostgreSQL 16 + PostGIS (или CSV в памяти — выбирается автоматически), датасет Ташкента, курс USD/UZS из API ЦБ (cbu.uz), OSM Overpass (`backend/scripts/live_data.py`).
- **AI:** любой OpenAI-совместимый LLM через `.env`, function calling.

Структура репозитория (монорепо):
```
frontend/   React 19 + TanStack Start (src/, public/, package.json, vite.config.ts, Dockerfile, .env.example)
backend/    FastAPI (app/, data/, scripts/, tests/, Dockerfile, .env.example)
docs/       ARCHITECTURE, DECISIONS, DEPLOY_PROMPT, SERVER_MIGRATION
docker-compose.yml, .env.example (только переменные compose), AGENTS.md
```
Подробнее: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), решения — [docs/DECISIONS.md](docs/DECISIONS.md), деплой — [docs/DEPLOY_PROMPT.md](docs/DEPLOY_PROMPT.md), миграция сервера на эту структуру — [docs/SERVER_MIGRATION.md](docs/SERVER_MIGRATION.md).

## Запуск локально

### Без Docker (быстро)
```sh
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt          # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000
```
В другом терминале:
```sh
cd frontend
cp .env.example .env                                   # PowerShell: copy .env.example .env
npm install
npm run dev
```

### С Docker + PostGIS
```sh
cp .env.example .env                    # переменные compose (POSTGRES_*, LLM_*)
docker compose up -d --build            # PostGIS 16 + backend :8000 + frontend :3000
python backend/scripts/load_data.py     # схема + загрузка CSV (нужен psycopg, DATABASE_URL)
```
Сервис `frontend` в compose (`frontend/Dockerfile`, Node 22, `NITRO_PRESET=node-server`) — **не проверялся** (Docker не использовался при написании); для разработки используйте `npm run dev`. Адрес API для браузера задаётся build-аргументом `VITE_API_URL` (по умолчанию `http://localhost:8000`).

`GET /api/health` показывает активное хранилище (`postgis` или `memory`) и подключён ли LLM.

### Продакшн-сборка фронтенда
```sh
cd frontend
VITE_API_URL=https://your-domain NITRO_PRESET=node-server npm run build
PORT=3000 HOST=127.0.0.1 node .output/server/index.mjs
```

## Настройки (.env)
- **`backend/.env`** (не коммитится): `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `DATABASE_URL`. Без LLM чат работает по сценарию. Шаблон — `backend/.env.example`. `CHAT_DB_PATH` — файл SQLite с памятью чатов (по умолчанию `backend/var/chat.db`, папка создаётся сама; в Docker — том `/app/var`).
- **`frontend/.env`** (не коммитится, вшивается в бандл при сборке, только публичные ключи): `VITE_API_URL`, `VITE_TILE_URL` (MapTiler), `VITE_TILE_ATTRIBUTION`, опционально Google Maps для декоративной карты лендинга. Шаблон — `frontend/.env.example`.
  **Файл не лежит в git — на сервере его нужно создать из `frontend/.env.example` перед сборкой.** Шаблон тайлов MapTiler (подставьте свой публичный ключ, домен должен быть разрешён в настройках ключа):
  `VITE_TILE_URL=https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}.png?key=YOUR_MAPTILER_KEY`
  Без `VITE_TILE_URL` карта использует CARTO Dark Matter (ключ не нужен).
- **`.env`** в корне (только для `docker compose`): `POSTGRES_USER/PASSWORD/DB`, `LLM_*`. Шаблон — `.env.example`.

## API
| Метод | Путь | Описание |
|---|---|---|
| POST | `/api/chat` | `{session_id, message, lat?, lng?, user_id?}` → `{reply, quick_replies[], need_location, analysis?}`. `user_id` (анонимный, из localStorage) включает память: сессия сохраняется и подмешиваются прошлые анализы из других чатов |
| GET | `/api/chats?user_id=` | история чатов пользователя, новые сверху: `[{session_id, title, updated_at, last_score, category}]` |
| GET | `/api/chats/{session_id}?user_id=` | `{messages[], analysis?, location?, ...}` — восстановить чат и панель результата |
| DELETE | `/api/chats/{session_id}?user_id=` | удалить чат |
| POST | `/api/analyze` | `{lat, lng, category, format?, avg_check?, audience?, budget?}` → Score, факторы, KPI, маркеры, топ-3 |
| GET | `/api/rate/usd` | курс USD/UZS (ЦБ, кэш 24 ч) |
| GET | `/api/health` | статус |

## Тесты
```sh
cd backend && .venv/Scripts/python -m pytest      # скоринг 84/39/79, данные, чат
cd frontend && npx tsc --noEmit && npx vitest run # фронт: типы, API/mock, роутинг
```

## Данные
`backend/data/*.csv` + `schema.sql` — датасет Ташкента. Большинство строк помечены `source=synthetic`/`estimated` (в интерфейсе бейдж «demo data»). Реальные источники: курс ЦБ (live), OSM через `backend/scripts/live_data.py` (пишет `backend/data/traffic_generators_osm.csv`).
