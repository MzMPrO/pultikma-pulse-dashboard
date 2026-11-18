# Pultikma Pulse Dashboard

Implement exactly the screenshot and nothing else

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://pultikma-pulse-dashboard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/50d36077-fe20-403c-b90b-3d83cc5cb5c5).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Full stack: frontend + backend

The backend (`backend/`, FastAPI + PostgreSQL/PostGIS) serves `/api/analyze`, `/api/chat`, `/api/rate/usd`, `/api/health`.
The frontend falls back to a local mock if the backend is unreachable.

### With Docker (3 commands)

```sh
docker compose up -d                    # PostGIS 16 + backend on :8000
python backend/scripts/load_data.py     # create schema + load backend/data/*.csv (needs: pip install "psycopg[binary]")
VITE_API_URL=http://localhost:8000 npm run dev
```

PowerShell: `$env:VITE_API_URL="http://localhost:8000"; npm run dev`. Copy `.env.example` to `.env` to set the
LLM variables (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` - any OpenAI-compatible provider; without them the chat uses a
scripted fallback). `GET /api/health` shows which repository is active (`postgis` or `memory`).

### Without Docker (in-memory CSV repository, identical results)

```sh
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt        # Linux/macOS: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000
.venv/Scripts/python -m pytest                       # optional: tests
# in another terminal, from the repo root:
VITE_API_URL=http://localhost:8000 npm run dev
```

Data: `backend/data/*.csv` is a SYNTHETIC seed (`backend/scripts/make_seed.py`); replace the files with the real ones
and re-run `load_data.py` (see `docs/DECISIONS.md`, "Backend").
