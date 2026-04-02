use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct FredSource {
    api_base_url: String,
    api_key: String,
}

impl FredSource {
    pub fn new(api_base_url: String, api_key: String) -> Self {
        Self { api_base_url, api_key }
    }
}

#[async_trait]
impl DataSource for FredSource {
    fn name(&self) -> &str {
        "fred"
    }

    fn base_url(&self) -> &str {
        &self.api_base_url
    }

    fn api_key(&self) -> &str {
        &self.api_key
    }

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "{}/series/observations?series_id={}&api_key={}&file_type=json",
            self.api_base_url, external_id, self.api_key
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).send().await?;
        let observations: Vec<serde_json::Value> = resp.json().await?;

        let mut result = Vec::new();
        for obs in observations {
            if obs["date"].is_null() || obs["value"].is_null() {
                continue;
            }
            let date_str = obs["date"].as_str().unwrap();
            let value_str = obs["value"].as_str().unwrap();
            if value_str == "." {
                continue;
            }
            let value: f64 = value_str.parse().unwrap_or(0.0);
            let date = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d")?;
            result.push(Observation { date, value });
        }

        Ok(result)
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![
            ("CPIAUCSL", "Consumer Price Index", "inflation"),
            ("UNRATE", "Unemployment Rate", "employment"),
            ("FEDFUNDS", "Federal Funds Rate", "interest_rate"),
            ("GDP", "Gross Domestic Product", "growth"),
            ("M2SL", "M2 Money Supply", "money_supply"),
            ("EXUSEU", "USD/EUR Exchange Rate", "exchange_rate"),
            ("HOUST", "Housing Starts", "real_estate"),
            ("CASHPIN", "S&P/Case-Shiller Home Price", "real_estate"),
            ("TOTALES", "Total Employment", "employment"),
            ("EXPIM", "Exports/Imports Ratio", "trade"),
        ]
    }
}
