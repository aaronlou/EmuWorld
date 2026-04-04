use async_trait::async_trait;
use sqlx::Row;

use crate::{
    models::DataSource,
    repo::{CreateDataSource, DataSourceRepo, RepoError, Result, UpdateDataSource},
};

use super::PostgresRepo;

#[async_trait]
impl DataSourceRepo for PostgresRepo {
    async fn list_sources(&self) -> Result<Vec<DataSource>> {
        sqlx::query_as::<_, DataSource>(
            "SELECT id::bigint AS id, name, display_name, api_base_url, api_key, description, enabled, created_at FROM data_sources ORDER BY name",
        )
            .fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_source(&self, id: i64) -> Result<Option<DataSource>> {
        sqlx::query_as::<_, DataSource>(
            "SELECT id::bigint AS id, name, display_name, api_base_url, api_key, description, enabled, created_at FROM data_sources WHERE id = $1",
        )
            .bind(id)
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

        let id: i64 = row.get::<i32, _>("id").into();
        sqlx::query_as::<_, DataSource>(
            "SELECT id::bigint AS id, name, display_name, api_base_url, api_key, description, enabled, created_at FROM data_sources WHERE id = $1",
        )
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
