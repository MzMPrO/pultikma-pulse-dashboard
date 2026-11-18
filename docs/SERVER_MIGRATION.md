# Миграция сервера на структуру `frontend/` + `backend/`

Репозиторий переехал в монорепо: весь фронтенд лежит в `frontend/` (раньше — в корне), `backend/` не менялся. Lovable больше не используется. Ниже — промт для Claude Code **на сервере**, где проект уже развёрнут в `/opt/pultikma` (старая плоская структура). Перед миграцией тег `pre-monorepo` (коммит `ae535ba`) указывает на последний коммит старой структуры (если тег ещё не запушен — используй хеш `ae535ba`).

Скопируй всё после линии в Claude Code на сервере.

---

Мигрируй существующий деплой PulTikma AI в `/opt/pultikma` на новую структуру репозитория. Работай сам, вопросы — только если без ответа нельзя продолжить. В конце — короткий отчёт (что сделано, что проверено, что осталось). Не выводи секреты в отчёт. Не пушь в репозиторий.

## Что изменилось в репо
- Всё фронтендное из корня переехало в `frontend/` (`src/`, `public/`, `package.json`, `package-lock.json`, `vite.config.ts`, …). Фронт собирается и запускается из `frontend/`: `cd /opt/pultikma/frontend && NITRO_PRESET=node-server npm run build`, запуск `node /opt/pultikma/frontend/.output/server/index.mjs`.
- Корневой `.env` больше НЕ отслеживается git и содержит только переменные compose (`POSTGRES_*`, `LLM_*`). VITE-переменные теперь живут в `frontend/.env` (тоже не в git; шаблон `frontend/.env.example`).
- В `docker-compose.yml` появился сервис `frontend` — **на сервере он не нужен** (фронт работает как systemd-сервис `pultikma-web` на 3000): всегда запускай compose с перечислением сервисов `db backend`.

## Шаги
1. **Страховка.** `cd /opt/pultikma && git status --short && git rev-parse HEAD`. Сохрани значения старых конфигов: `cp .env /root/pultikma.env.bak && chmod 600 /root/pultikma.env.bak`; `cp deploy.sh /root/deploy.sh.bak`; `cp /etc/systemd/system/pultikma-web.service /root/pultikma-web.service.bak`; `cp docker-compose.override.yml /root/ 2>/dev/null`. Запомни текущий коммит (для отката).
2. **git pull с учётом `.env`.** Раньше корневой `.env` был в git, теперь его там нет — `git pull` либо удалит его, либо откажется из-за локальных правок. Бэкап уже сделан в шаге 1, поэтому: `git checkout -- .env 2>/dev/null || true; git fetch origin && git checkout main && git pull --ff-only`. После pull корневой `.env` может исчезнуть — это нормально (см. шаг 3).
3. **Корневой `.env` для compose.** Восстанови из бэкапа ТОЛЬКО переменные compose: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` → `/opt/pultikma/.env` (права `600`). Пароль Postgres должен остаться прежним, иначе БД не примет подключение.
4. **`frontend/.env`.** Создай `/opt/pultikma/frontend/.env` (права `600`) из `frontend/.env.example`, перенеся из старого `.env` (бэкап) значения `VITE_TILE_URL`, `VITE_TILE_ATTRIBUTION`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY`, `VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID` (если были) и `VITE_API_URL=https://pultikma.mzmpro.uz`. Если `VITE_TILE_URL` потерян, шаблон: `https://api.maptiler.com/maps/dataviz-dark/256/{z}/{x}/{y}.png?key=<MAPTILER_KEY>` (ключ спроси у меня); без него карта идёт на CARTO.
5. **Бэкенд/БД без изменений.** `cd /opt/pultikma && docker compose up -d --build db backend` (НЕ запускай `frontend` из compose — порт 3000 занят systemd). Проверь `curl -s 127.0.0.1:8000/api/health`.
6. **Пересборка фронта в `frontend/`.** `cd /opt/pultikma/frontend && npm ci && VITE_API_URL=https://pultikma.mzmpro.uz NITRO_PRESET=node-server npm run build`. Убедись, что `grep preset .output/nitro.json` → `node-server` и есть `.output/server/index.mjs`.
7. **systemd.** В `/etc/systemd/system/pultikma-web.service` поставь `WorkingDirectory=/opt/pultikma/frontend` и `ExecStart=/usr/bin/node /opt/pultikma/frontend/.output/server/index.mjs` (путь к `node` оставь как был в юните; `Environment=PORT=3000`, `HOST=127.0.0.1` и пользователя не меняй). Права пользователя сервиса на `frontend/` должны сохраниться (`chown -R` как раньше, если нужно). `systemctl daemon-reload && systemctl restart pultikma-web && systemctl status pultikma-web --no-pager`.
8. **deploy.sh.** Обнови `/opt/pultikma/deploy.sh`: `git pull --ff-only` → `docker compose up -d --build db backend` → загрузка данных (`load_data.py`, как было) → `cd frontend && npm ci && VITE_API_URL=https://pultikma.mzmpro.uz NITRO_PRESET=node-server npm run build` → `systemctl restart pultikma-web`. Путь `load_data.py` по-прежнему `backend/scripts/load_data.py`.
9. **Уборка** (только после успешной проверки): старые `/opt/pultikma/node_modules` и `/opt/pultikma/.output` в корне больше не используются — удали их (`rm -rf`), они не в git и их размер большой. nginx менять не нужно (те же порты 3000/8000).
10. **Проверка.**
    - `curl -s -o /dev/null -w '%{http_code}\n' https://pultikma.mzmpro.uz/` → 200;
    - `https://pultikma.mzmpro.uz/app?scenario=chilanzar` → 200, в интерфейсе Score 39;
    - `curl -s https://pultikma.mzmpro.uz/api/health` → `"status":"ok"` (`"repository":"postgis"` если использовался PostGIS);
    - тайлы карты грузятся с `api.maptiler.com` (в браузере/по HTML нет ошибок), чат отвечает;
    - `systemctl is-active pultikma-web` → `active`, `git status --short` без неожиданных изменений.

## Откат
Если что-то не работает и быстро не чинится:
```
cd /opt/pultikma
git checkout pre-monorepo          # старая плоская структура (или `git checkout ae535ba` / сохранённый в шаге 1 коммит, если тега нет)
cp /root/pultikma.env.bak .env && chmod 600 .env
cp /root/pultikma-web.service.bak /etc/systemd/system/pultikma-web.service
cp /root/deploy.sh.bak deploy.sh
npm ci && VITE_API_URL=https://pultikma.mzmpro.uz NITRO_PRESET=node-server npm run build
docker compose up -d --build db backend
systemctl daemon-reload && systemctl restart pultikma-web
```
(после отката вернись на ветку: `git checkout main`, когда будешь повторять миграцию). Данные PostGIS и том чатов не затрагиваются миграцией.
