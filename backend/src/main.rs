use sqlx::{Pool, Postgres, Sqlite};
use axum::{Router, routing::get};
use tower_http::cors::CorsLayer;
use std::sync::Arc;
use std::str::FromStr;

mod api;
mod models;
mod repo;
mod ingest;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let db_url = std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:data/emuworld.db".to_string());

    let app = if db_url.starts_with("postgres:") || db_url.starts_with("postgresql:") {
        tracing::info!("Connecting to PostgreSQL: {}", db_url);
        let pool = Pool::<Postgres>::connect(&db_url)
            .await
            .expect("Failed to connect to PostgreSQL");

        repo::postgres::run_migrations(&pool).await.expect("Failed to run PostgreSQL migrations");

        let repo = Arc::new(repo::postgres::PostgresRepo::new(pool));

        Router::new()
            .route("/health", get(|| async { "ok" }))
            .merge(api::datasets::router())
            .merge(api::predictions::router())
            .merge(api::targets::router())
            .merge(api::sources::router())
            .layer(CorsLayer::permissive())
            .with_state(repo)
    } else {
        let file_path = if db_url.starts_with("sqlite:") {
            db_url.strip_prefix("sqlite:").unwrap()
        } else {
            &db_url
        };
        let parent = std::path::Path::new(file_path).parent();
        if let Some(p) = parent {
            std::fs::create_dir_all(p).expect(&format!("Failed to create directory: {:?}", p));
        }
        let sqlite_url = if db_url.starts_with("sqlite:") { db_url.clone() } else { format!("sqlite:{}", db_url) };

        tracing::info!("Connecting to SQLite: {}", sqlite_url);
        let pool = Pool::<Sqlite>::connect_with(
            sqlx::sqlite::SqliteConnectOptions::from_str(&sqlite_url)
                .expect("invalid sqlite url")
                .create_if_missing(true)
        )
        .await
        .expect("Failed to init database");

        repo::sqlite::run_migrations(&pool).await.expect("Failed to run migrations");

        let repo = Arc::new(repo::sqlite::SqliteRepo::new(pool));

        Router::new()
            .route("/health", get(|| async { "ok" }))
            .merge(api::datasets::router())
            .merge(api::predictions::router())
            .merge(api::targets::router())
            .merge(api::sources::router())
            .layer(CorsLayer::permissive())
            .with_state(repo)
    };

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8080").await.unwrap();
    tracing::info!("listening on 0.0.0.0:8080");
    axum::serve(listener, app).await.unwrap();
}
