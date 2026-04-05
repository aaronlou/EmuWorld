use async_trait::async_trait;

use crate::models::EventDatasetLink;
use crate::repo::{EventDatasetLinkRepo, RepoError, Result};

impl super::PostgresRepo {
    pub(super) async fn create_event_dataset_link(
        &self,
        event_id: i64,
        dataset_id: i64,
        note: &str,
        strength: &str,
    ) -> Result<EventDatasetLink> {
        let row = sqlx::query_as::<_, EventDatasetLink>(
            r#"
            INSERT INTO event_dataset_links (event_id, dataset_id, note, strength)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (event_id, dataset_id) DO UPDATE SET note = $3, strength = $4
            RETURNING id, event_id, dataset_id, note, strength, created_at
            "#,
        )
        .bind(event_id)
        .bind(dataset_id)
        .bind(note)
        .bind(strength)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(row)
    }

    pub(super) async fn list_links_by_event(&self, event_id: i64) -> Result<Vec<EventDatasetLink>> {
        let rows = sqlx::query_as::<_, EventDatasetLink>(
            "SELECT id, event_id, dataset_id, note, strength, created_at FROM event_dataset_links WHERE event_id = $1",
        )
        .bind(event_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }

    pub(super) async fn list_links_by_dataset(&self, dataset_id: i64) -> Result<Vec<EventDatasetLink>> {
        let rows = sqlx::query_as::<_, EventDatasetLink>(
            "SELECT id, event_id, dataset_id, note, strength, created_at FROM event_dataset_links WHERE dataset_id = $1",
        )
        .bind(dataset_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }

    pub(super) async fn delete_event_dataset_link(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM event_dataset_links WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(())
    }
}

#[async_trait]
impl EventDatasetLinkRepo for super::PostgresRepo {
    async fn list_links_by_event(&self, event_id: i64) -> Result<Vec<EventDatasetLink>> {
        Self::list_links_by_event(self, event_id).await
    }

    async fn list_links_by_dataset(&self, dataset_id: i64) -> Result<Vec<EventDatasetLink>> {
        Self::list_links_by_dataset(self, dataset_id).await
    }

    async fn create_link(&self, event_id: i64, dataset_id: i64, note: &str, strength: &str) -> Result<EventDatasetLink> {
        Self::create_event_dataset_link(self, event_id, dataset_id, note, strength).await
    }

    async fn delete_link(&self, id: i64) -> Result<()> {
        Self::delete_event_dataset_link(self, id).await
    }
}
