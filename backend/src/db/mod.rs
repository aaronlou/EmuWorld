use sqlx::SqlitePool;
use std::str::FromStr;

pub async fn init_pool(database_url: &str) -> Result<SqlitePool, sqlx::Error> {
    let url = if database_url.starts_with("sqlite:") {
        database_url.to_string()
    } else {
        format!("sqlite:{}", database_url)
    };
    SqlitePool::connect_with(
        sqlx::sqlite::SqliteConnectOptions::from_str(&url)
            .expect("invalid sqlite url")
            .create_if_missing(true)
    )
    .await
}

pub async fn run_migrations(pool: &SqlitePool) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS datasets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            source TEXT NOT NULL,
            category TEXT NOT NULL,
            fred_code TEXT,
            description TEXT NOT NULL DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS data_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            dataset_id INTEGER NOT NULL REFERENCES datasets(id),
            date TEXT NOT NULL,
            value REAL NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            UNIQUE(dataset_id, date)
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS prediction_targets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            question TEXT NOT NULL,
            category TEXT NOT NULL,
            horizon_days INTEGER NOT NULL,
            outcomes TEXT NOT NULL,
            active INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            target_id INTEGER NOT NULL REFERENCES prediction_targets(id),
            outcome TEXT NOT NULL,
            probability REAL NOT NULL,
            confidence_lower REAL NOT NULL,
            confidence_upper REAL NOT NULL,
            model_version TEXT NOT NULL DEFAULT 'v1',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}
