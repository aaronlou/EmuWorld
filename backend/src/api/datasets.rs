use axum::{Router, routing::{get, post}, extract::State, Json};
use sqlx::SqlitePool;
use crate::models::Dataset;

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/datasets", get(list_datasets))
        .route("/datasets", post(add_dataset))
        .route("/datasets/:id/points", get(get_data_points))
}

async fn list_datasets(State(pool): State<SqlitePool>) -> Json<Vec<Dataset>> {
    let datasets = sqlx::query_as::<_, Dataset>("SELECT * FROM datasets ORDER BY category, name")
        .fetch_all(&pool)
        .await
        .unwrap_or_default();
    Json(datasets)
}

async fn add_dataset(
    State(pool): State<SqlitePool>,
    Json(dataset): Json<serde_json::Value>,
) -> Json<Dataset> {
    let row = sqlx::query(
        "INSERT INTO datasets (name, source, category, fred_code, description) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(dataset["name"].as_str().unwrap_or(""))
    .bind(dataset["source"].as_str().unwrap_or(""))
    .bind(dataset["category"].as_str().unwrap_or(""))
    .bind(dataset.get("fred_code").and_then(|v| v.as_str()))
    .bind(dataset["description"].as_str().unwrap_or(""))
    .execute(&pool)
    .await
    .unwrap();

    let id = row.last_insert_rowid();
    sqlx::query_as::<_, Dataset>("SELECT * FROM datasets WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap()
        .into()
}

async fn get_data_points(
    State(pool): State<SqlitePool>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Json<Vec<crate::models::DataPoint>> {
    let points = sqlx::query_as::<_, crate::models::DataPoint>(
        "SELECT * FROM data_points WHERE dataset_id = ? ORDER BY date"
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(points)
}
