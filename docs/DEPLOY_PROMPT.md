# Промт для Claude Code на сервере — деплой PulTikma AI

Скопируй всё ниже в Claude Code на сервере.

---

Задеплой проект PulTikma AI на этот сервер под доменом **pultikma.mzmpro.uz** (HTTPS). Работай сам, вопросы — только если без ответа нельзя продолжить. В конце дай короткий отчёт: что сделано, URL, как перезапустить/обновить, известные проблемы.

## Проект
- Репозиторий: `https://github.com/MzMPrO/pultikma-pulse-dashboard.git`, ветка **`main`**.
- Клонируй в `/opt/pultikma` (если уже есть — `git fetch && git checkout main && git pull`).
- Репозиторий — монорепо: `frontend/` (фронт) и `backend/` (бэкенд), в корне `docker-compose.yml`, `docs/`.
- Фронт (`frontend/`): React 19 + TanStack Start (SSR) + Vite, сборка через `@lovable.dev/vite-tanstack-config` (nitro; Lovable больше не используется, пакет оставлен как пресет). По умолчанию nitro собирает под Cloudflare — **на сервере собирай под Node**: `cd /opt/pultikma/frontend && NITRO_PRESET=node-server npm run build` → запуск `node .output/server/index.mjs` (порт через `PORT`, хост `HOST=127.0.0.1`). Если preset не подхватился — проверь, что `frontend/.output/nitro.json` содержит `"preset": "node-server"` и есть `.output/server/index.mjs`; изменения — только через env, `vite.config.ts` не ломай.
- Бэкенд: FastAPI в `backend/` (Python 3.11), `backend/Dockerfile`, `docker-compose.yml` в корне (сервисы `db` = postgis/postgis:16-3.4 и `backend` на 8000). Данные — CSV в `backend/data/`, загрузка в PostGIS: `python backend/scripts/load_data.py` (нужен `DATABASE_URL`). Без БД бэкенд работает на CSV в памяти — это ок как запасной вариант.
- Фронт ходит в API через `VITE_API_URL` (вшивается при сборке). Если API недоступно — фронт работает на mock.

## Что сделать
1. Проверь/установи: git, Docker + compose plugin, Node 20+ (лучше 22), nginx, certbot. Проверь, что DNS `pultikma.mzmpro.uz` указывает на IP этого сервера (`dig +short`); если нет — сообщи и продолжай без HTTPS.
2. Секреты: создай `/opt/pultikma/.env` (только для compose; шаблон — `.env.example` в корне) с:
   ```
   POSTGRES_USER=pulse
   POSTGRES_PASSWORD=<сгенерируй случайный>
   POSTGRES_DB=pulse
   LLM_BASE_URL=   # спроси у меня, если не задано в окружении
   LLM_API_KEY=    # спроси у меня; не печатай ключ в логах/отчёте
   LLM_MODEL=
   ```
   Права `600`. Никогда не коммить `.env`.
   Отдельно создай `/opt/pultikma/frontend/.env` (VITE_* для сборки фронта; в git его нет, шаблон — `frontend/.env.example`; ключи публичные, но вшиваются в бандл):
   ```
   VITE_API_URL=https://pultikma.mzmpro.uz
   VITE_TILE_URL=https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}.png?key=<MAPTILER_KEY>   # спроси ключ у меня
   VITE_TILE_ATTRIBUTION=© MapTiler © OpenStreetMap contributors
   ```
   Права `600`.
3. docker-compose: **не публикуй** 5432 и 8000 наружу — поменяй на `127.0.0.1:5432:5432` и `127.0.0.1:8000:8000` (через `docker-compose.override.yml` на сервере, чтобы не трогать репо). Добавь `restart: unless-stopped`. `docker compose up -d --build db backend` (именно с перечислением сервисов: сервис `frontend` из compose на сервере не запускай — фронт работает как systemd-сервис на порту 3000).
4. Загрузи данные: `DATABASE_URL=postgresql://pulse:<pass>@127.0.0.1:5432/pulse python3 backend/scripts/load_data.py` (в venv, `pip install -r backend/requirements.txt`) или `docker compose exec backend python scripts/load_data.py`. Проверь `curl -s 127.0.0.1:8000/api/health` → `"repository":"postgis"`, `"llm_configured":true`.
5. Проверь скоринг (должно быть 84 / 39 / 79):
   ```
   curl -s -X POST 127.0.0.1:8000/api/analyze -H 'Content-Type: application/json' -d '{"lat":41.3378,"lng":69.3338,"category":"coffee"}'
   curl -s -X POST 127.0.0.1:8000/api/analyze -H 'Content-Type: application/json' -d '{"lat":41.2738,"lng":69.2052,"category":"fastfood"}'
   curl -s -X POST 127.0.0.1:8000/api/analyze -H 'Content-Type: application/json' -d '{"lat":41.2912,"lng":69.2210,"category":"pharmacy"}'
   ```
   Если с PostGIS цифры расходятся с CSV — сообщи (не подгоняй данные).
6. Фронт: `cd /opt/pultikma/frontend`, `npm ci` (если lock не подходит — `npm install`), затем `VITE_API_URL=https://pultikma.mzmpro.uz NITRO_PRESET=node-server npm run build`. Запусти как systemd-сервис `pultikma-web` (`WorkingDirectory=/opt/pultikma/frontend`, `Environment=PORT=3000 HOST=127.0.0.1`, `ExecStart=/usr/bin/node /opt/pultikma/frontend/.output/server/index.mjs`, `Restart=always`, отдельный пользователь без shell).
7. nginx `pultikma.mzmpro.uz`:
   - `/api/` → `http://127.0.0.1:8000` (`proxy_read_timeout 120s` — LLM отвечает до ~20–60 с);
   - `/` → `http://127.0.0.1:3000`;
   - gzip, `client_max_body_size 5m`, заголовки `X-Forwarded-*`.
   Затем `certbot --nginx -d pultikma.mzmpro.uz --redirect` (email спроси у меня, если certbot требует).
8. Firewall (ufw, если используется): открыть только 22, 80, 443.
9. Проверка end-to-end: `https://pultikma.mzmpro.uz/` (лендинг), `https://pultikma.mzmpro.uz/app?scenario=chilanzar` (скор 39), `https://pultikma.mzmpro.uz/api/health`. Проверь, что браузерные запросы фронта идут на `https://pultikma.mzmpro.uz/api/...` (без mixed content, CORS ок) и что чат отвечает.
10. Создай `/opt/pultikma/deploy.sh` для обновления: `git pull` → `docker compose up -d --build db backend` (сервис `frontend` из compose на сервере не используется) → `load_data.py` → `cd frontend && npm ci && NITRO_PRESET=node-server npm run build` → `systemctl restart pultikma-web`. Выведи в отчёте как его запускать.

## Ограничения
- Не пушь в репозиторий и не меняй историю. Серверные правки — только в override/конфигах вне репо.
- Не выводи секреты в отчёт.
- Карта: тайлы MapTiler (`VITE_TILE_URL` в `frontend/.env`, ключ публичный, вшивается при сборке). Если тайлы не грузятся на домене — проверь, что домен разрешён в настройках ключа MapTiler.
- Уже развёрнутый сервер со старой (плоской) структурой переводится на эту раскладку по [docs/SERVER_MIGRATION.md](SERVER_MIGRATION.md).
