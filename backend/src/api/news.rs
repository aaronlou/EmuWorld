use axum::{
    extract::{Query, State},
    routing::{get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::{
    api::errors::{ApiError, ApiResult},
    application::source_sync_service::SourceSyncResult,
    bootstrap::app_state::AppState,
    models::NewsQuery,
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/news", get(list_news))
        .route("/news", post(create_news_article))
        .route("/news/sync", post(sync_news))
}

async fn list_news(
    State(state): State<Arc<AppState>>,
    Query(query): Query<NewsQuery>,
) -> ApiResult<Vec<crate::models::NewsArticle>> {
    Ok(Json(state.repo.list_news(&query).await?))
}

async fn create_news_article(
    State(state): State<Arc<AppState>>,
    Json(body): Json<crate::models::CreateNewsArticleRequest>,
) -> ApiResult<crate::models::NewsArticle> {
    Ok(Json(state.repo.create_news_article(&body).await?))
}

async fn sync_news(
    State(state): State<Arc<AppState>>,
) -> ApiResult<SourceSyncResult> {
    Ok(Json(state.source_sync_service.sync_news().await?))
}
