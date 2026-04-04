# Architecture Refactor Plan

## Goal

Tighten service boundaries without breaking the current product flow.

This refactor is intentionally incremental:

1. Keep the current runtime topology.
2. Move responsibilities to the right layer.
3. Stabilize domain boundaries before introducing new infrastructure.

## Current Status

The repo now implements the core parts of this plan:

- backend application services exist for prediction execution and source sync
- backend API routes use a shared API error type
- forecasting has explicit `prediction_runs`
- Postgres persistence is split by concern under `backend/src/repo/postgres/`
- frontend data access is feature-local
- frontend target and prediction flows are featureized
- prediction runs are visible in the UI and retryable

## Current Problems

### Backend

- HTTP handlers contain use-case orchestration.
- Repository abstractions contain both persistence and business workflow.
- Postgres implementation also calls the AI service.
- API module naming does not match domain ownership.

### Frontend

- `App.tsx` owns most page-level business state and action orchestration.
- Existing hooks are not the actual state boundary.
- Feature concerns are mixed into page composition.

### AI Service

- There is a pipeline/middleware abstraction layer, but the externally used contract is still narrow.
- Platform abstraction is growing faster than stable product capabilities.

## Target Architecture

```text
EmuWorld/
  frontend/
    src/
      app/
      features/
        datasets/
        sources/
        targets/
        predictions/
      shared/
  backend/
    src/
      api/
      application/
      domain/
      repo/
      integrations/
      bootstrap/
  ai-service/
    app/
      api/
      services/
      pipelines/
      tools/
      models/
```

## Domain Boundaries

### 1. Data Catalog / Ingestion

Owns:

- `data_sources`
- `datasets`
- `data_points`
- external source adapters
- source sync workflows

### 2. Forecasting

Owns:

- `prediction_targets`
- prediction execution
- prediction history
- prediction result persistence

### 3. Analysis Engine

Owns:

- trend analysis
- anomaly detection
- report generation
- optional multi-stage analysis pipeline

## Backend Target Layout

```text
backend/src/
  api/
    datasets.rs
    sources.rs
    targets.rs
    predictions.rs
    errors.rs
  application/
    mod.rs
    dataset_service.rs
    source_sync_service.rs
    target_service.rs
    prediction_service.rs
  domain/
    mod.rs
    datasets.rs
    sources.rs
    forecasting.rs
  repo/
    mod.rs
    postgres/
      mod.rs
      datasets.rs
      sources.rs
      targets.rs
      predictions.rs
      migrations.rs
  integrations/
    mod.rs
    ai_client.rs
    ingest/
      mod.rs
      fred.rs
      world_bank.rs
      imf.rs
      nbs.rs
      oecd.rs
      eurostat.rs
  bootstrap/
    mod.rs
    app_state.rs
```

## Frontend Target Layout

```text
frontend/src/
  app/
    App.tsx
    layout.tsx
  features/
    datasets/
      api.ts
      hooks.ts
      types.ts
      DatasetList.tsx
    sources/
      api.ts
      hooks.ts
      types.ts
      SourceList.tsx
      SyncSourceButton.tsx
    targets/
      api.ts
      hooks.ts
      types.ts
      TargetList.tsx
      CreateTargetForm.tsx
    predictions/
      api.ts
      hooks.ts
      types.ts
      PredictionView.tsx
      PredictionChart.tsx
  shared/
    api/
      client.ts
    ui/
    types/
```

## AI Service Target Layout

```text
ai-service/
  app/
    api/
      predict.py
      analyze.py
    services/
      prediction_service.py
      analysis_service.py
      report_service.py
    pipelines/
      analysis_pipeline.py
    tools/
    models/
  main.py
```

## File Migration Map

### Backend

#### `backend/src/main.rs`

Current responsibility:

- bootstraps DB
- runs migrations
- wires repo
- builds router

Target:

- keep as thin bootstrap entrypoint
- move state construction to `bootstrap/app_state.rs`

Future split:

- `backend/src/main.rs`
- `backend/src/bootstrap/app_state.rs`

#### `backend/src/api/datasets.rs`

Current responsibility:

- dataset HTTP routes
- direct repo access

Target:

- keep routes here
- replace repo calls with `DatasetService`

Future dependencies:

- `application/dataset_service.rs`
- `api/errors.rs`

#### `backend/src/api/sources.rs`

Current responsibility:

- source CRUD
- sync orchestration
- adapter construction
- persistence loop

Target:

- keep HTTP protocol handling only
- move sync workflow to `SourceSyncService`

Future split:

- keep CRUD route layer in `api/sources.rs`
- create `application/source_sync_service.rs`
- move adapter lookup into `integrations/ingest/mod.rs`

#### `backend/src/api/targets.rs`

Current responsibility:

- only exposes `/targets/list`

Target:

- own target-centric routes only
- contain target list/create/get endpoints

Notes:

- current module naming should be corrected
- `/targets/list` should likely disappear in favor of `GET /targets`

#### `backend/src/api/predictions.rs`

Current responsibility:

- target list
- target creation
- generate prediction
- list predictions

Target:

- own prediction execution and prediction result endpoints
- remove target ownership from this module

Future split:

- target create/list moves to `api/targets.rs`
- prediction execution/query remains in `api/predictions.rs`

#### `backend/src/repo/mod.rs`

Current responsibility:

- repo traits
- DTOs
- workflow-oriented repo methods

Target:

- keep persistence-facing traits only
- move business commands/DTOs to `application` or `domain`

Required cleanup:

- remove external service semantics from repo contract
- remove `generate()` from repository abstraction

#### `backend/src/repo/postgres/mod.rs`

Current responsibility:

- all Postgres persistence for all subdomains
- AI service call
- prediction batching logic

Target:

- split by aggregate/persistence concern

Future split:

- `repo/postgres/datasets_repo.rs`
- `repo/postgres/sources_repo.rs`
- `repo/postgres/targets_repo.rs`
- `repo/postgres/prediction_runs_repo.rs`
- `repo/postgres/prediction_results_repo.rs`

Important:

- no HTTP calls should remain here

#### `backend/src/ingest/mod.rs`

Current responsibility:

- source adapter trait
- adapter factory

Target:

- move under `integrations/ingest/`
- keep adapter abstraction here

Reason:

- ingestion adapters are external integrations, not core domain

#### `backend/src/models/mod.rs`

Current responsibility:

- DB-shaped structs
- request DTO
- response DTO

Target:

- split into:
  - domain entities/value objects
  - API request/response DTOs
  - repo row models only where needed

Suggested future split:

- `domain/datasets.rs`
- `domain/sources.rs`
- `domain/forecasting.rs`
- API DTOs colocated under `api/` or `application/commands`

### Frontend

#### `frontend/src/App.tsx`

Current responsibility:

- tab state
- datasets query orchestration
- targets query orchestration
- target creation
- prediction execution
- chart data shaping

Target:

- page composition only
- tab selection only
- delegate business state to feature hooks

Future split:

- keep `App.tsx` as composition shell
- move data orchestration into feature hooks

#### `frontend/src/services/api.ts`

Current responsibility:

- historical global API aggregation layer

Target:

- removed
- replaced by shared request client plus feature-local APIs

Future split:

- `shared/api/client.ts`
- `features/datasets/api.ts`
- `features/targets/api.ts`
- `features/predictions/api.ts`
- `features/sources/api.ts`

#### `frontend/src/hooks/useDatasets.ts`

Current responsibility:

- historical compatibility re-export layer

Target:

- removed
- replaced by feature-local hooks

Future split:

- `features/datasets/hooks.ts`
- `features/targets/hooks.ts`

#### `frontend/src/components/TargetList.tsx`

Current responsibility:

- historical compatibility component path

Target:

- moved under `features/targets/`
- split into `TargetList.tsx`, `CreateTargetForm.tsx`, `TargetTable.tsx`

Future split:

- `features/targets/TargetList.tsx`
- `features/targets/CreateTargetForm.tsx`

#### `frontend/src/components/PredictionView.tsx`

Current responsibility:

- historical compatibility component path

Target:

- moved under `features/predictions/`
- now also displays run history and retry actions

Future split:

- `features/predictions/PredictionView.tsx`
- `features/predictions/PredictionChart.tsx`

#### `frontend/src/components/DatasetList.tsx`

Current responsibility:

- historical compatibility component path

Target:

- moved into `features/datasets/`

### AI Service

#### `ai-service/main.py`

Current responsibility:

- FastAPI app
- gRPC server logic
- prediction endpoints
- analysis endpoints
- permissions
- costs
- history
- data discovery

Target:

- keep as thin entrypoint and route assembly
- move business logic to `app/services/`

Future split:

- `app/api/predict.py`
- `app/api/analyze.py`
- `app/services/prediction_service.py`
- `app/services/analysis_service.py`
- `app/services/report_service.py`

#### `ai-service/agents/orchestrator/*`

Current responsibility:

- pipeline stages
- handler mapping
- middleware-oriented agent orchestration

Target:

- keep only if analysis pipeline remains a product-level primitive
- otherwise narrow it behind `analysis_service.py`

Important:

- backend should depend on stable service APIs, not internal pipeline concepts

## Data Model Migration

### Current Forecasting Schema

```text
prediction_targets
predictions
```

### Recommended Forecasting Schema

```text
prediction_targets
prediction_runs
prediction_results
```

### Why

Current schema cannot clearly represent:

- multiple runs for one target
- failed runs
- retries
- model/version history
- input snapshots
- async execution lifecycle

### Proposed Tables

#### `prediction_runs`

Suggested fields:

- `id`
- `target_id`
- `status`
- `requested_at`
- `started_at`
- `finished_at`
- `model_name`
- `model_version`
- `input_snapshot`
- `error_message`

#### `prediction_results`

Suggested fields:

- `id`
- `run_id`
- `outcome`
- `probability`
- `confidence_lower`
- `confidence_upper`
- `created_at`

## Phased Migration Plan

### Phase 1: Re-layer Without Behavior Change

Objective:

- move orchestration out of handlers and repos

Tasks:

1. Create `backend/src/application/`.
2. Add `SourceSyncService`.
3. Add `PredictionService`.
4. Replace direct sync logic in `api/sources.rs`.
5. Replace repo-driven prediction generation flow.
6. Keep API shapes unchanged.

Expected payoff:

- immediate reduction in coupling
- easier testing of use cases

### Phase 2: Stabilize Forecasting Domain

Objective:

- introduce run-based prediction model

Tasks:

1. Add migration for `prediction_runs`.
2. Add migration for `prediction_results`.
3. Update backend services to create runs.
4. Keep legacy response shape temporarily if needed.
5. Add new endpoints for run retrieval.

Expected payoff:

- clear lifecycle model
- async-safe evolution path

### Phase 3: Frontend Feature Extraction

Objective:

- stop using `App.tsx` as an implicit controller

Tasks:

1. Create feature-local `api.ts` and `hooks.ts`.
2. Move target creation logic out of `App.tsx`.
3. Move prediction orchestration out of `App.tsx`.
4. Split `TargetList` into form + list.
5. Split prediction chart from prediction summary if needed.

Expected payoff:

- better change isolation
- easier UI expansion

### Phase 4: AI Service Narrowing

Objective:

- define AI service around stable business capabilities

Tasks:

1. Move prediction logic into `prediction_service.py`.
2. Move report/analysis composition into `analysis_service.py`.
3. Make API routes thin.
4. Keep pipeline internals private.

Expected payoff:

- less platform-style coupling
- cleaner service contract

## Risk Map

### Low Risk

- moving handler logic into application services
- splitting frontend API files
- reorganizing component ownership

### Medium Risk

- splitting repo module by aggregate
- changing API module ownership
- moving AI logic behind services

### High Risk

- introducing `prediction_runs`
- changing response contracts consumed by frontend
- changing sync execution model from inline to background

## Recommended Execution Order

If only a limited refactor budget is available, do this order:

1. Backend application layer
2. Source sync extraction
3. Prediction service extraction
4. API module cleanup
5. Forecasting schema upgrade
6. Frontend feature extraction
7. AI service narrowing

## What Not To Do Yet

- Do not split backend into more deployable services yet.
- Do not introduce a message queue yet.
- Do not add a global frontend state library unless feature hooks stop being enough.
- Do not redesign the AI service as a generic agent platform before the product contract is stable.

## Success Criteria

The refactor is successful when:

1. No HTTP handler contains business workflow loops.
2. No repository implementation calls external HTTP services.
3. Forecasting has an explicit run lifecycle.
4. `App.tsx` no longer owns core business orchestration.
5. AI service exposes stable product capabilities rather than leaking internal pipeline structure.
