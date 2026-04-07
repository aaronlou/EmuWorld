use std::sync::Arc;
use futures_util::{Stream, StreamExt};
use bytes::Bytes;

use crate::{
    integrations::ai_client::{ai_service, AIClient},
    models::{ChatContext, ChatMessageRecord, ChatRequest, ChatResponse, ChatSession},
    repo::{AppRepo, CreateChatMessage, CreateChatSession, RepoError, Result},
};

fn to_proto_context(ctx: &ChatContext) -> ai_service::ChatContext {
    ai_service::ChatContext {
        page: ctx.page.clone(),
        datasets_count: ctx.datasets_count as u32,
        targets_count: ctx.targets_count as u32,
        predictions_count: ctx.predictions_count as u32,
        dataset_catalog: ctx.dataset_catalog.clone(),
        target_catalog: ctx.target_catalog.clone(),
        prediction_catalog: ctx.prediction_catalog.clone(),
        dataset: ctx.dataset.as_ref().map(|d| d.name.clone()).unwrap_or_default(),
        target: ctx.target.as_ref().map(|t| t.question.clone()).unwrap_or_default(),
        prediction: ctx.prediction.as_ref().map(|p| p.run_id.map(|id| id.to_string()).unwrap_or_default()).unwrap_or_default(),
    }
}

#[derive(Clone)]
pub struct ChatService {
    repo: Arc<dyn AppRepo>,
    ai_client: Arc<AIClient>,
}

impl ChatService {
    pub fn new(repo: Arc<dyn AppRepo>, ai_client: Arc<AIClient>) -> Self {
        Self { repo, ai_client }
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

    pub async fn chat(&self, request: &ChatRequest) -> Result<ChatResponse> {
        let session = self.ensure_session(request).await?;
        
        let history = self
            .repo
            .list_chat_messages(session.id)
            .await?
            .into_iter()
            .map(|message| ai_service::ChatHistory {
                role: message.role,
                content: message.content,
            })
            .collect::<Vec<_>>();

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

        let ai_response = self.ai_client.chat(
            request.message.clone(),
            history,
            to_proto_context(&request.context),
        ).await.map_err(|e| RepoError::ExternalService(e.to_string()))?;

        let response = ChatResponse {
            session_id: Some(session.id),
            answer: ai_response.content.clone(),
            suggested_prompts: vec![], 
            provider: "openai".into(), 
            model: "default".into(),
            used_fallback: false,
        };

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
    ) -> Result<impl Stream<Item = std::result::Result<Bytes, tonic::Status>>> {
        let session = self.ensure_session(request).await?;
        
        let history = self
            .repo
            .list_chat_messages(session.id)
            .await?
            .into_iter()
            .map(|message| ai_service::ChatHistory {
                role: message.role,
                content: message.content,
            })
            .collect::<Vec<_>>();

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

        let stream = self.ai_client.chat_stream(
            request.message.clone(),
            history,
            to_proto_context(&request.context),
        ).await.map_err(|e| RepoError::ExternalService(e.to_string()))?;

        Ok(stream.map(|res| {
            res.map(|chat_res| {
                let data = format!("data: {}\n\n", chat_res.content);
                Bytes::from(data)
            })
        }))
    }
}
