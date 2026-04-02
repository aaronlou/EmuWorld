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

    let db_path = std::env::var("DATABASE_URL").unwrap_or_else(|_| "data/emuworld.db".to_string());
    let file_path = if db_path.starts_with("sqlite:") {
        db_path.strip_prefix("sqlite:").unwrap()
    } else {
        &db_path
    };
    let parent = std::path::Path::new(file_path).parent();
    if let Some(p) = parent {
        std::fs::create_dir_all(p).expect(&format!("Failed to create directory: {:?}", p));
    }
    let db_url = if db_path.starts_with("sqlite:") { db_path } else { format!("sqlite:{}", db_path) };
    let pool = db::init_pool(&db_url).await.expect("Failed to init database");
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
