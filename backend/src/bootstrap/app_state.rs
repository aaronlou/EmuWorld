use std::sync::Arc;

use crate::{
    application::{
        chat_service::ChatService, prediction_service::PredictionService,
        source_sync_service::SourceSyncService,
    },
    integrations::ai_client::AIClient,
    repo::AppRepo,
};

#[derive(Clone)]
pub struct AppState {
    pub repo: Arc<dyn AppRepo>,
    pub chat_service: ChatService,
    pub prediction_service: PredictionService,
    pub source_sync_service: SourceSyncService,
    pub ai_client: Arc<AIClient>,
}

impl AppState {
    pub async fn new(repo: Arc<dyn AppRepo>, ai_service_url: String) -> anyhow::Result<Self> {
        let ai_client = Arc::new(AIClient::connect(ai_service_url).await?);
        
        let prediction_service = PredictionService::new(repo.clone(), ai_client.clone());
        let chat_service = ChatService::new(repo.clone(), ai_client.clone());
        let source_sync_service = SourceSyncService::new(repo.clone(), ai_client.clone());

        Ok(Self {
            repo,
            chat_service,
            prediction_service,
            source_sync_service,
            ai_client,
        })
    }
}
