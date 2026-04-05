use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct GoogleTrendsSource {
    ai_service_url: String,
    _api_key: String,
}

impl GoogleTrendsSource {
    pub fn new(ai_service_url: String, api_key: String) -> Self {
        Self { ai_service_url, _api_key: api_key }
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
        let url = format!(
            "{}/agent/fetch",
            self.ai_service_url.trim_end_matches('/')
        );

        let payload = serde_json::json!({
            "source": "google_trends",
            "series_id": external_id,
            "use_cache": false,
            "use_db": false,
            "use_api": true,
        });

        let client = reqwest::Client::new();
        let resp = client
            .post(&url)
            .json(&payload)
            .send()
            .await?;

        let body: serde_json::Value = resp.json().await?;

        if let Some(error) = body.get("error").and_then(|e| e.as_str()) {
            if !error.is_empty() {
                return Err(error.to_string().into());
            }
        }

        let mut result = Vec::new();

        if let Some(points) = body.get("data").and_then(|d| d.as_array()) {
            for point in points {
                if let (Some(date_str), Some(val)) = (
                    point.get("date").and_then(|d| d.as_str()),
                    point.get("value").and_then(|v| v.as_f64()),
                ) {
                    let date = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d").ok()
                        .or_else(|| {
                            chrono::NaiveDate::parse_from_str(&format!("{date_str}-01"), "%Y-%m-%d").ok()
                        });

                    if let Some(d) = date {
                        result.push(Observation { date: d, value: val });
                    }
                }
            }
        }

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
