use axum::{routing::get, Router};

pub fn router() -> Router<sqlx::SqlitePool> {
    Router::new().route("/targets/list", get(super::predictions::list_targets))
}
