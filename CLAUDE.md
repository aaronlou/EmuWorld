# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

EmuWorld is a macro quantitative analysis and probability forecasting platform — a three-service monorepo for financial analysts tracking global economic indicators and running AI-powered forecasts.

## Services & Ports

| Service | Tech | Port |
|---------|------|------|
| Frontend | React + TypeScript + Vite | 5173 |
| Backend | Rust + Axum | 8080 |
| AI Service | Python + FastAPI + gRPC | 9000 (HTTP), 9001 (gRPC) |
| PostgreSQL | v16 | 5432 |

## Development Commands

### Start Everything
```bash
./start.sh   # Starts postgres (Docker), AI service, backend, frontend
./stop.sh    # Stops all services
```

### Frontend (`cd frontend`)
```bash
npm install
npm run dev      # Vite dev server → http://localhost:5173
npm run build    # tsc -b && vite build → dist/
npm run lint     # ESLint over all .ts/.tsx
npm run preview  # Serve built dist/ locally
```

### Backend (`cd backend`)
```bash
export DATABASE_URL="postgresql://emuworld:emuworld_pass@localhost:5432/emuworld"
export AI_SERVICE_URL="http://localhost:9000"

cargo build           # Debug build
cargo build --release
cargo run             # Dev server
```

### AI Service (`cd ai-service`)
```bash
source .venv/bin/activate
pip install -r requirements.txt
python main.py   # Starts both HTTP (:9000) and gRPC (:9001) in same process
# Or with reload:
uvicorn main:app --host 0.0.0.0 --port 9000 --reload
```

### Docker (full stack)
```bash
docker compose up --build
docker compose up -d postgres   # Just the DB
```

## Environment Variables

| Variable | Service | Default |
|----------|---------|---------|
| `DATABASE_URL` | Backend | `postgresql://emuworld:emuworld_pass@localhost:5432/emuworld` |
| `AI_SERVICE_URL` | Backend | `http://localhost:9000` |
| `OPENAI_API_KEY` | AI Service | *(unset — falls back to rules engine)* |
| `OPENAI_MODEL` | AI Service | `gpt-4.1-mini` |
| `VITE_API_URL` | Frontend | `http://localhost:8080` |

## Testing

There are currently no automated test suites (no Jest, pytest, or `cargo test` suites). Playwright is installed at the root for future E2E tests:
```bash
npx playwright test                            # all tests
npx playwright test path/to/specific.spec.ts   # single file
```

## Architecture

### Service Communication
```
Browser (React SPA)
    │  HTTP REST
    ▼
Rust Backend (Axum, :8080)
    │  HTTP/SSE (reqwest)
    ├──────────────────────▶ Python AI Service (FastAPI, :9000)
    │                            │  gRPC (:9001)
    │                            └  OpenAI API (optional)
    │  SQLx async
    ▼
PostgreSQL 16 (:5432)
```

### Backend (Rust) — Layered Architecture
- **`api/`** → route handlers; **`application/`** → business logic services; **`repo/`** → async trait interfaces; **`repo/postgres/`** → concrete SQLx implementations
- **Dependency injection**: All Axum handlers receive `State(state): State<Arc<AppState>>`. `AppState` holds the repo + three services (`ChatService`, `PredictionService`, `SourceSyncService`).
- **Repository pattern**: `AppRepo` combines `DatasetRepo + TargetRepo + PredictionRepo + DataSourceRepo + ChatRepo` as `async_trait` interfaces. Only one concrete impl: `PostgresRepo`.
- **Migrations**: DDL run inline via `CREATE TABLE IF NOT EXISTS` at startup — no migration framework.
- **Error handling**: `ApiError` + `ApiResult<T>` wrappers convert `RepoError` → HTTP responses.
- **Background scheduler**: `tokio::spawn` loop syncs `google_trends` and `yfinance` sources at startup and every 24 hours.
- **SSE streaming**: `/chat/stream` proxies the AI service's SSE byte stream directly to the browser via `Body::from_stream`.

### Frontend (React/TS) — Feature-Co-located Modules
- Each feature (`datasets`, `targets`, `predictions`, `chat`) owns its own `api.ts` (raw fetch calls), `hooks.ts` (React state), and view components under `src/features/`.
- **No global state library** (no Redux/Zustand). State is local to each feature's hooks.
- **Shared HTTP client**: `shared/api/client.ts` exports a single `request<T>()` function — no axios, no React Query.
- **Lazy loading**: Feature views are `React.lazy()` loaded, wrapped in `<Suspense>`.
- **ChatContext**: `App.tsx` assembles context from all currently-visible data (datasets, selected target, active prediction) and passes it to `ChatWidget`, enabling context-aware AI responses.
- **Styling**: Dark-mode only, CSS custom properties in `index.css` (~1600 lines). No Tailwind, no CSS-in-JS. Design tokens defined in `DESIGN.md` (aurora color palette, Outfit/Space Grotesk/JetBrains Mono fonts).
- **Animations**: Framer Motion with `AnimatePresence` + `motion.div` on tab switches.

### AI Service (Python) — Pipeline Agent
- **Pipeline stages**: `LeadAgent.analyze()` runs `PipelineState` through 7 ordered stages: `DATA_QUERY → TREND_ANALYSIS → CORRELATION → FORECAST → ANOMALY_DETECT → REPORT_GEN → QUALITY_GATE` via `run_pipeline()`. Stages can fail/retry/rollback.
- **Middleware chain**: `CacheMiddleware`, `AuditMiddleware`, `LoopDetectionMiddleware` wrap each run.
- **Hybrid data fetcher** (`tools/hybrid_fetcher.py`): in-memory cache → DB → live API, with per-layer enable/disable flags.
- **Dual protocol**: FastAPI (HTTP + SSE) on :9000 and gRPC (`PredictionService`) on :9001 run in the same process — gRPC in a daemon thread.
- **Predictions**: `/predict` uses `random.expovariate`; `/predict/monte-carlo` runs 10,000-simulation Gaussian sampling.
- **LLM fallback**: If `OPENAI_API_KEY` is unset or errors, the chat endpoint falls back to a deterministic rule-based response builder.

### Data Ingest Sources
External data adapters live in `backend/src/ingest/`. Each implements the `DataSource` trait; `build_adapter()` is the factory. Sources: FRED, World Bank, IMF, NBS, OECD, Eurostat, Google Trends (`pytrends`), Yahoo Finance (`yfinance`), Census. API keys (where required) are stored in the DB `data_sources.api_key` column. Run `bootstrap_sources.sh` to seed the `data_sources` table.
