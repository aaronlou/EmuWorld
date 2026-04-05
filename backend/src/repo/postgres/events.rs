use async_trait::async_trait;

use crate::models::Event;
use crate::repo::{CreateEvent, EventRepo, RepoError, Result};

impl super::PostgresRepo {
    pub(super) async fn create_event(&self, event: &CreateEvent) -> Result<Event> {
        let description = event.description.as_deref().unwrap_or("");
        let tags = event.tags.as_ref().map(|v| serde_json::to_string(v).unwrap_or_default()).unwrap_or_else(|| "[]".to_string());
        let source = event.source.as_deref().unwrap_or("manual");

        let row = sqlx::query_as::<_, Event>(
            r#"
            INSERT INTO events (title, date, category, description, tags, source, impact_score)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, title, date, category, description, tags, source, impact_score, created_at
            "#,
        )
        .bind(&event.title)
        .bind(event.date)
        .bind(&event.category)
        .bind(description)
        .bind(&tags)
        .bind(source)
        .bind(event.impact_score)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(row)
    }

    pub(super) async fn list_events(&self) -> Result<Vec<Event>> {
        let rows = sqlx::query_as::<_, Event>(
            "SELECT id, title, date, category, description, tags, source, impact_score, created_at FROM events ORDER BY date DESC",
        )
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }

    pub(super) async fn get_event(&self, id: i64) -> Result<Option<Event>> {
        let row = sqlx::query_as::<_, Event>(
            "SELECT id, title, date, category, description, tags, source, impact_score, created_at FROM events WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(row)
    }

    pub(super) async fn delete_event(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM events WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(())
    }

    pub(super) async fn list_events_by_category(&self, category: &str) -> Result<Vec<Event>> {
        let rows = sqlx::query_as::<_, Event>(
            "SELECT id, title, date, category, description, tags, source, impact_score, created_at FROM events WHERE category = $1 ORDER BY date DESC",
        )
        .bind(category)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }

    pub(super) async fn list_events_in_range(&self, start: chrono::NaiveDate, end: chrono::NaiveDate) -> Result<Vec<Event>> {
        let rows = sqlx::query_as::<_, Event>(
            "SELECT id, title, date, category, description, tags, source, impact_score, created_at FROM events WHERE date >= $1 AND date <= $2 ORDER BY date DESC",
        )
        .bind(start)
        .bind(end)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(rows)
    }
}

#[async_trait]
impl EventRepo for super::PostgresRepo {
    async fn list_events(&self) -> Result<Vec<Event>> {
        Self::list_events(self).await
    }

    async fn get_event(&self, id: i64) -> Result<Option<Event>> {
        Self::get_event(self, id).await
    }

    async fn create_event(&self, event: &CreateEvent) -> Result<Event> {
        Self::create_event(self, event).await
    }

    async fn delete_event(&self, id: i64) -> Result<()> {
        Self::delete_event(self, id).await
    }

    async fn list_events_by_category(&self, category: &str) -> Result<Vec<Event>> {
        Self::list_events_by_category(self, category).await
    }

    async fn list_events_in_range(&self, start: chrono::NaiveDate, end: chrono::NaiveDate) -> Result<Vec<Event>> {
        Self::list_events_in_range(self, start, end).await
    }
}
