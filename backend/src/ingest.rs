pub mod fred;
pub mod world_bank;
pub mod imf;
pub mod nbs;
pub mod oecd;
pub mod eurostat;
pub mod news;
pub mod google_trends;
pub mod yfinance;

use async_trait::async_trait;
use std::sync::Arc;
use crate::integrations::ai_client::AIClient;

#[derive(Debug, Clone)]
pub struct Observation {
    pub date: chrono::NaiveDate,
    pub value: f64,
}

#[async_trait]
pub trait DataSource: Send + Sync {
    fn name(&self) -> &str;

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>>;

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)>;
}

pub fn build_adapter(
    source_name: &str,
    api_base_url: String,
    api_key: String,
    ai_client: Arc<AIClient>,
) -> Result<Box<dyn DataSource>, String> {
    match source_name {
        "fred" => Ok(Box::new(fred::FredSource::new(
            if api_base_url.is_empty() {
                "https://api.stlouisfed.org/fred".to_string()
            } else {
                api_base_url
            },
            api_key,
        ))),
        "world_bank" => Ok(Box::new(world_bank::WorldBankSource::new(
            if api_base_url.is_empty() {
                "https://api.worldbank.org".to_string()
            } else {
                api_base_url
            },
            api_key,
        ))),
        "imf" => Ok(Box::new(imf::IMFSource::new(
            if api_base_url.is_empty() {
                "https://sdmxcentral.imf.org".to_string()
            } else {
                api_base_url
            },
            api_key,
        ))),
        "nbs" => Ok(Box::new(nbs::NBSSource::new(
            if api_base_url.is_empty() {
                "https://data.stats.gov.cn".to_string()
            } else {
                api_base_url
            },
            api_key,
        ))),
        "oecd" => Ok(Box::new(oecd::OECDSoure::new(
            if api_base_url.is_empty() {
                "https://sdmx.oecd.org".to_string()
            } else {
                api_base_url
            },
            api_key,
        ))),
        "eurostat" => Ok(Box::new(eurostat::EurostatSource::new(
            if api_base_url.is_empty() {
                "https://ec.europa.eu/eurostat/api".to_string()
            } else {
                api_base_url
            },
            api_key,
        ))),
        "google_trends" => Ok(Box::new(google_trends::GoogleTrendsSource::new(
            ai_client,
            api_key,
        ))),
        "yfinance" => Ok(Box::new(yfinance::YFinanceSource::new(
            ai_client,
            api_key,
        ))),
        "news" => Ok(Box::new(news::NewsSource::new())),
        other => Err(format!("Unknown data source: {}", other)),
    }
}
