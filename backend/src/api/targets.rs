use axum::{extract::State, routing::{get, post}, Json, Router};
use std::sync::Arc;

use crate::{api::errors::{ApiError, ApiResult}, bootstrap::app_state::AppState, models::{CreateTargetRequest, PredictionTarget}};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/targets", get(list_targets))
        .route("/targets", post(create_target))
        .route("/targets/{id}", get(get_target))
        .route("/targets/list", get(list_targets))
}

async fn list_targets(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Vec<PredictionTarget>> {
    Ok(Json(state.repo.list_targets().await?))
}

async fn create_target(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateTargetRequest>,
) -> ApiResult<PredictionTarget> {
    Ok(Json(state.repo.create_target(&req).await?))
}

async fn get_target(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> ApiResult<PredictionTarget> {
    let target = state
        .repo
        .get_target(id)
        .await?
        .ok_or_else(|| ApiError::new(axum::http::StatusCode::NOT_FOUND, "Target not found"))?;

    Ok(Json(target))
}
