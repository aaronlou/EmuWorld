use axum::{extract::{State, Path}, routing::{get, post, put, delete}, Json, Router};
use sqlx::Row;
use std::sync::Arc;

use crate::repo::{AppRepo, CreateDataSource, DatabasePool, UpdateDataSource};

pub fn router() -> Router<Arc<dyn AppRepo>> {
    Router::new()
        .route("/sources", get(list_sources))
        .route("/sources", post(add_source))
        .route("/sources/{id}", get(get_source))
        .route("/sources/{id}", put(update_source))
        .route("/sources/{id}", delete(delete_source))
        .route("/sources/{id}/sync", post(sync_source))
        .route("/sources/{id}/datasets", get(get_source_datasets))
        .route("/datasets/{id}", delete(delete_dataset))
}

async fn list_sources(
    State(repo): State<Arc<dyn AppRepo>>,
) -> Json<Vec<crate::models::DataSource>> {
    match repo.list_sources().await {
        Ok(sources) => Json(sources),
        Err(_) => Json(vec![]),
    }
}

async fn add_source(
    State(repo): State<Arc<dyn AppRepo>>,
    Json(body): Json<serde_json::Value>,
) -> Result<Json<crate::models::DataSource>, (axum::http::StatusCode, String)> {
    let source = CreateDataSource {
        name: body["name"].as_str().unwrap_or("").to_string(),
        display_name: body["display_name"].as_str().unwrap_or("").to_string(),
        api_base_url: body["api_base_url"].as_str().unwrap_or("").to_string(),
        api_key: body["api_key"].as_str().unwrap_or("").to_string(),
        description: body["description"].as_str().unwrap_or("").to_string(),
    };
    match repo.create_source(&source).await {
        Ok(s) => Ok(Json(s)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
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
    Json(body): Json<serde_json::Value>,
) -> Result<Json<crate::models::DataSource>, (axum::http::StatusCode, String)> {
    let updates = UpdateDataSource {
        display_name: body.get("display_name").and_then(|v| v.as_str()).map(String::from),
        api_base_url: body.get("api_base_url").and_then(|v| v.as_str()).map(String::from),
        api_key: body.get("api_key").and_then(|v| v.as_str()).map(String::from),
        description: body.get("description").and_then(|v| v.as_str()).map(String::from),
        enabled: body.get("enabled").and_then(|v| v.as_bool()),
    };
    match repo.update_source(id, &updates).await {
        Ok(s) => Ok(Json(s)),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
}

async fn delete_source(
    State(repo): State<Arc<dyn AppRepo>>,
    Path(id): Path<i64>,
) -> Result<Json<()>, (axum::http::StatusCode, String)> {
    match repo.delete_source(id).await {
        Ok(()) => Ok(Json(())),
        Err(e) => Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    }
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
    let source = match repo.get_source(id).await {
        Ok(Some(s)) => s,
        Ok(None) => return Err((axum::http::StatusCode::NOT_FOUND, "Source not found".into())),
        Err(e) => return Err((axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string())),
    };

    if !source.enabled {
        return Err((axum::http::StatusCode::BAD_REQUEST, "Source is disabled".into()));
    }

    let adapter = crate::ingest::build_adapter(&source.name, source.api_base_url.clone(), source.api_key.clone())
        .map_err(|e| (axum::http::StatusCode::BAD_REQUEST, e.to_string()))?;

    let pool = repo.pool();

    let mut datasets_added = 0;
    let mut data_points_synced = 0;

    for (ext_id, name, category) in adapter.default_datasets() {
        let dataset_id = match pool {
            DatabasePool::Sqlite(pool) => {
                let existing = sqlx::query("SELECT id FROM datasets WHERE source = ? AND external_id = ?")
                    .bind(adapter.name())
                    .bind(ext_id)
                    .fetch_optional(pool)
                    .await
                    .ok()
                    .flatten();

                if let Some(row) = existing {
                    row.get::<i64, _>("id")
                } else {
                    let result = sqlx::query(
                        "INSERT INTO datasets (name, source, category, external_id, description) VALUES (?, ?, ?, ?, ?)"
                    )
                    .bind(name)
                    .bind(adapter.name())
                    .bind(category)
                    .bind(ext_id)
                    .bind(format!("{} - {}", source.display_name, name))
                    .execute(pool)
                    .await
                    .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                    datasets_added += 1;
                    result.last_insert_rowid()
                }
            }
            DatabasePool::Postgres(pool) => {
                let existing = sqlx::query("SELECT id FROM datasets WHERE source = $1 AND external_id = $2")
                    .bind(adapter.name())
                    .bind(ext_id)
                    .fetch_optional(pool)
                    .await
                    .ok()
                    .flatten();

                if let Some(row) = existing {
                    row.get::<i64, _>("id")
                } else {
                    let row = sqlx::query(
                        "INSERT INTO datasets (name, source, category, external_id, description) VALUES ($1, $2, $3, $4, $5) RETURNING id"
                    )
                    .bind(name)
                    .bind(adapter.name())
                    .bind(category)
                    .bind(ext_id)
                    .bind(format!("{} - {}", source.display_name, name))
                    .fetch_one(pool)
                    .await
                    .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

                    datasets_added += 1;
                    row.get::<i64, _>("id")
                }
            }
        };

        match adapter.fetch_series(ext_id).await {
            Ok(observations) => {
                for obs in observations {
                    match pool {
                        DatabasePool::Sqlite(pool) => {
                            sqlx::query(
                                "INSERT OR REPLACE INTO data_points (dataset_id, date, value) VALUES (?, ?, ?)"
                            )
                            .bind(dataset_id)
                            .bind(obs.date)
                            .bind(obs.value)
                            .execute(pool)
                            .await
                            .ok();
                        }
                        DatabasePool::Postgres(pool) => {
                            sqlx::query(
                                "INSERT INTO data_points (dataset_id, date, value) VALUES ($1, $2, $3) \
                                 ON CONFLICT (dataset_id, date) DO UPDATE SET value = EXCLUDED.value"
                            )
                            .bind(dataset_id)
                            .bind(obs.date)
                            .bind(obs.value)
                            .execute(pool)
                            .await
                            .ok();
                        }
                    }
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
) -> Json<Vec<crate::models::Dataset>> {
    let source = match repo.get_source(id).await {
        Ok(Some(s)) => s,
        _ => return Json(vec![]),
    };
    match repo.list_datasets().await {
        Ok(datasets) => {
            let filtered: Vec<_> = datasets.into_iter()
                .filter(|d| d.source == source.name)
                .collect();
            Json(filtered)
        }
        Err(_) => Json(vec![]),
    }
}

async fn delete_dataset(
    State(repo): State<Arc<dyn AppRepo>>,
    Path(id): Path<i64>,
) -> Result<Json<()>, (axum::http::StatusCode, String)> {
    let pool = repo.pool();
    match pool {
        DatabasePool::Sqlite(pool) => {
            sqlx::query("DELETE FROM data_points WHERE dataset_id = ?")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            sqlx::query("DELETE FROM datasets WHERE id = ?")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
        DatabasePool::Postgres(pool) => {
            sqlx::query("DELETE FROM data_points WHERE dataset_id = $1")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

            sqlx::query("DELETE FROM datasets WHERE id = $1")
                .bind(id)
                .execute(pool)
                .await
                .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        }
    }

    Ok(Json(()))
}
