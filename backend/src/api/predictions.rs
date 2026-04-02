use axum::{Router, routing::{get, post}, extract::State, Json};
use sqlx::SqlitePool;
use crate::models::{PredictionTarget, Prediction, PredictionResponse, CreateTargetRequest};

pub fn router() -> Router<SqlitePool> {
    Router::new()
        .route("/targets", get(list_targets))
        .route("/targets", post(create_target))
        .route("/targets/{id}/predict", post(generate_prediction))
        .route("/targets/{id}/predictions", get(get_predictions))
}

pub async fn list_targets(State(pool): State<SqlitePool>) -> Json<Vec<PredictionTarget>> {
    let targets = sqlx::query_as::<_, PredictionTarget>(
        "SELECT * FROM prediction_targets WHERE active = 1 ORDER BY created_at DESC"
    )
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(targets)
}

async fn create_target(
    State(pool): State<SqlitePool>,
    Json(req): Json<CreateTargetRequest>,
) -> Json<PredictionTarget> {
    let outcomes_json = serde_json::to_string(&req.outcomes).unwrap();
    let row = sqlx::query(
        "INSERT INTO prediction_targets (question, category, horizon_days, outcomes) VALUES (?, ?, ?, ?)"
    )
    .bind(&req.question)
    .bind(&req.category)
    .bind(req.horizon_days)
    .bind(&outcomes_json)
    .execute(&pool)
    .await
    .unwrap();

    let id = row.last_insert_rowid();
    Json(sqlx::query_as::<_, PredictionTarget>("SELECT * FROM prediction_targets WHERE id = ?")
        .bind(id)
        .fetch_one(&pool)
        .await
        .unwrap())
}

async fn generate_prediction(
    State(pool): State<SqlitePool>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Json<PredictionResponse> {
    let target: PredictionTarget = sqlx::query_as::<_, PredictionTarget>(
        "SELECT * FROM prediction_targets WHERE id = ?"
    )
    .bind(id)
    .fetch_one(&pool)
    .await
    .unwrap();

    let outcomes: Vec<String> = serde_json::from_str(&target.outcomes).unwrap_or_default();

    let client = reqwest::Client::new();
    let ai_response = client
        .post("http://localhost:9000/predict")
        .json(&serde_json::json!({
            "question": target.question,
            "horizon_days": target.horizon_days,
            "outcomes": outcomes,
        }))
        .send()
        .await
        .ok();

    let predictions = if let Some(resp) = ai_response {
        let probs: Vec<f64> = resp.json().await.unwrap_or_default();
        for (outcome, prob) in outcomes.iter().zip(probs.iter()) {
            sqlx::query(
                "INSERT INTO predictions (target_id, outcome, probability, confidence_lower, confidence_upper) VALUES (?, ?, ?, ?, ?)"
            )
            .bind(id)
            .bind(outcome)
            .bind(prob)
            .bind((prob - 0.05).max(0.0))
            .bind((prob + 0.05).min(1.0))
            .execute(&pool)
            .await
            .unwrap();
        }
        sqlx::query_as::<_, Prediction>("SELECT * FROM predictions WHERE target_id = ? ORDER BY probability DESC")
            .bind(id)
            .fetch_all(&pool)
            .await
            .unwrap_or_default()
    } else {
        vec![]
    };

    Json(PredictionResponse {
        target,
        predictions,
        generated_at: chrono::Utc::now(),
    })
}

pub async fn get_predictions(
    State(pool): State<SqlitePool>,
    axum::extract::Path(id): axum::extract::Path<i64>,
) -> Json<Vec<Prediction>> {
    let predictions = sqlx::query_as::<_, Prediction>(
        "SELECT * FROM predictions WHERE target_id = ? ORDER BY probability DESC"
    )
    .bind(id)
    .fetch_all(&pool)
    .await
    .unwrap_or_default();
    Json(predictions)
}
