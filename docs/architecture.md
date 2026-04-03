# Architecture

## Overview

Monorepo with three services + PostgreSQL.

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Frontend   │────▶│   Backend    │────▶│ AI Service  │
│ React+Vite  │     │    Rust      │     │  Python     │
│  :5173      │     │   :8080      │     │  :9000      │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐
                    │  PostgreSQL  │
                    │   :5432      │
                    └──────────────┘
```

## Services

### Frontend
- **Stack:** React + TypeScript + Vite
- **Port:** 5173 (dev), 80 (prod via nginx)
- **Build:** `npm run build` → static files served by nginx
- **Proxy:** `/api/` → `backend:8080`

### Backend
- **Stack:** Rust (Actix-web / Axum)
- **Port:** 8080
- **Binary:** `emu-world-backend`
- **Env:** `DATABASE_URL`, `AI_SERVICE_URL`

### AI Service
- **Stack:** Python FastAPI + gRPC
- **Ports:** 9000 (HTTP), 9001 (gRPC)
- **Proto:** `proto/ai_service.proto`

### Database
- **Engine:** PostgreSQL 16
- **DB:** `emuworld`
- **User:** `emuworld`

## Communication

| From | To | Protocol |
|------|----|----------|
| Frontend | Backend | HTTP REST via nginx proxy |
| Backend | AI Service | HTTP + gRPC |
| Backend | PostgreSQL | TCP (SQLx / Diesel) |
