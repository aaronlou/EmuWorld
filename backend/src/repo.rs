use async_trait::async_trait;
use serde::Deserialize;
use sqlx::PgPool;
use thiserror::Error;

use crate::models::{ChatMessageRecord, ChatSession, CreateTargetRequest, DataPoint, Dataset, DataSource, Prediction, PredictionRun, PredictionTarget};

pub mod postgres;

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
    pub run_id: i64,
    pub outcome: String,
    pub probability: f64,
    pub confidence_lower: f64,
    pub confidence_upper: f64,
}

#[derive(Debug)]
pub struct CreatePredictionRun {
    pub target_id: i64,
    pub status: String,
    pub model_version: String,
    pub input_snapshot: String,
}

#[derive(Debug)]
pub struct CreateChatSession {
    pub title: String,
}

#[derive(Debug)]
pub struct CreateChatMessage {
    pub session_id: i64,
    pub role: String,
    pub content: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub used_fallback: bool,
}

#[async_trait]
pub trait DatasetRepo: Send + Sync {
    async fn list_datasets(&self) -> Result<Vec<Dataset>>;
    async fn create_dataset(&self, dataset: &CreateDataset) -> Result<Dataset>;
    async fn delete_dataset(&self, id: i64) -> Result<()>;
    async fn data_points(&self, dataset_id: i64) -> Result<Vec<DataPoint>>;
    async fn upsert_data_point(&self, point: &CreateDataPoint) -> Result<usize>;
    async fn upsert_or_create_dataset(&self, name: &str, source: &str, category: &str, external_id: &str, description: &str) -> Result<(i64, bool)>;
    async fn datasets_by_source(&self, source_name: &str) -> Result<Vec<Dataset>>;
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
    async fn list_by_run(&self, run_id: i64) -> Result<Vec<Prediction>>;
    async fn list_runs_by_target(&self, target_id: i64) -> Result<Vec<PredictionRun>>;
    async fn list_latest_runs(&self) -> Result<Vec<PredictionRun>>;
    async fn get_run(&self, run_id: i64) -> Result<Option<PredictionRun>>;
    async fn create_run(&self, run: &CreatePredictionRun) -> Result<PredictionRun>;
    async fn mark_run_completed(&self, run_id: i64) -> Result<PredictionRun>;
    async fn mark_run_failed(&self, run_id: i64, error_message: &str) -> Result<PredictionRun>;
    async fn create_batch(&self, target_id: i64, predictions: &[CreatePrediction]) -> Result<()>;
}

#[async_trait]
pub trait DataSourceRepo: Send + Sync {
    async fn list_sources(&self) -> Result<Vec<DataSource>>;
    async fn get_source(&self, id: i64) -> Result<Option<DataSource>>;
    async fn create_source(&self, source: &CreateDataSource) -> Result<DataSource>;
    async fn update_source(&self, id: i64, updates: &UpdateDataSource) -> Result<DataSource>;
    async fn delete_source(&self, id: i64) -> Result<()>;
}

#[async_trait]
pub trait ChatRepo: Send + Sync {
    async fn create_chat_session(&self, session: &CreateChatSession) -> Result<ChatSession>;
    async fn get_chat_session(&self, id: i64) -> Result<Option<ChatSession>>;
    async fn list_chat_messages(&self, session_id: i64) -> Result<Vec<ChatMessageRecord>>;
    async fn create_chat_message(&self, message: &CreateChatMessage) -> Result<ChatMessageRecord>;
    async fn touch_chat_session(&self, session_id: i64) -> Result<()>;
}

pub trait AppRepo: DatasetRepo + TargetRepo + PredictionRepo + DataSourceRepo + ChatRepo {}

pub async fn init_pool(db_url: &str) -> Result<PgPool> {
    sqlx::PgPool::connect(db_url)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
}
