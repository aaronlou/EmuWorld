use axum::{extract::State, routing::{get, post, delete}, Json, Router};
use std::sync::Arc;

use crate::{api::errors::ApiResult, bootstrap::app_state::AppState, repo::CreateDataset};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/datasets", get(list_datasets))
        .route("/datasets", post(add_dataset))
        .route("/datasets/{id}", delete(delete_dataset))
        .route("/datasets/{id}/points", get(get_data_points))
}

async fn list_datasets(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Vec<crate::models::Dataset>> {
    Ok(Json(state.repo.list_datasets().await?))
}

async fn add_dataset(
    State(state): State<Arc<AppState>>,
    Json(dataset): Json<CreateDataset>,
) -> ApiResult<crate::models::Dataset> {
    Ok(Json(state.repo.create_dataset(&dataset).await?))
}

async fn delete_dataset(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> ApiResult<()> {
    state.repo.delete_dataset(id).await?;
    Ok(Json(()))
}

async fn get_data_points(
    State(state): State<Arc<AppState>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> ApiResult<Vec<crate::models::DataPoint>> {
    Ok(Json(state.repo.data_points(id).await?))
}
