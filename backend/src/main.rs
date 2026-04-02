use sqlx::SqlitePool;
use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;

mod api;
mod db;
mod ingest;
mod models;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let pool = db::init_pool("data/emuworld.db").await.expect("Failed to init database");
    db::run_migrations(&pool).await.expect("Failed to run migrations");

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .merge(api::datasets::router())
        .merge(api::predictions::router())
        .merge(api::targets::router())
        .layer(CorsLayer::permissive())
        .with_state(pool);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    tracing::info!("listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}
