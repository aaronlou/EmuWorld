use axum::{extract::{State, Path}, routing::{get, post, put, delete}, Json, Router};
use std::sync::Arc;

use crate::repo::{AppRepo, CreateDataSource, UpdateDataSource};

pub fn router() -> Router<Arc<dyn AppRepo>> {
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
    State(repo): State<Arc<dyn AppRepo>>,
) -> Result<Json<Vec<crate::models::DataSource>>, (axum::http::StatusCode, String)> {
    repo.list_sources().await
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn add_source(
    State(repo): State<Arc<dyn AppRepo>>,
    Json(body): Json<CreateDataSource>,
) -> Result<Json<crate::models::DataSource>, (axum::http::StatusCode, String)> {
    repo.create_source(&body).await
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn get_source(
    State(repo): State<Arc<dyn AppRepo>>,
    Path(id): Path<i64>,
) -> Result<Json<crate::models::DataSource>, (axum::http::StatusCode, String)> {
    match repo.get_source(id).await {
        Ok(Some(s)) => Ok(Json(s)),
        Ok(None) => Err((axum::http::StatusCode::NOT_FOUND, "Source not found".into())),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

async fn update_source(
    State(repo): State<Arc<dyn AppRepo>>,
    Path(id): Path<i64>,
    Json(body): Json<UpdateDataSource>,
) -> Result<Json<crate::models::DataSource>, (axum::http::StatusCode, String)> {
    repo.update_source(id, &body).await
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

async fn delete_source(
    State(repo): State<Arc<dyn AppRepo>>,
    Path(id): Path<i64>,
) -> Result<Json<()>, (axum::http::StatusCode, String)> {
    repo.delete_source(id).await
        .map(|_| Json(()))
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}

#[derive(serde::Serialize)]
struct SyncResponse {
    source: String,
    datasets_added: usize,
    data_points_synced: usize,
}

async fn sync_source(
    State(repo): State<Arc<dyn AppRepo>>,
    Path(id): Path<i64>,
) -> Result<Json<SyncResponse>, (axum::http::StatusCode, String)> {
    let source = repo.get_source(id).await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((axum::http::StatusCode::NOT_FOUND, "Source not found".into()))?;

    if !source.enabled {
        return Err((axum::http::StatusCode::BAD_REQUEST, "Source is disabled".into()));
    }

    let adapter = crate::ingest::build_adapter(&source.name, source.api_base_url.clone(), source.api_key.clone())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let mut datasets_added = 0;
    let mut data_points_synced = 0;

    for (ext_id, name, category) in adapter.default_datasets() {
        let (dataset_id, is_new) = repo.upsert_or_create_dataset(
            name,
            adapter.name(),
            category,
            ext_id,
            &format!("{} - {}", source.display_name, name),
        ).await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        if is_new {
            datasets_added += 1;
        }

        match adapter.fetch_series(ext_id).await {
            Ok(observations) => {
                for obs in observations {
                    let _ = repo.upsert_data_point(&crate::repo::CreateDataPoint {
                        dataset_id,
                        date: obs.date,
                        value: obs.value,
                    }).await;
                    data_points_synced += 1;
                }
            }
            Err(e) => {
                tracing::warn!("Failed to fetch series {} from {}: {}", ext_id, adapter.name(), e);
            }
        }
    }

    Ok(Json(SyncResponse {
        source: source.display_name,
        datasets_added,
        data_points_synced,
    }))
}

async fn get_source_datasets(
    State(repo): State<Arc<dyn AppRepo>>,
    Path(id): Path<i64>,
) -> Result<Json<Vec<crate::models::Dataset>>, (axum::http::StatusCode, String)> {
    let source = repo.get_source(id).await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or((axum::http::StatusCode::NOT_FOUND, "Source not found".into()))?;

    repo.datasets_by_source(&source.name).await
        .map(Json)
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))
}


