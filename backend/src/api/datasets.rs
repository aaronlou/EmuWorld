use axum::{extract::State, routing::{get, post}, Json, Router};
use std::sync::Arc;

use crate::repo::{AppRepo, CreateDataset};

pub fn router() -> Router<Arc<dyn AppRepo>> {
    Router::new()
        .route("/datasets", get(list_datasets))
        .route("/datasets", post(add_dataset))
        .route("/datasets/{id}/points", get(get_data_points))
}

async fn list_datasets(
    State(repo): State<Arc<dyn AppRepo>>,
) -> Json<Vec<crate::models::Dataset>> {
    match repo.list_datasets().await {
        Ok(datasets) => Json(datasets),
        Err(_) => Json(vec![]),
    }
}

async fn add_dataset(
    State(repo): State<Arc<dyn AppRepo>>,
    Json(dataset): Json<serde_json::Value>,
) -> Result<Json<crate::models::Dataset>, (axum::http::StatusCode, String)> {
    let create = CreateDataset {
        name: dataset["name"].as_str().unwrap_or("").to_string(),
        source: dataset["source"].as_str().unwrap_or("").to_string(),
        category: dataset["category"].as_str().unwrap_or("").to_string(),
        external_id: dataset.get("external_id").and_then(|v| v.as_str()).map(String::from),
        description: dataset["description"].as_str().unwrap_or("").to_string(),
    };

    match repo.create_dataset(&create).await {
        Ok(d) => Ok(Json(d)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

async fn get_data_points(
    State(repo): State<Arc<dyn AppRepo>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Json<Vec<crate::models::DataPoint>> {
    match repo.data_points(id).await {
        Ok(points) => Json(points),
        Err(_) => Json(vec![]),
    }
}
