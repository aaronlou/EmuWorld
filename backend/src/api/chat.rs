use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Path, State},
    http::header,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};

use crate::{
    api::errors::{ApiError, ApiResult},
    bootstrap::app_state::AppState,
    models::{ChatMessageRecord, ChatRequest, ChatResponse, ChatSession, CreateChatSessionRequest},
};

pub fn router() -> Router<Arc<AppState>> {
    Router::new()
        .route("/chat/sessions", post(create_session))
        .route("/chat/sessions/{id}/messages", get(list_messages))
        .route("/chat/sessions/{id}/messages", post(send_session_message))
        .route("/chat", post(send_chat_message))
        .route("/chat/stream", post(stream_chat_message))
}

async fn create_session(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreateChatSessionRequest>,
) -> ApiResult<ChatSession> {
    Ok(Json(state.chat_service.create_session(request.title).await?))
}

async fn list_messages(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> ApiResult<Vec<ChatMessageRecord>> {
    Ok(Json(state.chat_service.list_messages(id).await?))
}

async fn send_session_message(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(mut request): Json<ChatRequest>,
) -> ApiResult<ChatResponse> {
    request.session_id = Some(id);
    Ok(Json(state.chat_service.chat(&request).await?))
}

async fn send_chat_message(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> ApiResult<ChatResponse> {
    Ok(Json(state.chat_service.chat(&request).await?))
}

async fn stream_chat_message(
    State(state): State<Arc<AppState>>,
    Json(request): Json<ChatRequest>,
) -> Result<impl IntoResponse, ApiError> {
    let stream = state.chat_service.chat_stream(&request).await?;

    Ok((
        [(header::CONTENT_TYPE, "text/event-stream; charset=utf-8")],
        Body::from_stream(stream),
    ))
}
