use std::sync::Arc;
use std::time::Duration;

use crate::application::source_sync_service::SourceSyncService;
use crate::repo::AppRepo;

const AUTO_SYNC_SOURCES: &[&str] = &["google_trends", "yfinance"];

pub fn spawn_auto_sync_scheduler(
    sync_service: SourceSyncService,
    repo: Arc<dyn AppRepo>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        run_all_auto_syncs(&sync_service, &*repo, "startup").await;

        let mut interval = tokio::time::interval(Duration::from_secs(24 * 60 * 60));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

        loop {
            interval.tick().await;
            run_all_auto_syncs(&sync_service, &*repo, "scheduled").await;
        }
    })
}

async fn run_all_auto_syncs(
    sync_service: &SourceSyncService,
    repo: &dyn AppRepo,
    trigger: &str,
) {
    let sources = match repo.list_sources().await {
        Ok(s) => s,
        Err(e) => {
            tracing::error!("[scheduler] Failed to list sources on {trigger}: {e}");
            return;
        }
    };

    for source_name in AUTO_SYNC_SOURCES {
        let Some(source) = sources.iter().find(|s| s.name == *source_name) else {
            tracing::debug!("[scheduler] No {source_name} source found, skipping ({trigger})");
            continue;
        };

        if !source.enabled {
            tracing::debug!("[scheduler] {source_name} source is disabled, skipping ({trigger})");
            continue;
        }

        tracing::info!("[{source_name} sync] Starting {trigger} sync...");
        match sync_service.sync_source(source.id).await {
            Ok(result) => {
                tracing::info!(
                    "[{source_name} sync] Complete: {} datasets added, {} data points synced",
                    result.datasets_added,
                    result.data_points_synced,
                );
            }
            Err(e) => {
                tracing::error!("[{source_name} sync] Failed on {trigger}: {e}");
            }
        }
    }
}
