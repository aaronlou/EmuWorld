# Architecture Analysis Report

> Generated: 2026-04-09
> Status: Code Review Findings

This document provides a detailed analysis of EmuWorld's current architecture, identifies problems, explains root causes, and suggests improvements.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Critical Issues](#critical-issues)
4. [Medium Priority Issues](#medium-priority-issues)
5. [Minor Issues & Code Smells](#minor-issues--code-smells)
6. [Recommendations Summary](#recommendations-summary)

---

## Executive Summary

EmuWorld is a macro quantitative analysis and probability forecasting platform with a three-tier architecture:

```
Frontend (React) → Backend (Rust) → AI Service (Python)
                           ↓
                      PostgreSQL
```

| Aspect | Rating | Notes |
|--------|--------|-------|
| Service Separation | ✅ Good | Clean three-tier split |
| Code Organization | ⚠️ Warning | AI Service structure problematic |
| Interface Design | ⚠️ Warning | HTTP + gRPC redundancy |
| Maintainability | ⚠️ Warning | main.py is 1200+ lines |
| Testability | ❌ Poor | Difficult to unit test components |
| Configuration | ⚠️ Warning | Hardcoded defaults scattered |
| Prediction Quality | ❌ Placeholder | Monte Carlo is random generation |

**Core finding**: The AI Service (`ai-service/main.py`) violates Single Responsibility Principle and needs restructuring.

---

## System Overview

### Service Topology

```
┌─────────────────────────────────────────────────────────────────┐
│                         Docker Network                           │
│                                                                  │
│  ┌─────────────┐     ┌──────────────┐     ┌─────────────────┐   │
│  │  Frontend   │────▶│   Backend    │────▶│   AI Service    │   │
│  │  :5173      │     │   :8080      │     │  :9000 (HTTP)   │   │
│  │  React/Vite │     │   Rust/Axum  │     │  :9001 (gRPC)   │   │
│  └─────────────┘     └──────┬───────┘     └─────────────────┘   │
│                             │                                   │
│                      ┌──────▼───────┐                          │
│                      │  PostgreSQL  │                          │
│                      │   :5432      │                          │
│                      └──────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Domain Model

```
data_sources ──┬──▶ datasets ──▶ data_points
               │
               └──▶ news_articles

prediction_targets ──▶ prediction_runs ──▶ predictions

chat_sessions ──▶ chat_messages
```

---

## Critical Issues

### Issue 1: AI Service main.py is a God Object

**Location**: `ai-service/main.py` (1220 lines)

**Problem**:
The entry point file has accumulated responsibilities that should belong to separate modules:

| Lines | Responsibility | Should Be |
|-------|----------------|-----------|
| 1-75 | Imports + env setup | config module |
| 78-182 | Request/Response models | models/ package |
| 185-305 | Rule-based chat logic | rules/ module |
| 308-434 | Prompt building | llm/ module |
| 466-517 | Memory writing | agents/memory/ |
| 519-563 | LLM client wrapper | llm/client.py |
| 577-641 | gRPC service impl | grpc/service.py |
| 654-869 | REST endpoints | api/ routes |
| 893-1210 | More endpoints | api/ routes |

**Root Cause**:
- Rapid prototyping without refactoring
- No enforced module boundaries
- Missing architecture tests or file size limits

**Impact**:
- Difficult to find where functionality lives
- Unit testing requires importing the entire file
- Any change has potential to break unrelated features
- New developers struggle to understand the codebase

**Recommended Fix**:

```
ai-service/
├── main.py              # 50 lines max - just app factory
├── config.py            # Centralized configuration
├── api/
│   ├── __init__.py
│   ├── chat.py          # /chat endpoints
│   ├── predict.py       # /predict endpoints
│   ├── agent.py         # /agent/* endpoints
│   └── discovery.py     # /discover endpoints
├── grpc/
│   ├── __init__.py
│   └── servicer.py      # gRPC AIcServiceServicer
├── llm/
│   ├── __init__.py
│   ├── client.py        # OpenAI client wrapper
│   ├── prompts.py       # Prompt building functions
│   └── fallback.py      # Rule-based fallback
├── models/
│   ├── __init__.py
│   ├── requests.py      # Pydantic request models
│   └── responses.py     # Pydantic response models
└── agents/              # (existing)
```

**Example refactored main.py**:

```python
# ai-service/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager

from config import settings
from api import chat, predict, agent, discovery
from grpc.server import start_grpc_server

@asynccontextmanager
async def lifespan(app: FastAPI):
    start_grpc_server()
    yield

app = FastAPI(title="EmuWorld AI Service", lifespan=lifespan)
app.include_router(chat.router)
app.include_router(predict.router)
app.include_router(agent.router)
app.include_router(discovery.router)

@app.get("/health")
async def health():
    return {"status": "ok"}
```

---

### Issue 2: HTTP and gRPC Dual Protocol Redundancy

**Location**: `ai-service/main.py`, `backend/src/integrations/ai_client.rs`

**Problem**:
AI Service exposes both HTTP (9000) and gRPC (9001) protocols with overlapping functionality:

| Port | Protocol | Used By |
|------|----------|---------|
| 9000 | HTTP REST | Direct frontend calls? (unclear) |
| 9001 | gRPC | Rust backend |

Many HTTP endpoints in `main.py` are duplicates of gRPC methods:
- `/predict` (HTTP) ≈ `Predict` (gRPC)
- `/chat` (HTTP) ≈ `Chat` (gRPC)
- `/agent/fetch` (HTTP) ≈ `FetchData` (gRPC)

**Root Cause**:
- Initially built HTTP for quick testing
- Added gRPC later for performance
- Never removed HTTP endpoints

**Impact**:
- Double maintenance effort
- Risk of behavior divergence between protocols
- Confusion about which endpoints are actually used
- Docker image includes unused code paths

**Recommended Fix**:

**Option A**: HTTP-only (simpler)
- Remove gRPC entirely
- Use HTTP for all communication
- Accept minor latency overhead

**Option B**: gRPC-only (cleaner)
- Keep gRPC for backend ↔ AI service
- Expose only essential HTTP endpoints for frontend (if needed)
- Remove duplicate endpoints

**Option C**: Clear separation (if both needed)
- HTTP: Frontend-facing endpoints only
- gRPC: Backend internal APIs only
- No functionality overlap

---

### Issue 3: Prediction Model is a Placeholder

**Location**: `ai-service/main.py:168-182`

**Problem**:
```python
def monte_carlo_prediction(outcomes: List[str]):
    weights = [random.expovariate(1.0) for _ in range(n_outcomes)]
    total = sum(weights)
    probabilities = [w / total for w in weights]
```

This is **random number generation**, not Monte Carlo simulation.

Additionally:
```python
# gRPC Predict response
return pb2.PredictResponse(
    probabilities=probabilities,
    explanation="Prediction based on historical search patterns...",  # Hardcoded
    confidence_score=0.85,  # Hardcoded constant
)
```

**Root Cause**:
- Feature not fully implemented
- "Minimum viable" version never replaced
- No real statistical model backing predictions

**Impact**:
- Users get meaningless probability distributions
- Trust is lost when users realize predictions are random
- Difficult to replace later without affecting other code

**Recommended Fix**:

1. **Short term**: Label clearly
   ```python
   return pb2.PredictResponse(
       probabilities=probabilities,
       explanation="Note: This is a placeholder. Implement real model.",
       confidence_score=0.0,  # Signal uncertainty
   )
   ```

2. **Medium term**: Implement real Monte Carlo
   - Use historical data
   - Define actual sampling distributions
   - Compute confidence intervals properly

3. **Long term**: Integrate proper forecasting
   - Time series models (ARIMA, Prophet)
   - LLM-based scenario analysis
   - Ensemble methods

---

### Issue 4: Thread Safety and Resource Management

**Location**: `ai-service/main.py:672-685`

**Problem**:
```python
threading.Thread(
    target=_write_episodic_memory,
    args=(req.message, llm_response.answer),
    daemon=True,
).start()
```

Multiple issues:
1. No tracking of spawned threads
2. No exception handling in threads
3. No queue/backpressure limits
4. No way to know if write succeeded

**Root Cause**:
- Convenience over correctness
- Async/event loop mixing with threads

**Impact**:
- Under load: could spawn thousands of threads
- Memory leaks if threads hang
- Silent failures (exceptions swallowed)
- Race conditions with database writes

**Recommended Fix**:

**Option A**: Use FastAPI BackgroundTasks

```python
from fastapi import BackgroundTasks

@app.post("/chat")
async def chat(req: ChatRequest, background_tasks: BackgroundTasks):
    # ... generate response ...
    background_tasks.add_task(_write_episodic_memory, req.message, answer)
    return response
```

**Option B**: Use asyncio properly

```python
@app.post("/chat")
async def chat(req: ChatRequest):
    answer = await generate_response(req)
    asyncio.create_task(write_memory_async(req.message, answer))
    return answer
```

**Option C**: Task queue (for production scale)

```python
# Using Celery or RQ
from tasks import write_memory_task

@app.post("/chat")
async def chat(req: ChatRequest):
    answer = await generate_response(req)
    write_memory_task.delay(req.message, answer)
    return answer
```

---

## Medium Priority Issues

### Issue 5: Hardcoded Configuration

**Location**: Multiple files

**Problem**:

```python
# ai-service/main.py:64
_openai_model = os.getenv("OPENAI_MODEL", "qwen/qwen3.6-plus:free")
_openai_base_url = os.getenv("OPENAI_BASE_URL", "https://openrouter.ai/api/v1")

# backend/src/main.rs:17-18
let db_url = std::env::var("DATABASE_URL")
    .unwrap_or_else(|_| "postgres://emuworld:emuworld_pass@localhost:5432/emuworld".to_string());
```

**Root Cause**:
- Development convenience
- No configuration strategy defined

**Impact**:
- Defaults may not be appropriate for all environments
- Configuration hunting required when debugging
- Potential for secrets in code (database password in example)

**Recommended Fix**:

Create `ai-service/config.py`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    openai_api_key: str  # Required - will fail if not set
    openai_base_url: str = "https://openrouter.ai/api/v1"
    openai_model: str = "qwen/qwen3.6-plus:free"
    grpc_port: int = 9001
    http_port: int = 9000
    
    class Config:
        env_file = ".env"

settings = Settings()
```

Create `backend/src/config.rs`:

```rust
pub struct Config {
    pub database_url: String,
    pub ai_service_url: String,
    pub http_port: u16,
}

impl Config {
    pub fn from_env() -> Result<Self, envy::Error> {
        envy::prefixed("EMUWORLD_")
            .from_env::<Config>()
    }
}
```

---

### Issue 6: Duplicate Model Definitions

**Location**:

- `backend/src/models.rs:101-156` - `ChatContext`, `ChatRequest`, `ChatResponse`
- `ai-service/main.py:84-135` - Same models in Python

**Problem**:
The Rust and Python services both define `ChatContext`, `ChatDatasetContext`, etc. Fields must be manually kept in sync.

**Root Cause**:
- No shared schema definition
- Protocol Buffers used only for gRPC, not for all shared types

**Impact**:
- Risk of field name mismatches
- Double maintenance
- Serialization bugs when fields diverge

**Recommended Fix**:

**Option A**: Generate from proto

```protobuf
// proto/shared.proto
message ChatContext {
    string page = 1;
    int32 datasets_count = 2;
    // ...
}
```

Generate Python and Rust code from proto files.

**Option B**: JSON Schema

Define schema once, generate both.

---

### Issue 7: Frontend Feature Structure Lacks Shared Utilities

**Location**: `frontend/src/features/*/api.ts`

**Problem**:
Each feature has its own `api.ts` but no shared:
- Error handling
- Retry logic
- Request caching
- Loading state management

Current shared API client:

```typescript
// frontend/src/shared/api/client.ts
export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${url}`, {...});
  if (!response.ok) {
    throw new Error(error.error || response.statusText);
  }
  return response.json();
}
```

**Root Cause**:
- Feature-based structure implemented without shared layer
- Each team/developer writes their own error handling

**Impact**:
- Inconsistent error handling across features
- Missing retry logic for transient failures
- No centralized logging of API calls

**Recommended Fix**:

```typescript
// frontend/src/shared/api/client.ts
interface RequestOptions extends RequestInit {
  retry?: number;
  timeout?: number;
}

export async function request<T>(
  url: string,
  options?: RequestOptions
): Promise<T> {
  const { retry = 3, timeout = 30000, ...fetchOptions } = options || {};
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(`${API_URL}${url}`, {
      ...fetchOptions,
      signal: controller.signal,
    });
    
    if (!response.ok) {
      const error = await parseError(response);
      throw new ApiError(error, response.status);
    }
    
    return response.json();
  } catch (error) {
    if (retry > 0 && isRetryable(error)) {
      await delay(1000);
      return request<T>(url, { ...options, retry: retry - 1 });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

---

### Issue 8: No API Versioning

**Location**: All API endpoints

**Problem**:
Endpoints have no version prefix:

```
GET /datasets          # Current
POST /predictions      # Current
```

If breaking changes are needed, all clients break simultaneously.

**Root Cause**:
- Early development phase
- No versioning strategy defined

**Impact**:
- Future breaking changes will require coordinated deployment
- Cannot run multiple API versions in parallel
- Difficult to deprecate old clients

**Recommended Fix**:

Add version prefix:

```
GET /v1/datasets
POST /v1/predictions
```

Or use header-based versioning:

```
GET /datasets
Accept: application/vnd.emuworld.v1+json
```

---

## Minor Issues & Code Smells

### Issue 9: print() Statements in Production Code

**Location**: `ai-service/main.py:65-75`

```python
print(f"[DEBUG] OPENAI_API_KEY loaded: {len(_openai_api_key) > 0}")
print(f"[DEBUG] OPENAI_BASE_URL: {_openai_base_url}")
print(f"[DEBUG] OPENAI_MODEL: {_openai_model}")
```

**Fix**: Use proper logging:

```python
import logging
logger = logging.getLogger(__name__)
logger.info("OpenAI configured: base_url=%s, model=%s", _openai_base_url, _openai_model)
```

---

### Issue 10: Empty Exception Handlers

**Location**: `ai-service/main.py:316-318`

```python
def build_kg_context_block(query: str) -> str:
    try:
        # ...
    except Exception:
        logger.exception("build_kg_context: failed")
    return ""  # Silent failure
```

**Impact**: Failures go unnoticed, debugging difficult.

**Fix**: At minimum, track failures:

```python
except Exception as e:
    logger.warning("KG context building failed, continuing without: %s", e)
    metrics.increment("kg_context_failure")
```

---

### Issue 11: Magic Numbers

**Location**: `ai-service/main.py:598-735`

```python
chunk_size = 36  # Why 36?
for start in range(0, len(answer), chunk_size):
```

**Fix**: Define constants with documentation:

```python
# Chat stream chunk size - small enough for responsive streaming,
# large enough to avoid excessive network overhead
CHAT_STREAM_CHUNK_SIZE = 36
```

---

### Issue 12: Inconsistent Naming

**Location**: Various

| Python | Rust | Issue |
|--------|------|-------|
| `ChatPredictionContext` | `ChatPredictionContext` | Same name, different package context |
| `prediction_targets` | `PredictionTarget` | Table name vs struct name inconsistency |
| `datasets_count` | `datasets_count` | Good: consistent |

**Fix**: Establish naming conventions document.

---

## Recommendations Summary

### Immediate (P0) - Fix Before Next Release

1. **Restructure AI Service** - Split `main.py` into modules
2. **Remove print() statements** - Use logging
3. **Label placeholder predictions** - Clearly indicate they're random

### Short Term (P1) - Fix Within Sprint

1. **Choose one protocol** - HTTP or gRPC, not both
2. **Centralize configuration** - Single config module per service
3. **Fix thread management** - Use BackgroundTasks or asyncio

### Medium Term (P2) - Fix Within Quarter

1. **Implement real prediction model** - Replace random generation
2. **Add API versioning** - v1 prefix
3. **Shared model definitions** - Generate from proto or schema
4. **Frontend shared API utilities** - Error handling, retry

### Long Term (P3) - Technical Debt Backlog

1. **Add architecture tests** - Enforce file size limits, module boundaries
2. **Create style guide** - Naming conventions, error handling patterns
3. **API documentation** - OpenAPI spec generated from code

---

## Appendix: File Size Analysis

| File | Lines | Responsibility |
|------|-------|----------------|
| `ai-service/main.py` | 1220 | God Object - needs split |
| `backend/src/models.rs` | 302 | Acceptable for models |
| `ai-service/agents/orchestrator/lead_agent.py` | 85 | Good - focused |
| `backend/src/main.rs` | 51 | Good - thin entry point |

**Recommended limit**: 300 lines per file, with exceptions for:
- Generated code
- Model/DTO definitions
- Test files

---

## Appendix: Suggested Metrics

Track these to measure architecture health:

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| `main.py` lines | 1220 | <100 | `wc -l main.py` |
| Circular dependencies | Unknown | 0 | `pydeps` or `import-linter` |
| Test coverage | Unknown | 80% | `pytest --cov` |
| API response time p99 | Unknown | <500ms | APM tooling |
| Error rate | Unknown | <1% | Structured logging |
