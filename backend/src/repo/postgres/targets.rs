use async_trait::async_trait;
use sqlx::Row;

use crate::{
    models::PredictionTarget,
    repo::{RepoError, Result, TargetRepo},
};

use super::PostgresRepo;

#[async_trait]
impl TargetRepo for PostgresRepo {
    async fn list_targets(&self) -> Result<Vec<PredictionTarget>> {
        sqlx::query_as::<_, PredictionTarget>(
            "SELECT id::bigint AS id, question, category, horizon_days, outcomes, active, created_at \
             FROM prediction_targets WHERE active = true ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_target(&self, id: i64) -> Result<Option<PredictionTarget>> {
        sqlx::query_as::<_, PredictionTarget>(
            "SELECT id::bigint AS id, question, category, horizon_days, outcomes, active, created_at \
             FROM prediction_targets WHERE id = $1",
        )
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

        let id: i64 = row.get::<i32, _>("id").into();
        sqlx::query_as::<_, PredictionTarget>(
            "SELECT id::bigint AS id, question, category, horizon_days, outcomes, active, created_at \
             FROM prediction_targets WHERE id = $1",
        )
            .bind(id)
            .fetch_one(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }
}
