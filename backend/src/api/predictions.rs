use axum::{extract::State, routing::{get, post}, Json, Router};
use std::sync::Arc;

use crate::{api::errors::ApiResult, bootstrap::app_state::AppState, models::{PredictionResponse, PredictionRunDetail}};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/prediction-runs/latest", get(list_latest_prediction_runs))
        .route("/targets/{id}/predict", post(generate_prediction))
        .route("/targets/{id}/predictions", get(get_predictions))
        .route("/targets/{id}/runs", get(list_prediction_runs))
        .route("/prediction-runs/{id}", get(get_prediction_run))
}

async fn generate_prediction(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> ApiResult<PredictionResponse> {
    Ok(Json(state.prediction_service.generate_prediction(id).await?))
}

pub async fn get_predictions(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> ApiResult<Vec<crate::models::Prediction>> {
    Ok(Json(state.repo.list_by_target(id).await?))
}

async fn list_prediction_runs(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> ApiResult<Vec<crate::models::PredictionRun>> {
    Ok(Json(state.repo.list_runs_by_target(id).await?))
}

async fn list_latest_prediction_runs(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Vec<crate::models::PredictionRun>> {
    Ok(Json(state.repo.list_latest_runs().await?))
}

async fn get_prediction_run(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> ApiResult<PredictionRunDetail> {
    let run = state
        .repo
        .get_run(id)
        .await?
        .ok_or_else(|| crate::api::errors::ApiError::new(axum::http::StatusCode::NOT_FOUND, "Run not found"))?;

    let predictions = state.repo.list_by_run(id).await?;

    Ok(Json(PredictionRunDetail { run, predictions }))
}
