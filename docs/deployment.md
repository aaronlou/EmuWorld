# Deployment

## Two Modes

### 1. Docker Compose (Recommended for staging/prod)

```bash
docker compose up --build
```

Services started: `postgres` → `ai-service` → `backend`
Frontend is NOT in compose — build separately or use nginx.

**Ports:**
- PostgreSQL: 5432
- Backend: 8080
- AI Service: 9000, 9001

**Environment:**
```
DATABASE_URL=postgresql://emuworld:emuworld_pass@postgres:5432/emuworld
AI_SERVICE_URL=http://ai-service:9000
```

### 2. Local Dev (start.sh)

```bash
./start.sh   # starts all services as background processes
./stop.sh    # kills all services
```

**Ports:**
- Frontend: 5173 (Vite dev server)
- Backend: 8080
- AI Service: 9000
- PostgreSQL: 5432 (via Docker)

**Logs:** `logs/` directory

## Dockerfile Summary

| Service | Base | Multi-stage |
|---------|------|-------------|
| Frontend | node:22-alpine → nginx:alpine | Yes |
| Backend | rust:1.94-slim → debian:bookworm-slim | Yes |
| AI Service | python:3.14-slim | No |

## Missing (TODO)

- [ ] CI/CD pipeline (GitHub Actions)
- [ ] Frontend service in docker-compose
- [ ] Health check for AI Service gRPC port
- [ ] Production env var management (.env files)
- [ ] Database migration strategy
