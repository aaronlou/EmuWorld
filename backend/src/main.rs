use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;
use std::sync::Arc;

mod api;
mod application;
mod bootstrap;
mod models;
mod repo;
mod ingest;
mod integrations;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "postgres://emuworld:emuworld_pass@localhost:5432/emuworld".to_string());

    tracing::info!("Connecting to PostgreSQL: {}", db_url);
    let pool = repo::init_pool(&db_url).await.expect("Failed to connect to PostgreSQL");

    repo::postgres::migrations::run_migrations(&pool)
        .await
        .expect("Failed to run migrations");

    let repo: Arc<dyn repo::AppRepo> = Arc::new(repo::postgres::PostgresRepo::new(pool));
    
    // Default gRPC port is 9001
    let ai_service_url =
        std::env::var("AI_SERVICE_URL").unwrap_or_else(|_| "http://localhost:9001".to_string());
    
    let state = Arc::new(bootstrap::app_state::AppState::new(repo.clone(), ai_service_url).await.expect("Failed to initialize AppState"));

    let _news_scheduler = application::scheduler::spawn_news_sync_scheduler(state.source_sync_service.clone());

    let app = Router::new()
        .route("/health", get(|| async { "ok" }))
        .merge(api::chat::router())
        .merge(api::datasets::router())
        .merge(api::predictions::router())
        .merge(api::targets::router())
        .merge(api::sources::router())
        .merge(api::news::router())
        .merge(api::anomalies::router())
        .layer(CorsLayer::permissive())
        .with_state(state);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    tracing::info!("listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}
