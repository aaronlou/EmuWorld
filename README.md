# EmuWorld

A monorepo project with Rust + Python + React stack.

## Architecture

```
EmuWorld/
├── frontend/       # React + TypeScript (Vite)
├── backend/        # Rust (Actix-web / Axum)
├── ai-service/     # Python FastAPI
└── docker-compose.yml
```

## Quick Start

```bash
# Frontend
cd frontend && npm install && npm run dev

# Backend
cd backend && cargo run

# AI Service
cd ai-service && source .venv/bin/activate && uvicorn main:app --reload
```

## Docker

```bash
docker compose up --build
```
