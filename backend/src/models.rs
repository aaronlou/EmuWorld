use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Dataset {
    pub id: i64,
    pub name: String,
    pub source: String,
    pub category: String,
    pub external_id: Option<String>,
    pub description: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DataSource {
    pub id: i64,
    pub name: String,
    pub display_name: String,
    pub api_base_url: String,
    pub api_key: String,
    pub description: String,
    pub enabled: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DataPoint {
    pub id: i64,
    pub dataset_id: i64,
    pub date: chrono::NaiveDate,
    pub value: f64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct PredictionTarget {
    pub id: i64,
    pub question: String,
    pub category: String,
    pub horizon_days: i32,
    pub outcomes: String,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Prediction {
    pub id: i64,
    pub target_id: i64,
    pub run_id: Option<i64>,
    pub outcome: String,
    pub probability: f64,
    pub confidence_lower: f64,
    pub confidence_upper: f64,
    pub model_version: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct PredictionRun {
    pub id: i64,
    pub target_id: i64,
    pub status: String,
    pub model_version: String,
    pub input_snapshot: String,
    pub error_message: Option<String>,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub finished_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct PredictionRunDetail {
    pub run: PredictionRun,
    pub predictions: Vec<Prediction>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTargetRequest {
    pub question: String,
    pub category: String,
    pub horizon_days: i32,
    pub outcomes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PredictionTaskResponse {
    pub run_id: i64,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct PredictionResponse {
    pub target: PredictionTarget,
    pub run: PredictionRun,
    pub predictions: Vec<Prediction>,
    pub generated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatDatasetContext {
    pub id: i64,
    pub name: String,
    pub source: String,
    pub category: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatTargetContext {
    pub id: i64,
    pub question: String,
    pub category: String,
    pub horizon_days: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChatPredictionContext {
    pub run_id: Option<i64>,
    pub status: Option<String>,
    pub model_version: Option<String>,
    pub top_outcome: Option<String>,
    pub top_probability: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
pub struct ChatContext {
    #[serde(default)]
    pub page: String,
    #[serde(default)]
    pub datasets_count: usize,
    #[serde(default)]
    pub targets_count: usize,
    #[serde(default)]
    pub predictions_count: usize,
    #[serde(default)]
    pub dataset_catalog: Vec<String>,
    #[serde(default)]
    pub target_catalog: Vec<String>,
    #[serde(default)]
    pub prediction_catalog: Vec<String>,
    #[serde(default)]
    pub dataset_series_summary: Vec<String>,
    #[serde(default)]
    pub target_outcomes: Vec<String>,
    #[serde(default)]
    pub prediction_distribution: Vec<String>,
    #[serde(default)]
    pub dataset: Option<ChatDatasetContext>,
    #[serde(default)]
    pub target: Option<ChatTargetContext>,
    #[serde(default)]
    pub prediction: Option<ChatPredictionContext>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatRequest {
    #[serde(default)]
    pub session_id: Option<i64>,
    #[serde(default)]
    pub message: String,
    #[serde(default)]
    pub context: ChatContext,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ChatResponse {
    pub session_id: Option<i64>,
    pub answer: String,
    pub suggested_prompts: Vec<String>,
    pub provider: String,
    pub model: String,
    pub used_fallback: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct ChatSession {
    pub id: i64,
    pub title: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct ChatMessageRecord {
    pub id: i64,
    pub session_id: i64,
    pub role: String,
    pub content: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub used_fallback: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct CreateChatSessionRequest {
    #[serde(default)]
    pub title: Option<String>,
}

// ==================== News Models ====================

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct NewsArticle {
    pub id: i64,
    pub source_name: String,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub author: Option<String>,
    pub published_at: chrono::NaiveDateTime,
    pub category: Option<String>,
    pub language: String,
    pub country: String,
    pub fetched_at: chrono::DateTime<Utc>,
    pub sentiment_score: Option<f64>,
    pub entities: Option<serde_json::Value>,
    pub processed_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug, Deserialize)]
pub struct CreateNewsArticleRequest {
    pub source_name: String,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub author: Option<String>,
    pub published_at: chrono::NaiveDateTime,
    pub category: Option<String>,
    pub language: Option<String>,
    pub country: Option<String>,
    pub sentiment_score: Option<f64>,
    pub entities: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewsQuery {
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub from_date: Option<String>,
    #[serde(default)]
    pub to_date: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i32,
    #[serde(default)]
    pub offset: i32,
    #[serde(default)]
    pub min_sentiment: Option<f64>,
    #[serde(default)]
    pub max_sentiment: Option<f64>,
}

fn default_limit() -> i32 {
    50
}

// ==================== Anomaly Models ====================

#[derive(Debug, Serialize, Deserialize, Clone, sqlx::FromRow)]
pub struct IndicatorAnomaly {
    pub id: i64,
    pub dataset_id: i64,
    pub date: chrono::NaiveDate,
    pub value: f64,
    pub z_score: f64,
    pub threshold: f64,
    pub anomaly_type: String,
    pub created_at: chrono::DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnomalyQuery {
    #[serde(default)]
    pub dataset_id: Option<i64>,
    #[serde(default)]
    pub min_z_score: Option<f64>,
    #[serde(default)]
    pub from_date: Option<String>,
    #[serde(default)]
    pub to_date: Option<String>,
    #[serde(default = "default_limit")]
    pub limit: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AnomalySummary {
    pub dataset_id: i64,
    pub dataset_name: String,
    pub latest_value: f64,
    pub latest_z_score: f64,
    pub anomaly_count_30d: i32,
    pub trend: String,
}
