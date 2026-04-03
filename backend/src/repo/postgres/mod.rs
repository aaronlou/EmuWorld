use async_trait::async_trait;
use sqlx::{PgPool, Row};

use crate::models::{DataPoint, Dataset, DataSource, Prediction, PredictionResponse, PredictionTarget};
use crate::repo::{
    CreateDataPoint, CreateDataset, CreateDataSource, CreatePrediction, DatasetRepo, DataSourceRepo, PredictionRepo, RepoError, Result, TargetRepo, UpdateDataSource, AppRepo,
};

pub struct PostgresRepo {
    pool: PgPool,
}

impl PostgresRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}

#[async_trait]
impl DatasetRepo for PostgresRepo {
    async fn list_datasets(&self) -> Result<Vec<Dataset>> {
        sqlx::query_as::<_, Dataset>("SELECT * FROM datasets ORDER BY category, name")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_dataset(&self, id: i64) -> Result<Option<Dataset>> {
        sqlx::query_as::<_, Dataset>("SELECT * FROM datasets WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn create_dataset(&self, dataset: &CreateDataset) -> Result<Dataset> {
        let row = sqlx::query(
            "INSERT INTO datasets (name, source, category, external_id, description) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        )
        .bind(&dataset.name)
        .bind(&dataset.source)
        .bind(&dataset.category)
        .bind(&dataset.external_id)
        .bind(&dataset.description)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get("id");
        sqlx::query_as::<_, Dataset>("SELECT * FROM datasets WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn delete_dataset(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM data_points WHERE dataset_id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        sqlx::query("DELETE FROM datasets WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(())
    }

    async fn data_points(&self, dataset_id: i64) -> Result<Vec<DataPoint>> {
        sqlx::query_as::<_, DataPoint>("SELECT * FROM data_points WHERE dataset_id = $1 ORDER BY date")
            .bind(dataset_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn upsert_data_point(&self, point: &CreateDataPoint) -> Result<usize> {
        let result = sqlx::query(
            "INSERT INTO data_points (dataset_id, date, value) VALUES ($1, $2, $3) \
             ON CONFLICT (dataset_id, date) DO UPDATE SET value = EXCLUDED.value",
        )
        .bind(point.dataset_id)
        .bind(point.date)
        .bind(point.value)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(result.rows_affected() as usize)
    }

    async fn upsert_or_create_dataset(&self, name: &str, source: &str, category: &str, external_id: &str, description: &str) -> Result<(i64, bool)> {
        let existing = sqlx::query("SELECT id FROM datasets WHERE source = $1 AND external_id = $2")
            .bind(source)
            .bind(external_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        if let Some(row) = existing {
            Ok((row.get::<i64, _>("id"), false))
        } else {
            let row = sqlx::query(
                "INSERT INTO datasets (name, source, category, external_id, description) VALUES ($1, $2, $3, $4, $5) RETURNING id",
            )
            .bind(name)
            .bind(source)
            .bind(category)
            .bind(external_id)
            .bind(description)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

            Ok((row.get::<i64, _>("id"), true))
        }
    }

    async fn datasets_by_source(&self, source_name: &str) -> Result<Vec<Dataset>> {
        sqlx::query_as::<_, Dataset>("SELECT * FROM datasets WHERE source = $1 ORDER BY category, name")
            .bind(source_name)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }
}

#[async_trait]
impl TargetRepo for PostgresRepo {
    async fn list_targets(&self) -> Result<Vec<PredictionTarget>> {
        sqlx::query_as::<_, PredictionTarget>(
            "SELECT * FROM prediction_targets WHERE active = true ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_target(&self, id: i64) -> Result<Option<PredictionTarget>> {
        sqlx::query_as::<_, PredictionTarget>("SELECT * FROM prediction_targets WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn create_target(&self, req: &crate::models::CreateTargetRequest) -> Result<PredictionTarget> {
        let outcomes_json = serde_json::to_string(&req.outcomes)
            .map_err(|e| RepoError::Validation(e.to_string()))?;

        let row = sqlx::query(
            "INSERT INTO prediction_targets (question, category, horizon_days, outcomes) VALUES ($1, $2, $3, $4) RETURNING id",
        )
        .bind(&req.question)
        .bind(&req.category)
        .bind(req.horizon_days)
        .bind(&outcomes_json)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get("id");
        sqlx::query_as::<_, PredictionTarget>("SELECT * FROM prediction_targets WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }
}

#[async_trait]
impl PredictionRepo for PostgresRepo {
    async fn list_by_target(&self, target_id: i64) -> Result<Vec<Prediction>> {
        sqlx::query_as::<_, Prediction>(
            "SELECT * FROM predictions WHERE target_id = $1 ORDER BY probability DESC",
        )
        .bind(target_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn create_batch(&self, _target_id: i64, predictions: &[CreatePrediction]) -> Result<()> {
        for p in predictions {
            sqlx::query(
                "INSERT INTO predictions (target_id, outcome, probability, confidence_lower, confidence_upper) VALUES ($1, $2, $3, $4, $5)",
            )
            .bind(p.target_id)
            .bind(&p.outcome)
            .bind(p.probability)
            .bind(p.confidence_lower)
            .bind(p.confidence_upper)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;
        }
        Ok(())
    }

    async fn generate(&self, target_id: i64, ai_service_url: &str) -> Result<PredictionResponse> {
        let target = self
            .get_target(target_id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("target {}", target_id)))?;

        let outcomes: Vec<String> = serde_json::from_str(&target.outcomes)
            .map_err(|e| RepoError::Database(e.to_string()))?;

        let client = reqwest::Client::new();
        let ai_response = client
            .post(&format!("{}/predict", ai_service_url))
            .json(&serde_json::json!({
                "question": target.question,
                "horizon_days": target.horizon_days,
                "outcomes": outcomes,
            }))
            .send()
            .await
            .map_err(|e| RepoError::ExternalService(e.to_string()))?;

        let probs: Vec<f64> = ai_response
            .json()
            .await
            .map_err(|e| RepoError::ExternalService(e.to_string()))?;

        let predictions: Vec<CreatePrediction> = outcomes
            .iter()
            .zip(probs.iter())
            .map(|(outcome, prob)| CreatePrediction {
                target_id,
                outcome: outcome.clone(),
                probability: *prob,
                confidence_lower: (*prob - 0.05).max(0.0),
                confidence_upper: (*prob + 0.05).min(1.0),
            })
            .collect();

        self.create_batch(target_id, &predictions).await?;

        let predictions = self.list_by_target(target_id).await?;

        Ok(PredictionResponse {
            target,
            predictions,
            generated_at: chrono::Utc::now(),
        })
    }
}

#[async_trait]
impl DataSourceRepo for PostgresRepo {
    async fn list_sources(&self) -> Result<Vec<DataSource>> {
        sqlx::query_as::<_, DataSource>("SELECT * FROM data_sources ORDER BY name")
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_source(&self, id: i64) -> Result<Option<DataSource>> {
        sqlx::query_as::<_, DataSource>("SELECT * FROM data_sources WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_source_by_name(&self, name: &str) -> Result<Option<DataSource>> {
        sqlx::query_as::<_, DataSource>("SELECT * FROM data_sources WHERE name = $1")
            .bind(name)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn create_source(&self, source: &CreateDataSource) -> Result<DataSource> {
        let row = sqlx::query(
            "INSERT INTO data_sources (name, display_name, api_base_url, api_key, description) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        )
        .bind(&source.name)
        .bind(&source.display_name)
        .bind(&source.api_base_url)
        .bind(&source.api_key)
        .bind(&source.description)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get("id");
        sqlx::query_as::<_, DataSource>("SELECT * FROM data_sources WHERE id = $1")
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn update_source(&self, id: i64, updates: &UpdateDataSource) -> Result<DataSource> {
        if updates.display_name.is_none()
            && updates.api_base_url.is_none()
            && updates.api_key.is_none()
            && updates.description.is_none()
            && updates.enabled.is_none()
        {
            return self.get_source(id).await.and_then(|opt| {
                opt.ok_or_else(|| RepoError::NotFound(format!("source {}", id)))
            });
        }

        let display_name = updates.display_name.as_deref();
        let api_base_url = updates.api_base_url.as_deref();
        let api_key = updates.api_key.as_deref();
        let description = updates.description.as_deref();
        let enabled = updates.enabled;

        sqlx::query(
            "UPDATE data_sources SET \
                display_name = COALESCE($1, display_name), \
                api_base_url = COALESCE($2, api_base_url), \
                api_key = COALESCE($3, api_key), \
                description = COALESCE($4, description), \
                enabled = COALESCE($5, enabled) \
             WHERE id = $6",
        )
        .bind(display_name)
        .bind(api_base_url)
        .bind(api_key)
        .bind(description)
        .bind(enabled)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        self.get_source(id).await.and_then(|opt| {
            opt.ok_or_else(|| RepoError::NotFound(format!("source {}", id)))
        })
    }

    async fn delete_source(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM data_sources WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;
        Ok(())
    }
}

impl AppRepo for PostgresRepo {}

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
        CREATE TABLE IF NOT EXISTS predictions (
            id SERIAL PRIMARY KEY,
            target_id INTEGER NOT NULL REFERENCES prediction_targets(id),
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
        "CREATE INDEX IF NOT EXISTS idx_predictions_target_id ON predictions(target_id)",
    )
    .execute(pool)
    .await
    .map_err(|e| RepoError::Database(e.to_string()))?;

    Ok(())
}
