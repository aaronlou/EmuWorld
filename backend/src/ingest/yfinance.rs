use async_trait::async_trait;
use std::sync::Arc;
use crate::integrations::ai_client::AIClient;
use super::{DataSource, Observation};

pub struct YFinanceSource {
    ai_client: Arc<AIClient>,
    _api_key: String,
}

impl YFinanceSource {
    pub fn new(ai_client: Arc<AIClient>, api_key: String) -> Self {
        Self { ai_client, _api_key: api_key }
    }
}

#[async_trait]
impl DataSource for YFinanceSource {
    fn name(&self) -> &str {
        "yfinance"
    }

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        let response = self.ai_client.fetch_data(
            "yfinance".into(),
            external_id.into()
        ).await?;

        if !response.error.is_empty() {
            return Err(response.error.into());
        }

        let result = response.data.into_iter().filter_map(|p| {
            let date = chrono::NaiveDate::parse_from_str(&p.date, "%Y-%m-%d").ok();
            date.map(|d| Observation { date: d, value: p.value })
        }).collect();

        Ok(result)
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![
            ("SPY", "S&P 500 ETF (SPY)", "growth"),
            ("QQQ", "Nasdaq 100 ETF (QQQ)", "growth"),
            ("GLD", "Gold ETF (GLD)", "inflation"),
            ("TLT", "20+ Year Treasury Bond (TLT)", "interest_rate"),
            ("BTC-USD", "Bitcoin (BTC-USD)", "growth"),
            ("ETH-USD", "Ethereum (ETH-USD)", "growth"),
            ("GC=F", "Gold Futures", "inflation"),
            ("CL=F", "Crude Oil Futures", "inflation"),
            ("^VIX", "VIX Volatility Index", "risk"),
            ("^TNX", "10-Year Treasury Yield", "interest_rate"),
        ]
    }
}
