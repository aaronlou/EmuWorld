use async_trait::async_trait;
use sqlx::Row;

use crate::{
    models::{ChatMessageRecord, ChatSession},
    repo::{ChatRepo, CreateChatMessage, CreateChatSession, RepoError, Result},
};

use super::PostgresRepo;

#[async_trait]
impl ChatRepo for PostgresRepo {
    async fn create_chat_session(&self, session: &CreateChatSession) -> Result<ChatSession> {
        let row = sqlx::query(
            "INSERT INTO chat_sessions (title) VALUES ($1) RETURNING id",
        )
        .bind(&session.title)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get::<i32, _>("id").into();
        self.get_chat_session(id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("chat session {}", id)))
    }

    async fn get_chat_session(&self, id: i64) -> Result<Option<ChatSession>> {
        sqlx::query_as::<_, ChatSession>(
            "SELECT id::bigint AS id, title, created_at, updated_at FROM chat_sessions WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn list_chat_messages(&self, session_id: i64) -> Result<Vec<ChatMessageRecord>> {
        sqlx::query_as::<_, ChatMessageRecord>(
            "SELECT id::bigint AS id, session_id::bigint AS session_id, role, content, provider, model, used_fallback, created_at \
             FROM chat_messages WHERE session_id = $1 ORDER BY created_at ASC, id ASC",
        )
        .bind(session_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn create_chat_message(&self, message: &CreateChatMessage) -> Result<ChatMessageRecord> {
        let row = sqlx::query(
            "INSERT INTO chat_messages (session_id, role, content, provider, model, used_fallback) \
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        )
        .bind(message.session_id)
        .bind(&message.role)
        .bind(&message.content)
        .bind(&message.provider)
        .bind(&message.model)
        .bind(message.used_fallback)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get::<i32, _>("id").into();
        self.touch_chat_session(message.session_id).await?;

        sqlx::query_as::<_, ChatMessageRecord>(
            "SELECT id::bigint AS id, session_id::bigint AS session_id, role, content, provider, model, used_fallback, created_at \
             FROM chat_messages WHERE id = $1",
        )
        .bind(id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn touch_chat_session(&self, session_id: i64) -> Result<()> {
        sqlx::query("UPDATE chat_sessions SET updated_at = NOW() WHERE id = $1")
            .bind(session_id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;

        Ok(())
    }
}
