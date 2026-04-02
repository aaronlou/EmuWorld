use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct WorldBankSource {
    api_base_url: String,
    api_key: String,
}

impl WorldBankSource {
    pub fn new(api_base_url: String, api_key: String) -> Self {
        Self { api_base_url, api_key }
    }
}

#[async_trait]
impl DataSource for WorldBankSource {
    fn name(&self) -> &str {
        "world_bank"
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
            "{}/v2/country/all/indicator/{}?format=json&per_page=1000&date=1960:2030",
            self.api_base_url, external_id
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).send().await?;
        let body: Vec<serde_json::Value> = resp.json().await?;

        if body.len() < 2 {
            return Ok(Vec::new());
        }

        let data = &body[1];
        let mut result = Vec::new();

        if let Some(arr) = data.as_array() {
            for item in arr {
                if item["date"].is_null() || item["value"].is_null() {
                    continue;
                }
                let date_str = item["date"].as_str().unwrap();
                let value = item["value"].as_f64().unwrap_or(0.0);
                if let Ok(date) = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                    result.push(Observation { date, value });
                } else if let Ok(year) = date_str.parse::<i32>() {
                    let date = chrono::NaiveDate::from_ymd_opt(year, 1, 1).unwrap();
                    result.push(Observation { date, value });
                }
            }
        }

        Ok(result)
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![
            ("NY.GDP.MKTP.CD", "GDP (current US$)", "growth"),
            ("FP.CPI.TOTL.ZG", "Inflation, consumer prices", "inflation"),
            ("SL.UEM.TOTL.ZS", "Unemployment, total", "employment"),
            ("NY.GDP.PCAP.CD", "GDP per capita", "growth"),
            ("NE.EXP.GNFS.CD", "Exports of goods and services", "trade"),
            ("NE.IMP.GNFS.CD", "Imports of goods and services", "trade"),
            ("FM.LBL.BMNY.ZS", "Broad money (% of GDP)", "money_supply"),
            ("SP.POP.TOTL", "Population, total", "demographics"),
        ]
    }
}
