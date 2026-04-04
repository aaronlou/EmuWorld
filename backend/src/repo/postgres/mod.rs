use sqlx::PgPool;

pub struct PostgresRepo {
    pub(super) pool: PgPool,
}

impl PostgresRepo {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }
}
mod chat;
mod datasets;
pub mod migrations;
mod predictions;
mod sources;
mod targets;

impl crate::repo::AppRepo for PostgresRepo {}
