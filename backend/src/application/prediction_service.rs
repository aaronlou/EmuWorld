use std::sync::Arc;

use crate::{
    integrations::ai_client::AIClient,
    models::PredictionResponse,
    repo::{AppRepo, CreatePrediction, RepoError, Result},
};

#[derive(Clone)]
pub struct PredictionService {
    repo: Arc<dyn AppRepo>,
    ai_client: Arc<AIClient>,
}

impl PredictionService {
    pub fn new(repo: Arc<dyn AppRepo>, ai_client: Arc<AIClient>) -> Self {
        Self {
            repo,
            ai_client,
        }
    }

    pub async fn generate_prediction(&self, target_id: i64) -> Result<i64> {
        let target = self
            .repo
            .get_target(target_id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("target {}", target_id)))?;

        let outcomes: Vec<String> = serde_json::from_str(&target.outcomes)
            .map_err(|e| RepoError::Database(e.to_string()))?;

        let input_snapshot = serde_json::json!({
            "question": target.question,
            "horizon_days": target.horizon_days,
            "outcomes": outcomes,
        })
        .to_string();

        let run = self
            .repo
            .create_run(&crate::repo::CreatePredictionRun {
                target_id,
                status: "pending".into(),
                model_version: "v1".into(),
                input_snapshot,
            })
            .await?;

        let run_id = run.id;
        let service = self.clone();
        let outcomes_clone = outcomes.clone();
        let question_clone = target.question.clone();
        let horizon_days = target.horizon_days as i32;

        // 在后台执行预测逻辑
        tokio::spawn(async move {
            let _ = service.repo.mark_run_running(run_id).await;

            match service.ai_client.predict(
                question_clone,
                outcomes_clone.clone(),
                horizon_days,
            ).await {
                Ok(ai_response) => {
                    let probs = ai_response.probabilities;
                    let predictions: Vec<CreatePrediction> = outcomes_clone
                        .iter()
                        .zip(probs.iter())
                        .map(|(outcome, prob)| CreatePrediction {
                            target_id,
                            run_id,
                            outcome: outcome.clone(),
                            probability: *prob,
                            confidence_lower: (*prob - 0.05).max(0.0),
                            confidence_upper: (*prob + 0.05).min(1.0),
                        })
                        .collect();

                    if let Err(err) = service.repo.create_batch(target_id, &predictions).await {
                        let _ = service.repo.mark_run_failed(run_id, &err.to_string()).await;
                    } else {
                        let _ = service.repo.mark_run_completed(run_id).await;
                    }
                }
                Err(e) => {
                    let _ = service.repo.mark_run_failed(run_id, &e.to_string()).await;
                }
            }
        });

        Ok(run_id)
    }
}
