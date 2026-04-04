use async_trait::async_trait;
use sqlx::Row;

use crate::{
    models::{Prediction, PredictionRun},
    repo::{CreatePrediction, CreatePredictionRun, PredictionRepo, RepoError, Result},
};

use super::PostgresRepo;

#[async_trait]
impl PredictionRepo for PostgresRepo {
    async fn list_by_target(&self, target_id: i64) -> Result<Vec<Prediction>> {
        sqlx::query_as::<_, Prediction>(
            "SELECT id::bigint AS id, target_id::bigint AS target_id, run_id::bigint AS run_id, outcome, probability, \
             confidence_lower, confidence_upper, model_version, created_at \
             FROM predictions WHERE target_id = $1 ORDER BY created_at DESC, probability DESC",
        )
        .bind(target_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn list_by_run(&self, run_id: i64) -> Result<Vec<Prediction>> {
        sqlx::query_as::<_, Prediction>(
            "SELECT id::bigint AS id, target_id::bigint AS target_id, run_id::bigint AS run_id, outcome, probability, \
             confidence_lower, confidence_upper, model_version, created_at \
             FROM predictions WHERE run_id = $1 ORDER BY probability DESC",
        )
        .bind(run_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn list_runs_by_target(&self, target_id: i64) -> Result<Vec<PredictionRun>> {
        sqlx::query_as::<_, PredictionRun>(
            "SELECT id::bigint AS id, target_id::bigint AS target_id, status, model_version, input_snapshot, \
             error_message, created_at, started_at, finished_at \
             FROM prediction_runs WHERE target_id = $1 ORDER BY created_at DESC",
        )
        .bind(target_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn list_latest_runs(&self) -> Result<Vec<PredictionRun>> {
        sqlx::query_as::<_, PredictionRun>(
            r#"
            SELECT DISTINCT ON (target_id)
                id::bigint AS id,
                target_id::bigint AS target_id,
                status,
                model_version,
                input_snapshot,
                error_message,
                created_at,
                started_at,
                finished_at
            FROM prediction_runs
            ORDER BY target_id, created_at DESC
            "#,
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_run(&self, run_id: i64) -> Result<Option<PredictionRun>> {
        sqlx::query_as::<_, PredictionRun>(
            "SELECT id::bigint AS id, target_id::bigint AS target_id, status, model_version, input_snapshot, \
             error_message, created_at, started_at, finished_at \
             FROM prediction_runs WHERE id = $1",
        )
        .bind(run_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn create_run(&self, run: &CreatePredictionRun) -> Result<PredictionRun> {
        let row = sqlx::query(
            "INSERT INTO prediction_runs (target_id, status, model_version, input_snapshot, started_at) \
             VALUES ($1, $2, $3, $4, NOW()) RETURNING id",
        )
        .bind(run.target_id)
        .bind(&run.status)
        .bind(&run.model_version)
        .bind(&run.input_snapshot)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get::<i32, _>("id").into();
        self.get_run(id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("prediction run {}", id)))
    }

    async fn mark_run_completed(&self, run_id: i64) -> Result<PredictionRun> {
        sqlx::query(
            "UPDATE prediction_runs SET status = 'completed', finished_at = NOW(), error_message = NULL WHERE id = $1",
        )
        .bind(run_id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        self.get_run(run_id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("prediction run {}", run_id)))
    }

    async fn mark_run_failed(&self, run_id: i64, error_message: &str) -> Result<PredictionRun> {
        sqlx::query(
            "UPDATE prediction_runs SET status = 'failed', finished_at = NOW(), error_message = $2 WHERE id = $1",
        )
        .bind(run_id)
        .bind(error_message)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        self.get_run(run_id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("prediction run {}", run_id)))
    }

    async fn create_batch(&self, _target_id: i64, predictions: &[CreatePrediction]) -> Result<()> {
        for p in predictions {
            sqlx::query(
                "INSERT INTO predictions (target_id, run_id, outcome, probability, confidence_lower, confidence_upper) VALUES ($1, $2, $3, $4, $5, $6)",
            )
            .bind(p.target_id)
            .bind(p.run_id)
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
}
