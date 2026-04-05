use async_trait::async_trait;

use crate::models::Hypothesis;
use crate::repo::{CreateHypothesis, HypothesisRepo, RepoError, Result};

impl super::PostgresRepo {
    pub(super) async fn create_hypothesis(&self, hypothesis: &CreateHypothesis) -> Result<Hypothesis> {
        let confidence = hypothesis.confidence.unwrap_or(0.5);

        let row = sqlx::query_as::<_, Hypothesis>(
            r#"
            INSERT INTO hypotheses (content, status, confidence, resolution_note)
            VALUES ($1, 'active', $2, '')
            RETURNING id, content, status, confidence, resolution_note, resolved_at, created_at
            "#,
        )
        .bind(&hypothesis.content)
        .bind(confidence)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(row)
    }

    pub(super) async fn list_hypotheses(&self) -> Result<Vec<Hypothesis>> {
        let rows = sqlx::query_as::<_, Hypothesis>(
            "SELECT id, content, status, confidence, resolution_note, resolved_at, created_at FROM hypotheses ORDER BY created_at DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }

    pub(super) async fn get_hypothesis(&self, id: i64) -> Result<Option<Hypothesis>> {
        let row = sqlx::query_as::<_, Hypothesis>(
            "SELECT id, content, status, confidence, resolution_note, resolved_at, created_at FROM hypotheses WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(row)
    }

    pub(super) async fn update_hypothesis(
        &self,
        id: i64,
        status: Option<&str>,
        confidence: Option<f64>,
        resolution_note: &str,
    ) -> Result<Hypothesis> {
        let status_enum = status.map(|s| {
            crate::models::HypothesisStatus::from_str(s)
                .unwrap_or(crate::models::HypothesisStatus::Active)
        });

        let is_resolved = status_enum
            .map(|s| s != crate::models::HypothesisStatus::Active)
            .unwrap_or(false);

        let row = sqlx::query_as::<_, Hypothesis>(
            r#"
            UPDATE hypotheses
            SET status = COALESCE($1, status),
                confidence = COALESCE($2, confidence),
                resolution_note = CASE WHEN $3 != '' THEN $3 ELSE resolution_note END,
                resolved_at = CASE WHEN $4 THEN NOW() ELSE resolved_at END
            WHERE id = $5
            RETURNING id, content, status, confidence, resolution_note, resolved_at, created_at
            "#,
        )
        .bind(status_enum)
        .bind(confidence)
        .bind(resolution_note)
        .bind(is_resolved)
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(row)
    }

    pub(super) async fn delete_hypothesis(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM hypotheses WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(())
    }

    pub(super) async fn list_hypotheses_by_status(&self, status: &str) -> Result<Vec<Hypothesis>> {
        let rows = sqlx::query_as::<_, Hypothesis>(
            "SELECT id, content, status, confidence, resolution_note, resolved_at, created_at FROM hypotheses WHERE status = $1 ORDER BY created_at DESC",
        )
        .bind(status)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }
}

#[async_trait]
impl HypothesisRepo for super::PostgresRepo {
    async fn list_hypotheses(&self) -> Result<Vec<Hypothesis>> {
        Self::list_hypotheses(self).await
    }

    async fn get_hypothesis(&self, id: i64) -> Result<Option<Hypothesis>> {
        Self::get_hypothesis(self, id).await
    }

    async fn create_hypothesis(&self, hypothesis: &CreateHypothesis) -> Result<Hypothesis> {
        Self::create_hypothesis(self, hypothesis).await
    }

    async fn update_hypothesis(&self, id: i64, status: Option<&str>, confidence: Option<f64>, resolution_note: &str) -> Result<Hypothesis> {
        Self::update_hypothesis(self, id, status, confidence, resolution_note).await
    }

    async fn delete_hypothesis(&self, id: i64) -> Result<()> {
        Self::delete_hypothesis(self, id).await
    }

    async fn list_hypotheses_by_status(&self, status: &str) -> Result<Vec<Hypothesis>> {
        Self::list_hypotheses_by_status(self, status).await
    }
}
