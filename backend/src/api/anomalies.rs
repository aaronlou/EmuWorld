use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::{
    api::errors::ApiResult,
    bootstrap::app_state::AppState,
    models::AnomalyQuery,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/anomalies", get(list_anomalies))
        .route("/anomalies/compute", post(compute_anomalies))
        .route("/anomalies/summary", get(anomaly_summary))
}

async fn list_anomalies(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AnomalyQuery>,
) -> ApiResult<Vec<crate::models::IndicatorAnomaly>> {
    Ok(Json(state.repo.list_anomalies(&query).await?))
}

async fn compute_anomalies(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ComputeAnomalyRequest>,
) -> ApiResult<Vec<crate::models::IndicatorAnomaly>> {
    Ok(Json(state.repo.compute_and_store_anomalies(body.dataset_id, body.threshold.unwrap_or(2.0)).await?))
}

async fn anomaly_summary(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Vec<crate::models::AnomalySummary>> {
    let datasets = state.repo.list_datasets().await?;
    let mut summaries = Vec::new();

    for ds in datasets {
        let anomalies = state.repo.get_latest_anomalies(ds.id, 30).await?;
        if let Some(latest) = anomalies.first() {
            let trend = if latest.z_score > 0.0 { "up".to_string() } else { "down".to_string() };
            summaries.push(crate::models::AnomalySummary {
                dataset_id: ds.id,
                dataset_name: ds.name,
                latest_value: latest.value,
                latest_z_score: latest.z_score,
                anomaly_count_30d: anomalies.len() as i32,
                trend,
            });
        }
    }

    summaries.sort_by(|a, b| b.latest_z_score.abs().partial_cmp(&a.latest_z_score.abs()).unwrap());
    Ok(Json(summaries))
}

#[derive(serde::Deserialize)]
struct ComputeAnomalyRequest {
    dataset_id: i64,
    threshold: Option<f64>,
}
