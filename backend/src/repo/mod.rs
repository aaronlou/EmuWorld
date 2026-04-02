use async_trait::async_trait;
use serde::Deserialize;
use sqlx::{Pool, Postgres, Sqlite};
use thiserror::Error;

use crate::models::{CreateTargetRequest, DataPoint, Dataset, DataSource, Prediction, PredictionResponse, PredictionTarget};

pub mod postgres;
pub mod sqlite;

/// Database-agnostic pool wrapper
#[derive(Clone)]
pub enum DatabasePool {
    Sqlite(Pool<Sqlite>),
    Postgres(Pool<Postgres>),
}

impl DatabasePool {
    pub fn is_postgres(&self) -> bool {
        matches!(self, Self::Postgres(_))
    }

    pub fn is_sqlite(&self) -> bool {
        matches!(self, Self::Sqlite(_))
    }
}

impl From<Pool<Sqlite>> for DatabasePool {
    fn from(pool: Pool<Sqlite>) -> Self {
        Self::Sqlite(pool)
    }
}

impl From<Pool<Postgres>> for DatabasePool {
    fn from(pool: Pool<Postgres>) -> Self {
        Self::Postgres(pool)
    }
}

#[derive(Debug, Error)]
pub enum RepoError {
    #[error("database error: {0}")]
    Database(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("validation error: {0}")]
    Validation(String),
    #[error("external service error: {0}")]
    ExternalService(String),
}

pub type Result<T> = std::result::Result<T, RepoError>;

#[derive(Debug, Deserialize)]
pub struct CreateDataset {
    pub name: String,
    pub source: String,
    pub category: String,
    pub external_id: Option<String>,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDataset {
    pub name: Option<String>,
    pub category: Option<String>,
    pub external_id: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDataSource {
    pub name: String,
    pub display_name: String,
    pub api_base_url: String,
    pub api_key: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDataSource {
    pub display_name: Option<String>,
    pub api_base_url: Option<String>,
    pub api_key: Option<String>,
    pub description: Option<String>,
    pub enabled: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDataPoint {
    pub dataset_id: i64,
    pub date: chrono::NaiveDate,
    pub value: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreatePrediction {
    pub target_id: i64,
    pub outcome: String,
    pub probability: f64,
    pub confidence_lower: f64,
    pub confidence_upper: f64,
}

#[async_trait]
pub trait DatasetRepo: Send + Sync {
    async fn list_datasets(&self) -> Result<Vec<Dataset>>;
    async fn get_dataset(&self, id: i64) -> Result<Option<Dataset>>;
    async fn create_dataset(&self, dataset: &CreateDataset) -> Result<Dataset>;
    async fn data_points(&self, dataset_id: i64) -> Result<Vec<DataPoint>>;
    async fn upsert_data_point(&self, point: &CreateDataPoint) -> Result<usize>;
}

#[async_trait]
pub trait TargetRepo: Send + Sync {
    async fn list_targets(&self) -> Result<Vec<PredictionTarget>>;
    async fn get_target(&self, id: i64) -> Result<Option<PredictionTarget>>;
    async fn create_target(&self, req: &CreateTargetRequest) -> Result<PredictionTarget>;
}

#[async_trait]
pub trait PredictionRepo: Send + Sync {
    async fn list_by_target(&self, target_id: i64) -> Result<Vec<Prediction>>;
    async fn create_batch(&self, target_id: i64, predictions: &[CreatePrediction]) -> Result<()>;
    async fn generate(
        &self,
        target_id: i64,
        ai_service_url: &str,
    ) -> Result<PredictionResponse>;
}

pub trait AppRepo: DatasetRepo + TargetRepo + PredictionRepo + DataSourceRepo {
    fn pool(&self) -> &DatabasePool;
}

#[async_trait]
pub trait DataSourceRepo: Send + Sync {
    async fn list_sources(&self) -> Result<Vec<DataSource>>;
    async fn get_source(&self, id: i64) -> Result<Option<DataSource>>;
    async fn get_source_by_name(&self, name: &str) -> Result<Option<DataSource>>;
    async fn create_source(&self, source: &CreateDataSource) -> Result<DataSource>;
    async fn update_source(&self, id: i64, updates: &UpdateDataSource) -> Result<DataSource>;
    async fn delete_source(&self, id: i64) -> Result<()>;
}
