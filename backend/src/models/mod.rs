use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct Dataset {
    pub id: i64,
    pub name: String,
    pub source: String,
    pub category: String,
    pub fred_code: Option<String>,
    pub description: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
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
    pub outcome: String,
    pub probability: f64,
    pub confidence_lower: f64,
    pub confidence_upper: f64,
    pub model_version: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTargetRequest {
    pub question: String,
    pub category: String,
    pub horizon_days: i32,
    pub outcomes: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct PredictionResponse {
    pub target: PredictionTarget,
    pub predictions: Vec<Prediction>,
    pub generated_at: DateTime<Utc>,
}
