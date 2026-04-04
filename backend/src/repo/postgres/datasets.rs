use async_trait::async_trait;
use sqlx::Row;

use crate::{
    models::{DataPoint, Dataset},
    repo::{CreateDataPoint, CreateDataset, DatasetRepo, RepoError, Result},
};

use super::PostgresRepo;

#[async_trait]
impl DatasetRepo for PostgresRepo {
    async fn list_datasets(&self) -> Result<Vec<Dataset>> {
        sqlx::query_as::<_, Dataset>(
            "SELECT id::bigint AS id, name, source, category, external_id, description, created_at, updated_at \
             FROM datasets ORDER BY category, name",
        )
            .fetch_all(&self.pool)
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

        let id: i64 = row.get::<i32, _>("id").into();
        sqlx::query_as::<_, Dataset>(
            "SELECT id::bigint AS id, name, source, category, external_id, description, created_at, updated_at \
             FROM datasets WHERE id = $1",
        )
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
        sqlx::query_as::<_, DataPoint>(
            "SELECT id::bigint AS id, dataset_id::bigint AS dataset_id, date, value, created_at \
             FROM data_points WHERE dataset_id = $1 ORDER BY date",
        )
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

    async fn upsert_or_create_dataset(
        &self,
        name: &str,
        source: &str,
        category: &str,
        external_id: &str,
        description: &str,
    ) -> Result<(i64, bool)> {
        let existing = sqlx::query("SELECT id FROM datasets WHERE source = $1 AND external_id = $2")
            .bind(source)
            .bind(external_id)
            .fetch_optional(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        if let Some(row) = existing {
            Ok((row.get::<i32, _>("id").into(), false))
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

            Ok((row.get::<i32, _>("id").into(), true))
        }
    }

    async fn datasets_by_source(&self, source_name: &str) -> Result<Vec<Dataset>> {
        sqlx::query_as::<_, Dataset>(
            "SELECT id::bigint AS id, name, source, category, external_id, description, created_at, updated_at \
             FROM datasets WHERE source = $1 ORDER BY category, name",
        )
        .bind(source_name)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }
}
