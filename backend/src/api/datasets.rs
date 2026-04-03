use axum::{extract::State, routing::{get, post, delete}, Json, Router};
use std::sync::Arc;

use crate::repo::{AppRepo, CreateDataset};

pub fn router() -> Router<Arc<dyn AppRepo>> {
    Router::new()
        .route("/datasets", get(list_datasets))
        .route("/datasets", post(add_dataset))
        .route("/datasets/{id}", delete(delete_dataset))
        .route("/datasets/{id}/points", get(get_data_points))
}

async fn list_datasets(
    State(repo): State<Arc<dyn AppRepo>>,
) -> Result<Json<Vec<crate::models::Dataset>>, (axum::http::StatusCode, String)> {
    repo.list_datasets().await
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn add_dataset(
    State(repo): State<Arc<dyn AppRepo>>,
    Json(dataset): Json<CreateDataset>,
) -> Result<Json<crate::models::Dataset>, (axum::http::StatusCode, String)> {
    repo.create_dataset(&dataset).await
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn delete_dataset(
    State(repo): State<Arc<dyn AppRepo>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<Json<()>, (axum::http::StatusCode, String)> {
    repo.delete_dataset(id).await
        .map(|_| Json(()))
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn get_data_points(
    State(repo): State<Arc<dyn AppRepo>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<Json<Vec<crate::models::DataPoint>>, (axum::http::StatusCode, String)> {
    repo.data_points(id).await
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}
