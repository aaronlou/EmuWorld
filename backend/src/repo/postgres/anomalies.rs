use async_trait::async_trait;
use sqlx::Row;

use crate::{
    models::{AnomalyQuery, IndicatorAnomaly},
    repo::{AnomalyRepo, RepoError, Result},
};

use super::PostgresRepo;

#[async_trait]
impl AnomalyRepo for PostgresRepo {
    async fn create_anomaly(
        &self,
        dataset_id: i64,
        date: chrono::NaiveDate,
        value: f64,
        z_score: f64,
        anomaly_type: &str,
    ) -> Result<IndicatorAnomaly> {
        let row = sqlx::query(
            "INSERT INTO indicator_anomalies (dataset_id, date, value, z_score, anomaly_type) \
             VALUES ($1, $2, $3, $4, $5) ON CONFLICT (dataset_id, date) DO UPDATE SET \
             z_score = EXCLUDED.z_score, value = EXCLUDED.value \
             RETURNING id",
        )
        .bind(dataset_id)
        .bind(date)
        .bind(value)
        .bind(z_score)
        .bind(anomaly_type)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get::<i32, _>("id").into();
        self.get_anomaly(id).await?.ok_or_else(|| RepoError::NotFound(format!("anomaly {}", id)))
    }

    async fn list_anomalies(&self, query: &AnomalyQuery) -> Result<Vec<IndicatorAnomaly>> {
        let mut sql = String::from(
            "SELECT id::bigint AS id, dataset_id, date, value, z_score, threshold, anomaly_type, created_at \
             FROM indicator_anomalies WHERE 1=1",
        );

        if query.dataset_id.is_some() {
            sql.push_str(" AND dataset_id = $1");
        }
        if query.min_z_score.is_some() {
            sql.push_str(if query.dataset_id.is_some() {
                " AND ABS(z_score) >= $2"
            } else {
                " AND ABS(z_score) >= $1"
            });
        }
        if query.from_date.is_some() {
            let param = match (&query.dataset_id, &query.min_z_score) {
                (Some(_), Some(_)) => "$3",
                _ => "$2",
            };
            sql.push_str(&format!(" AND date >= {}", param));
        }
        if query.to_date.is_some() {
            let param = match (&query.dataset_id, &query.min_z_score, &query.from_date) {
                (Some(_), Some(_), Some(_)) => "$4",
                _ => "$3",
            };
            sql.push_str(&format!(" AND date <= {}", param));
        }

        sql.push_str(&format!(" ORDER BY ABS(z_score) DESC LIMIT {}", query.limit));

        let mut q = sqlx::query_as::<_, IndicatorAnomaly>(&sql);

        if let Some(id) = query.dataset_id {
            q = q.bind(id);
        }
        if let Some(z) = query.min_z_score {
            q = q.bind(z);
        }
        if let Some(ref d) = query.from_date {
            q = q.bind(d);
        }
        if let Some(ref d) = query.to_date {
            q = q.bind(d);
        }

        q.fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_latest_anomalies(&self, dataset_id: i64, days: i32) -> Result<Vec<IndicatorAnomaly>> {
        sqlx::query_as::<_, IndicatorAnomaly>(
            "SELECT id::bigint AS id, dataset_id, date, value, z_score, threshold, anomaly_type, created_at \
             FROM indicator_anomalies WHERE dataset_id = $1 AND date >= CURRENT_DATE - $2 \
             ORDER BY ABS(z_score) DESC",
        )
        .bind(dataset_id)
        .bind(days)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn compute_and_store_anomalies(&self, dataset_id: i64, threshold: f64) -> Result<Vec<IndicatorAnomaly>> {
        let points = sqlx::query_as::<_, crate::models::DataPoint>(
            "SELECT id::bigint AS id, dataset_id, date, value, created_at FROM data_points WHERE dataset_id = $1 ORDER BY date DESC LIMIT 100",
        )
        .bind(dataset_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        if points.len() < 10 {
            return Ok(Vec::new());
        }

        let values: Vec<f64> = points.iter().map(|p| p.value).collect();
        let mean = values.iter().sum::<f64>() / values.len() as f64;
        let variance = values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / values.len() as f64;
        let std = variance.sqrt();

        if std == 0.0 {
            return Ok(Vec::new());
        }

        let mut anomalies = Vec::new();
        for point in points.iter().take(20) {
            let z_score = (point.value - mean) / std;
            if z_score.abs() >= threshold {
                let anomaly_type = if z_score > 0.0 { "spike" } else { "drop" };
                let anomaly = self.create_anomaly(dataset_id, point.date, point.value, z_score, anomaly_type).await?;
                anomalies.push(anomaly);
            }
        }

        Ok(anomalies)
    }

    async fn get_anomaly(&self, id: i64) -> Result<Option<IndicatorAnomaly>> {
        sqlx::query_as::<_, IndicatorAnomaly>(
            "SELECT id::bigint AS id, dataset_id, date, value, z_score, threshold, anomaly_type, created_at \
             FROM indicator_anomalies WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }
}
