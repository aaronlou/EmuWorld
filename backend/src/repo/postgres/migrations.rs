use sqlx::PgPool;

use crate::repo::{RepoError, Result};

pub async fn run_migrations(pool: &PgPool) -> Result<()> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS data_sources (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            api_base_url TEXT NOT NULL DEFAULT '',
            api_key TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            enabled BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS datasets (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            source TEXT NOT NULL,
            category TEXT NOT NULL,
            external_id TEXT,
            description TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS data_points (
            id SERIAL PRIMARY KEY,
            dataset_id INTEGER NOT NULL REFERENCES datasets(id),
            date DATE NOT NULL,
            value DOUBLE PRECISION NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(dataset_id, date)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS prediction_targets (
            id SERIAL PRIMARY KEY,
            question TEXT NOT NULL,
            category TEXT NOT NULL,
            horizon_days INTEGER NOT NULL,
            outcomes TEXT NOT NULL,
            active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS prediction_runs (
            id SERIAL PRIMARY KEY,
            target_id INTEGER NOT NULL REFERENCES prediction_targets(id) ON DELETE CASCADE,
            status TEXT NOT NULL,
            model_version TEXT NOT NULL DEFAULT 'v1',
            input_snapshot TEXT NOT NULL,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            started_at TIMESTAMPTZ,
            finished_at TIMESTAMPTZ
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS predictions (
            id SERIAL PRIMARY KEY,
            target_id INTEGER NOT NULL REFERENCES prediction_targets(id),
            run_id INTEGER REFERENCES prediction_runs(id) ON DELETE CASCADE,
            outcome TEXT NOT NULL,
            probability DOUBLE PRECISION NOT NULL,
            confidence_lower DOUBLE PRECISION NOT NULL,
            confidence_upper DOUBLE PRECISION NOT NULL,
            model_version TEXT NOT NULL DEFAULT 'v1',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id SERIAL PRIMARY KEY,
            title TEXT NOT NULL DEFAULT 'New chat',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS chat_messages (
            id SERIAL PRIMARY KEY,
            session_id INTEGER NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            provider TEXT,
            model TEXT,
            used_fallback BOOLEAN NOT NULL DEFAULT false,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "ALTER TABLE predictions ADD COLUMN IF NOT EXISTS run_id INTEGER REFERENCES prediction_runs(id) ON DELETE CASCADE",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_data_points_dataset_id ON data_points(dataset_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_datasets_source_external ON datasets(source, external_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_prediction_runs_target_id ON prediction_runs(target_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_predictions_target_id ON predictions(target_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_predictions_run_id ON predictions(run_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id, created_at)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    // ── Memory system tables ──

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS memory_entries (
            id SERIAL PRIMARY KEY,
            memory_type TEXT NOT NULL,           -- episodic, semantic, procedural, cognitive
            content    TEXT NOT NULL,
            summary    TEXT NOT NULL DEFAULT '',
            tags       TEXT[] NOT NULL DEFAULT '{}',
            source     TEXT NOT NULL DEFAULT '',  -- user_chat, agent_generated, observation
            confidence  DOUBLE PRECISION NOT NULL DEFAULT 1.0,
            embedding  TEXT NOT NULL DEFAULT '',  -- reserved for pgvector later
            metadata   JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS memory_links (
            id SERIAL PRIMARY KEY,
            source_id INTEGER NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
            target_id INTEGER NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
            relation  TEXT NOT NULL,              -- related_to, supports, contradicts, causes
            metadata  JSONB NOT NULL DEFAULT '{}',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(source_id, target_id, relation)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS memory_sessions (
            id SERIAL PRIMARY KEY,
            session_summary TEXT NOT NULL DEFAULT '',
            key_topics     TEXT[] NOT NULL DEFAULT '{}',
            entry_ids      INTEGER[] NOT NULL DEFAULT '{}',
            started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            ended_at       TIMESTAMPTZ
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    // full-text search index on content + summary
    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_memory_fts ON memory_entries USING GIN(to_tsvector('simple', content || ' ' || summary))",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_memory_type ON memory_entries(memory_type)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_memory_tags ON memory_entries USING GIN(tags)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        "CREATE INDEX IF NOT EXISTS idx_memory_links_source ON memory_links(source_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS news_articles (
            id SERIAL PRIMARY KEY,
            source_name TEXT NOT NULL,
            title TEXT NOT NULL,
            url TEXT NOT NULL UNIQUE,
            description TEXT,
            content TEXT,
            author TEXT,
            published_at TIMESTAMP NOT NULL,
            category TEXT,
            language TEXT NOT NULL DEFAULT 'en',
            country TEXT NOT NULL DEFAULT 'us',
            fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            sentiment_score DOUBLE PRECISION,
            entities JSONB,
            processed_at TIMESTAMPTZ
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_news_source_name ON news_articles(source_name)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_news_published_at ON news_articles(published_at)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_news_sentiment ON news_articles(sentiment_score)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS indicator_anomalies (
            id SERIAL PRIMARY KEY,
            dataset_id INTEGER NOT NULL REFERENCES datasets(id),
            date DATE NOT NULL,
            value DOUBLE PRECISION NOT NULL,
            z_score DOUBLE PRECISION NOT NULL,
            threshold DOUBLE PRECISION NOT NULL DEFAULT 2.0,
            anomaly_type TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(dataset_id, date)
        )
        "#,
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_anomalies_dataset ON indicator_anomalies(dataset_id)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    sqlx::query("CREATE INDEX IF NOT EXISTS idx_anomalies_z_score ON indicator_anomalies(z_score)")
        .execute(pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

    Ok(())
}
