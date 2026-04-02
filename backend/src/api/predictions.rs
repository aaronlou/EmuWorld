use axum::{extract::State, routing::{get, post}, Json, Router};
use std::sync::Arc;

use crate::models::{CreateTargetRequest, PredictionResponse, PredictionTarget};
use crate::repo::AppRepo;

pub fn router() -> Router<Arc<dyn AppRepo>> {
    Router::new()
        .route("/targets", get(list_targets))
        .route("/targets", post(create_target))
        .route("/targets/{id}/predict", post(generate_prediction))
        .route("/targets/{id}/predictions", get(get_predictions))
}

pub async fn list_targets(
    State(repo): State<Arc<dyn AppRepo>>,
) -> Json<Vec<PredictionTarget>> {
    match repo.list_targets().await {
        Ok(targets) => Json(targets),
        Err(_) => Json(vec![]),
    }
}

async fn create_target(
    State(repo): State<Arc<dyn AppRepo>>,
    Json(req): Json<CreateTargetRequest>,
) -> Result<Json<PredictionTarget>, (axum::http::StatusCode, String)> {
    match repo.create_target(&req).await {
        Ok(target) => Ok(Json(target)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

async fn generate_prediction(
    State(repo): State<Arc<dyn AppRepo>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Result<Json<PredictionResponse>, (axum::http::StatusCode, String)> {
    let ai_service_url = std::env::var("AI_SERVICE_URL").unwrap_or_else(|_| "http://localhost:9000".to_string());

    match repo.generate(id, &ai_service_url).await {
        Ok(response) => Ok(Json(response)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

pub async fn get_predictions(
    State(repo): State<Arc<dyn AppRepo>>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Json<Vec<crate::models::Prediction>> {
    match repo.list_by_target(id).await {
        Ok(predictions) => Json(predictions),
        Err(_) => Json(vec![]),
    }
}
