use async_trait::async_trait;

use crate::models::HypothesisTargetLink;
use crate::repo::{HypothesisTargetLinkRepo, RepoError, Result};

impl super::PostgresRepo {
    pub(super) async fn create_hypothesis_target_link(
        &self,
        hypothesis_id: i64,
        target_id: i64,
        note: &str,
    ) -> Result<HypothesisTargetLink> {
        let row = sqlx::query_as::<_, HypothesisTargetLink>(
            r#"
            INSERT INTO hypothesis_target_links (hypothesis_id, target_id, note)
            VALUES ($1, $2, $3)
            ON CONFLICT (hypothesis_id, target_id) DO UPDATE SET note = $3
            RETURNING id, hypothesis_id, target_id, note, created_at
            "#,
        )
        .bind(hypothesis_id)
        .bind(target_id)
        .bind(note)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(row)
    }

    pub(super) async fn list_links_by_hypothesis(&self, hypothesis_id: i64) -> Result<Vec<HypothesisTargetLink>> {
        let rows = sqlx::query_as::<_, HypothesisTargetLink>(
            "SELECT id, hypothesis_id, target_id, note, created_at FROM hypothesis_target_links WHERE hypothesis_id = $1",
        )
        .bind(hypothesis_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }

    pub(super) async fn list_links_by_target(&self, target_id: i64) -> Result<Vec<HypothesisTargetLink>> {
        let rows = sqlx::query_as::<_, HypothesisTargetLink>(
            "SELECT id, hypothesis_id, target_id, note, created_at FROM hypothesis_target_links WHERE target_id = $1",
        )
        .bind(target_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }

    pub(super) async fn delete_hypothesis_target_link(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM hypothesis_target_links WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(())
    }
}

#[async_trait]
impl HypothesisTargetLinkRepo for super::PostgresRepo {
    async fn list_links_by_hypothesis(&self, hypothesis_id: i64) -> Result<Vec<HypothesisTargetLink>> {
        Self::list_links_by_hypothesis(self, hypothesis_id).await
    }

    async fn list_links_by_target(&self, target_id: i64) -> Result<Vec<HypothesisTargetLink>> {
        Self::list_links_by_target(self, target_id).await
    }

    async fn create_link(&self, hypothesis_id: i64, target_id: i64, note: &str) -> Result<HypothesisTargetLink> {
        Self::create_hypothesis_target_link(self, hypothesis_id, target_id, note).await
    }

    async fn delete_link(&self, id: i64) -> Result<()> {
        Self::delete_hypothesis_target_link(self, id).await
    }
}
