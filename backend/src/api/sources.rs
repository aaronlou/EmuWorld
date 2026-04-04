use axum::{extract::{State, Path}, routing::{get, post, put, delete}, Json, Router};
use std::sync::Arc;

use crate::{api::errors::{ApiError, ApiResult}, application::source_sync_service::SourceSyncResult, bootstrap::app_state::AppState, repo::{CreateDataSource, UpdateDataSource}};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/sources", get(list_sources))
        .route("/sources", post(add_source))
        .route("/sources/{id}", get(get_source))
        .route("/sources/{id}", put(update_source))
        .route("/sources/{id}", delete(delete_source))
        .route("/sources/{id}/sync", post(sync_source))
        .route("/sources/{id}/datasets", get(get_source_datasets))
}

async fn list_sources(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Vec<crate::models::DataSource>> {
    Ok(Json(state.repo.list_sources().await?))
}

async fn add_source(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateDataSource>,
) -> ApiResult<crate::models::DataSource> {
    Ok(Json(state.repo.create_source(&body).await?))
}

async fn get_source(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<crate::models::DataSource> {
    let source = state
        .repo
        .get_source(id)
        .await?
        .ok_or_else(|| ApiError::new(axum::http::StatusCode::NOT_FOUND, "Source not found"))?;
    Ok(Json(source))
}

async fn update_source(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateDataSource>,
) -> ApiResult<crate::models::DataSource> {
    Ok(Json(state.repo.update_source(id, &body).await?))
}

async fn delete_source(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<()> {
    state.repo.delete_source(id).await?;
    Ok(Json(()))
}

async fn sync_source(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<SourceSyncResult> {
    Ok(Json(state.source_sync_service.sync_source(id).await?))
}

async fn get_source_datasets(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<Vec<crate::models::Dataset>> {
    let source = state
        .repo
        .get_source(id)
        .await?
        .ok_or_else(|| ApiError::new(axum::http::StatusCode::NOT_FOUND, "Source not found"))?;

    Ok(Json(state.repo.datasets_by_source(&source.name).await?))
}
