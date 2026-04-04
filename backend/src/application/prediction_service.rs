use std::sync::Arc;

use crate::{
    models::PredictionResponse,
    repo::{AppRepo, CreatePrediction, RepoError, Result},
};

#[derive(Clone)]
pub struct PredictionService {
    repo: Arc<dyn AppRepo>,
    ai_service_url: String,
}

impl PredictionService {
    pub fn new(repo: Arc<dyn AppRepo>, ai_service_url: String) -> Self {
        Self {
            repo,
            ai_service_url,
        }
    }

    pub async fn generate_prediction(&self, target_id: i64) -> Result<PredictionResponse> {
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
                status: "running".into(),
                model_version: "v1".into(),
                input_snapshot,
            })
            .await?;

        let client = reqwest::Client::new();
        let ai_response = match client
            .post(format!("{}/predict", self.ai_service_url))
            .json(&serde_json::json!({
                "question": target.question,
                "horizon_days": target.horizon_days,
                "outcomes": outcomes,
            }))
            .send()
            .await
        {
            Ok(response) => response,
            Err(e) => {
                let message = e.to_string();
                let _ = self.repo.mark_run_failed(run.id, &message).await;
                return Err(RepoError::ExternalService(message));
            }
        };

        let probs: Vec<f64> = match ai_response.json().await {
            Ok(probs) => probs,
            Err(e) => {
                let message = e.to_string();
                let _ = self.repo.mark_run_failed(run.id, &message).await;
                return Err(RepoError::ExternalService(message));
            }
        };

        let predictions: Vec<CreatePrediction> = outcomes
            .iter()
            .zip(probs.iter())
            .map(|(outcome, prob)| CreatePrediction {
                target_id,
                run_id: run.id,
                outcome: outcome.clone(),
                probability: *prob,
                confidence_lower: (*prob - 0.05).max(0.0),
                confidence_upper: (*prob + 0.05).min(1.0),
            })
            .collect();

        if let Err(err) = self.repo.create_batch(target_id, &predictions).await {
            let _ = self.repo.mark_run_failed(run.id, &err.to_string()).await;
            return Err(err);
        }

        let run = self.repo.mark_run_completed(run.id).await?;
        let predictions = self.repo.list_by_run(run.id).await?;

        Ok(PredictionResponse {
            target,
            run,
            predictions,
            generated_at: chrono::Utc::now(),
        })
    }
}
