-- EmuWorld Database Schema
-- Target: PostgreSQL 16+
-- Database: emuworld
-- Run: psql -U emuworld -d emuworld -f docs/schema/migrations/001_initial.sql

BEGIN;

-- ============================================================================
-- 1. Data Sources
--    Registered external APIs (FRED, World Bank, IMF, NBS, OECD, Eurostat)
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_sources (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,         -- "fred", "world_bank", "imf", "nbs", "oecd", "eurostat"
    display_name TEXT NOT NULL,                -- "FRED", "World Bank", etc.
    api_base_url TEXT NOT NULL DEFAULT '',     -- Base URL for the API
    api_key      TEXT NOT NULL DEFAULT '',     -- API key (if required)
    description  TEXT NOT NULL DEFAULT '',
    enabled      BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Datasets
--    Individual time-series registered under a data source
--    e.g. "CPIAUCSL" under FRED, "NY.GDP.MKTP.CD" under World Bank
-- ============================================================================
CREATE TABLE IF NOT EXISTS datasets (
    id           SERIAL PRIMARY KEY,
    name         TEXT NOT NULL,                -- Human-readable name
    source       TEXT NOT NULL,                -- Matches data_sources.name
    category     TEXT NOT NULL,                -- "inflation", "growth", "employment", "trade", "money_supply", "real_estate", "fiscal", "demographics", "interest_rate", "exchange_rate"
    external_id  TEXT,                         -- Provider-specific series code
    description  TEXT NOT NULL DEFAULT '',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. Data Points
--    Actual (date, value) observations for each dataset
-- ============================================================================
CREATE TABLE IF NOT EXISTS data_points (
    id         SERIAL PRIMARY KEY,
    dataset_id INTEGER NOT NULL REFERENCES datasets(id) ON DELETE CASCADE,
    date       DATE NOT NULL,
    value      DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(dataset_id, date)
);

-- ============================================================================
-- 4. Prediction Targets
--    Questions the system will forecast, e.g. "Will US CPI exceed 3% in 90 days?"
-- ============================================================================
CREATE TABLE IF NOT EXISTS prediction_targets (
    id           SERIAL PRIMARY KEY,
    question     TEXT NOT NULL,
    category     TEXT NOT NULL,
    horizon_days INTEGER NOT NULL,
    outcomes     TEXT NOT NULL,              -- JSON array: ["Yes", "No", "Unsure"]
    active       BOOLEAN NOT NULL DEFAULT true,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. Predictions
--    Forecast results with probability and confidence intervals
-- ============================================================================
CREATE TABLE IF NOT EXISTS predictions (
    id                 SERIAL PRIMARY KEY,
    target_id          INTEGER NOT NULL REFERENCES prediction_targets(id) ON DELETE CASCADE,
    outcome            TEXT NOT NULL,
    probability        DOUBLE PRECISION NOT NULL,
    confidence_lower   DOUBLE PRECISION NOT NULL,
    confidence_upper   DOUBLE PRECISION NOT NULL,
    model_version      TEXT NOT NULL DEFAULT 'v1',
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- Indexes
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_data_points_dataset_id    ON data_points(dataset_id);
CREATE INDEX IF NOT EXISTS idx_datasets_source_external  ON datasets(source, external_id);
CREATE INDEX IF NOT EXISTS idx_predictions_target_id     ON predictions(target_id);

COMMIT;
