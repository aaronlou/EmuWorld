use axum::{
    extract::{Path, State},
    routing::{get, post, delete},
    Json, Router,
};
use std::sync::Arc;

use crate::bootstrap::app_state::AppState;
use crate::api::errors::{ApiError, ApiResult};
use crate::models::{CreateEventRequest, Event};
use crate::repo::CreateEvent;

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/events", get(list_events))
        .route("/events", post(create_event))
        .route("/events/{id}", get(get_event))
        .route("/events/{id}", delete(delete_event))
        .route("/events/category/{category}", get(list_events_by_category))
        .route("/events/range/{start}/{end}", get(list_events_in_range))
}

async fn list_events(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Vec<Event>> {
    let events = state.repo.list_events().await.map_err(ApiError::repo)?;
    Ok(Json(events))
}

async fn get_event(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<Event> {
    let event = state
        .repo
        .get_event(id)
        .await
        .map_err(ApiError::repo)?
        .ok_or_else(|| ApiError::not_found(format!("Event {} not found", id)))?;
    Ok(Json(event))
}

async fn create_event(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateEventRequest>,
) -> ApiResult<Event> {
    let date = chrono::NaiveDate::parse_from_str(&req.date, "%Y-%m-%d")
        .map_err(|e| ApiError::validation(format!("Invalid date format: {}", e)))?;

    let create = CreateEvent {
        title: req.title,
        date,
        category: req.category,
        description: req.description,
        tags: req.tags,
        source: req.source,
        impact_score: req.impact_score,
    };

    let event = state
        .repo
        .create_event(&create)
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(event))
}

async fn delete_event(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<()> {
    state
        .repo
        .delete_event(id)
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(()))
}

async fn list_events_by_category(
    State(state): State<Arc<AppState>>,
    Path(category): Path<String>,
) -> ApiResult<Vec<Event>> {
    let events = state
        .repo
        .list_events_by_category(&category)
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(events))
}

async fn list_events_in_range(
    State(state): State<Arc<AppState>>,
    Path((start, end)): Path<(String, String)>,
) -> ApiResult<Vec<Event>> {
    let start = chrono::NaiveDate::parse_from_str(&start, "%Y-%m-%d")
        .map_err(|e| ApiError::validation(format!("Invalid start date: {}", e)))?;
    let end = chrono::NaiveDate::parse_from_str(&end, "%Y-%m-%d")
        .map_err(|e| ApiError::validation(format!("Invalid end date: {}", e)))?;

    let events = state
        .repo
        .list_events_in_range(start, end)
        .await
        .map_err(ApiError::repo)?;
    Ok(Json(events))
}