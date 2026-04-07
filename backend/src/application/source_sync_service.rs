use std::sync::Arc;

use serde::Serialize;

use crate::{
    ingest,
    ingest::news::NewsSource,
    integrations::ai_client::AIClient,
    models::CreateNewsArticleRequest,
    repo::{AppRepo, CreateDataPoint, RepoError, Result},
};

#[derive(Debug, Clone, Serialize)]
pub struct SourceSyncResult {
    pub source: String,
    pub datasets_added: usize,
    pub data_points_synced: usize,
}

#[derive(Clone)]
pub struct SourceSyncService {
    repo: Arc<dyn AppRepo>,
    ai_client: Arc<AIClient>,
}

impl SourceSyncService {
    pub fn new(repo: Arc<dyn AppRepo>, ai_client: Arc<AIClient>) -> Self {
        Self { repo, ai_client }
    }

    pub async fn sync_source(&self, id: i64) -> Result<SourceSyncResult> {
        let source = self
            .repo
            .get_source(id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("source {}", id)))?;

        if !source.enabled {
            return Err(RepoError::Validation("Source is disabled".into()));
        }

        let adapter = ingest::build_adapter(
            &source.name,
            source.api_base_url.clone(),
            source.api_key.clone(),
            self.ai_client.clone(),
        )
        .map_err(RepoError::Validation)?;

        let mut datasets_added = 0;
        let mut data_points_synced = 0;

        for (ext_id, name, category) in adapter.default_datasets() {
            let (dataset_id, is_new) = self
                .repo
                .upsert_or_create_dataset(
                    name,
                    adapter.name(),
                    category,
                    ext_id,
                    &format!("{} - {}", source.display_name, name),
                )
                .await?;

            if is_new {
                datasets_added += 1;
            }

            match adapter.fetch_series(ext_id).await {
                Ok(observations) => {
                    for obs in observations {
                        let _ = self
                            .repo
                            .upsert_data_point(&CreateDataPoint {
                                dataset_id,
                                date: obs.date,
                                value: obs.value,
                            })
                            .await;
                        data_points_synced += 1;
                    }
                }
                Err(e) => {
                    tracing::warn!(
                        "Failed to fetch series {} from {}: {}",
                        ext_id,
                        adapter.name(),
                        e
                    );
                }
            }
        }

        Ok(SourceSyncResult {
            source: source.display_name,
            datasets_added,
            data_points_synced,
        })
    }

    pub async fn sync_news(&self) -> Result<SourceSyncResult> {
        let news_source = NewsSource::new();
        
        let items = news_source.fetch_all_feeds().await
            .map_err(|e| RepoError::ExternalService(e.to_string()))?;

        let articles: Vec<CreateNewsArticleRequest> = items
            .into_iter()
            .map(|item| CreateNewsArticleRequest {
                source_name: item.source_name,
                title: item.title,
                url: item.url,
                description: item.description,
                content: item.content,
                author: item.author,
                published_at: item.published_at,
                category: item.category,
                language: Some("en".to_string()),
                country: Some("us".to_string()),
                entities: None,
                sentiment_score: None,
            })
            .collect();

        let count = self.repo.batch_upsert_news(&articles).await?;

        Ok(SourceSyncResult {
            source: "News RSS Feeds".to_string(),
            datasets_added: 0,
            data_points_synced: count,
        })
    }
}
