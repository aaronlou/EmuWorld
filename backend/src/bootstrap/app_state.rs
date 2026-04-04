use std::sync::Arc;

use crate::{
    application::{
        chat_service::ChatService, prediction_service::PredictionService,
        source_sync_service::SourceSyncService,
    },
    repo::AppRepo,
};

#[derive(Clone)]
pub struct AppState {
    pub repo: Arc<dyn AppRepo>,
    pub chat_service: ChatService,
    pub prediction_service: PredictionService,
    pub source_sync_service: SourceSyncService,
}

impl AppState {
    pub fn new(repo: Arc<dyn AppRepo>, ai_service_url: String) -> Self {
        let prediction_service = PredictionService::new(repo.clone(), ai_service_url.clone());
        let chat_service = ChatService::new(repo.clone(), ai_service_url);
        let source_sync_service = SourceSyncService::new(repo.clone());

        Self {
            repo,
            chat_service,
            prediction_service,
            source_sync_service,
        }
    }
}
