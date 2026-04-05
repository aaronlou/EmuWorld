use axum::{
    extract::{Path, State},
    routing::{get, post, delete, put},
    Json, Router,
};
use std::sync::Arc;

use crate::bootstrap::app_state::AppState;
use crate::api::errors::{ApiError, ApiResult};
use crate::models::{CreateHypothesisRequest, Hypothesis, UpdateHypothesisRequest};
use crate::repo::CreateHypothesis;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/hypotheses", get(list_hypotheses))
        .route("/hypotheses", post(create_hypothesis))
        .route("/hypotheses/{id}", get(get_hypothesis))
        .route("/hypotheses/{id}", put(update_hypothesis))
        .route("/hypotheses/{id}", delete(delete_hypothesis))
        .route("/hypotheses/status/{status}", get(list_hypotheses_by_status))
}

async fn list_hypotheses(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Vec<Hypothesis>> {
    let hypotheses = state.repo.list_hypotheses().await.map_err(ApiError::repo)?;
    Ok(Json(hypotheses))
}

async fn get_hypothesis(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<Hypothesis> {
    let hypothesis = state
        .repo
        .get_hypothesis(id)
        .await
        .map_err(ApiError::repo)?
        .ok_or_else(|| ApiError::not_found(format!("Hypothesis {} not found", id)))?;
    Ok(Json(hypothesis))
}

async fn create_hypothesis(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateHypothesisRequest>,
) -> ApiResult<Hypothesis> {
    let create = CreateHypothesis {
        content: req.content,
        confidence: req.confidence,
    };

    let hypothesis = state
        .repo
        .create_hypothesis(&create)
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(hypothesis))
}

async fn update_hypothesis(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(req): Json<UpdateHypothesisRequest>,
) -> ApiResult<Hypothesis> {
    let hypothesis = state
        .repo
        .update_hypothesis(
            id,
            req.status.as_deref(),
            req.confidence,
            req.resolution_note.as_deref().unwrap_or(""),
        )
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(hypothesis))
}

async fn delete_hypothesis(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<()> {
    state
        .repo
        .delete_hypothesis(id)
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(()))
}

async fn list_hypotheses_by_status(
    State(state): State<Arc<AppState>>,
    Path(status): Path<String>,
) -> ApiResult<Vec<Hypothesis>> {
    let hypotheses = state
        .repo
        .list_hypotheses_by_status(&status)
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(hypotheses))
}
