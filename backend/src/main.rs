use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;
use std::sync::Arc;

mod api;
mod models;
mod repo;
mod ingest;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://emuworld:emuworld_pass@localhost:5432/emuworld".to_string());

    tracing::info!("Connecting to PostgreSQL: {}", db_url);
    let pool = repo::init_pool(&db_url).await.expect("Failed to connect to PostgreSQL");

    repo::postgres::run_migrations(&pool).await.expect("Failed to run migrations");

    let repo: Arc<dyn repo::AppRepo> = Arc::new(repo::postgres::PostgresRepo::new(pool));

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .merge(api::datasets::router())
        .merge(api::predictions::router())
        .merge(api::targets::router())
        .merge(api::sources::router())
        .layer(CorsLayer::permissive())
        .with_state(repo);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    tracing::info!("listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}
