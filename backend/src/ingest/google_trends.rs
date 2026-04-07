use async_trait::async_trait;
use std::sync::Arc;
use crate::integrations::ai_client::AIClient;
use super::{DataSource, Observation};

pub struct GoogleTrendsSource {
    ai_client: Arc<AIClient>,
    _api_key: String,
}

impl GoogleTrendsSource {
    pub fn new(ai_client: Arc<AIClient>, api_key: String) -> Self {
        Self { ai_client, _api_key: api_key }
    }
}

#[async_trait]
impl DataSource for GoogleTrendsSource {
    fn name(&self) -> &str {
        "google_trends"
    }

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        let response = self.ai_client.fetch_data(
            "google_trends".into(),
            external_id.into()
        ).await?;

        if !response.error.is_empty() {
            return Err(response.error.into());
        }

        let result = response.data.into_iter().filter_map(|p| {
            let date = chrono::NaiveDate::parse_from_str(&p.date, "%Y-%m-%d").ok()
                .or_else(|| {
                    chrono::NaiveDate::parse_from_str(&format!("{}-01", p.date), "%Y-%m-%d").ok()
                });
            
            date.map(|d| Observation { date: d, value: p.value })
        }).collect();

        Ok(result)
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![
            ("unemployment", "Unemployment (Search Interest)", "employment"),
            ("inflation", "Inflation (Search Interest)", "inflation"),
            ("recession", "Recession (Search Interest)", "growth"),
            ("housing market", "Housing Market (Search Interest)", "real_estate"),
            ("interest rate", "Interest Rate (Search Interest)", "money_supply"),
            ("stock market", "Stock Market (Search Interest)", "growth"),
            ("gas prices", "Gas Prices (Search Interest)", "inflation"),
            ("layoffs", "Layoffs (Search Interest)", "employment"),
            ("mortgage rate", "Mortgage Rate (Search Interest)", "real_estate"),
            ("consumer confidence", "Consumer Confidence (Search Interest)", "growth"),
        ]
    }
}
