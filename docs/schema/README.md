# EmuWorld Database Schema

## Overview

PostgreSQL 16+ database. 5 tables, 3 indexes.

```
data_sources ──→ datasets ──→ data_points
                    │
                    └──→ prediction_targets ──→ predictions
```

## Tables

### data_sources

Registered external data APIs.

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| name | TEXT | NOT NULL, UNIQUE |
| display_name | TEXT | NOT NULL |
| api_base_url | TEXT | NOT NULL, DEFAULT '' |
| api_key | TEXT | NOT NULL, DEFAULT '' |
| description | TEXT | NOT NULL, DEFAULT '' |
| enabled | BOOLEAN | NOT NULL, DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

`name` values: `fred`, `world_bank`, `imf`, `nbs`, `oecd`, `eurostat`

### datasets

Individual time-series registered under a data source.

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| name | TEXT | NOT NULL |
| source | TEXT | NOT NULL (FK → data_sources.name) |
| category | TEXT | NOT NULL |
| external_id | TEXT | |
| description | TEXT | NOT NULL, DEFAULT '' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

`category` values: `inflation`, `growth`, `employment`, `trade`, `money_supply`, `real_estate`, `fiscal`, `demographics`, `interest_rate`, `exchange_rate`

### data_points

Actual (date, value) observations.

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| dataset_id | INTEGER | NOT NULL, FK → datasets(id) ON DELETE CASCADE |
| date | DATE | NOT NULL |
| value | DOUBLE PRECISION | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

Unique constraint: `(dataset_id, date)`

### prediction_targets

Forecast questions.

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| question | TEXT | NOT NULL |
| category | TEXT | NOT NULL |
| horizon_days | INTEGER | NOT NULL |
| outcomes | TEXT | NOT NULL (JSON array, e.g. `["Yes", "No", "Unsure"]`) |
| active | BOOLEAN | NOT NULL, DEFAULT true |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

### predictions

Forecast results.

| Column | Type | Constraints |
|---|---|---|
| id | SERIAL | PK |
| target_id | INTEGER | NOT NULL, FK → prediction_targets(id) ON DELETE CASCADE |
| outcome | TEXT | NOT NULL |
| probability | DOUBLE PRECISION | NOT NULL |
| confidence_lower | DOUBLE PRECISION | NOT NULL |
| confidence_upper | DOUBLE PRECISION | NOT NULL |
| model_version | TEXT | NOT NULL, DEFAULT 'v1' |
| created_at | TIMESTAMPTZ | NOT NULL, DEFAULT NOW() |

## Indexes

| Index | Table | Column(s) |
|---|---|---|
| idx_data_points_dataset_id | data_points | dataset_id |
| idx_datasets_source_external | datasets | (source, external_id) |
| idx_predictions_target_id | predictions | target_id |

## Migrations

Run: `psql -U emuworld -d emuworld -h localhost -f docs/schema/migrations/001_initial.sql`

Source of truth: `backend/src/repo/postgres/mod.rs` → `run_migrations()`

## Quick Setup

```bash
# Create role (one-time)
psql -U mac -d postgres -h localhost -c "CREATE ROLE emuworld WITH LOGIN PASSWORD 'emuworld_pass' CREATEDB;"

# Create database (one-time)
psql -U mac -d postgres -h localhost -c "CREATE DATABASE emuworld OWNER emuworld;"

# Run migrations
psql -U emuworld -d emuworld -h localhost -f docs/schema/migrations/001_initial.sql

# Verify
psql -U emuworld -d emuworld -h localhost -c "\dt+"
```
