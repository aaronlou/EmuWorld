use std::sync::Arc;

use futures_util::TryStreamExt;
use tracing::{error, info};

use crate::{
    models::{ChatContext, ChatMessageRecord, ChatRequest, ChatResponse, ChatSession},
    repo::{AppRepo, CreateChatMessage, CreateChatSession, RepoError, Result},
};

#[derive(Clone)]
pub struct ChatService {
    repo: Arc<dyn AppRepo>,
    ai_service_url: String,
}

impl ChatService {
    pub fn new(repo: Arc<dyn AppRepo>, ai_service_url: String) -> Self {
        Self { repo, ai_service_url }
    }

    async fn enrich_context(&self, mut context: ChatContext) -> Result<ChatContext> {
        if let Some(dataset) = &context.dataset {
            let points = self.repo.data_points(dataset.id).await?;
            context.dataset_series_summary = points
                .iter()
                .rev()
                .take(8)
                .rev()
                .map(|point| format!("{} => {:.2}", point.date.format("%Y-%m-%d"), point.value))
                .collect();
        }

        if let Some(target) = &context.target {
            if let Some(full_target) = self.repo.get_target(target.id).await? {
                context.target_outcomes = serde_json::from_str::<Vec<String>>(&full_target.outcomes)
                    .unwrap_or_default();
            }
        }

        if let Some(prediction) = &context.prediction {
            if let Some(run_id) = prediction.run_id {
                let run_predictions = self.repo.list_by_run(run_id).await?;
                context.prediction_distribution = run_predictions
                    .iter()
                    .map(|prediction| {
                        format!(
                            "{} => {:.1}% (CI {:.1}-{:.1})",
                            prediction.outcome,
                            prediction.probability * 100.0,
                            prediction.confidence_lower * 100.0,
                            prediction.confidence_upper * 100.0,
                        )
                    })
                    .collect();
            }
        }

        Ok(context)
    }

    pub async fn create_session(&self, title: Option<String>) -> Result<ChatSession> {
        self.repo
            .create_chat_session(&CreateChatSession {
                title: title.unwrap_or_else(|| "New chat".to_string()),
            })
            .await
    }

    pub async fn list_messages(&self, session_id: i64) -> Result<Vec<ChatMessageRecord>> {
        self.repo.list_chat_messages(session_id).await
    }

    async fn ensure_session(&self, request: &ChatRequest) -> Result<ChatSession> {
        if let Some(session_id) = request.session_id {
            return self
                .repo
                .get_chat_session(session_id)
                .await?
                .ok_or_else(|| RepoError::NotFound(format!("chat session {}", session_id)));
        }

        self.create_session(Some(request.message.chars().take(48).collect()))
            .await
    }

    async fn build_ai_request(&self, request: &ChatRequest) -> Result<serde_json::Value> {
        let session = self.ensure_session(request).await?;
        let enriched_context = self.enrich_context(request.context.clone()).await?;
        let history = self
            .repo
            .list_chat_messages(session.id)
            .await?
            .into_iter()
            .map(|message| {
                serde_json::json!({
                    "role": message.role,
                    "content": message.content,
                })
            })
            .collect::<Vec<_>>();

        Ok(serde_json::json!({
            "session_id": session.id,
            "message": request.message,
            "context": enriched_context,
            "history": history,
        }))
    }

    pub async fn chat(&self, request: &ChatRequest) -> Result<ChatResponse> {
        let session = self.ensure_session(request).await?;
        let ai_request = self.build_ai_request(request).await?;

        info!(
            session_id = session.id,
            page = request.context.page,
            message_len = request.message.len(),
            "forwarding chat request to ai-service"
        );

        self.repo
            .create_chat_message(&CreateChatMessage {
                session_id: session.id,
                role: "user".into(),
                content: request.message.clone(),
                provider: None,
                model: None,
                used_fallback: false,
            })
            .await?;

        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/chat", self.ai_service_url))
            .json(&ai_request)
            .send()
            .await
            .map_err(|error| RepoError::ExternalService(error.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_else(|_| "<unreadable body>".into());
            error!(
                session_id = session.id,
                %status,
                response_body = %body,
                "ai-service returned non-success for chat"
            );
            return Err(RepoError::ExternalService(format!(
                "ai-service chat failed with {status}: {body}"
            )));
        }

        let mut response = response
            .json::<ChatResponse>()
            .await
            .map_err(|error| RepoError::ExternalService(error.to_string()))?;

        response.session_id = Some(session.id);

        self.repo
            .create_chat_message(&CreateChatMessage {
                session_id: session.id,
                role: "assistant".into(),
                content: response.answer.clone(),
                provider: Some(response.provider.clone()),
                model: Some(response.model.clone()),
                used_fallback: response.used_fallback,
            })
            .await?;

        Ok(response)
    }

    pub async fn chat_stream(
        &self,
        request: &ChatRequest,
    ) -> Result<impl futures_util::Stream<Item = std::result::Result<bytes::Bytes, RepoError>>> {
        let ai_request = self.build_ai_request(request).await?;

        let client = reqwest::Client::new();
        let response = client
            .post(format!("{}/chat/stream", self.ai_service_url))
            .json(&ai_request)
            .send()
            .await
            .map_err(|error| RepoError::ExternalService(error.to_string()))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_else(|_| "<unreadable body>".into());
            error!(
                %status,
                response_body = %body,
                "ai-service returned non-success for chat stream"
            );
            return Err(RepoError::ExternalService(format!(
                "ai-service chat stream failed with {status}: {body}"
            )));
        }

        Ok(response
            .bytes_stream()
            .map_err(|error| RepoError::ExternalService(error.to_string())))
    }
}
