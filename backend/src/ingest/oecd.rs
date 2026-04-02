use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct OECDSoure {
    api_base_url: String,
    api_key: String,
}

impl OECDSoure {
    pub fn new(api_base_url: String, api_key: String) -> Self {
        Self { api_base_url, api_key }
    }
}

#[async_trait]
impl DataSource for OECDSoure {
    fn name(&self) -> &str {
        "oecd"
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
            "{}/stats/v2/data/{}",
            self.api_base_url, external_id
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).header("Accept", "application/json").send().await?;
        let body: serde_json::Value = resp.json().await?;

        let mut result = Vec::new();

        if let Some(datasets) = body.get("dataSets").and_then(|d| d.as_array()) {
            for dataset in datasets {
                if let Some(observations) = dataset.get("observations") {
                    for (key, obs) in observations.as_object().unwrap_or(&serde_json::Map::new()) {
                        if let Some(val) = obs.get(0).and_then(|v| v.as_f64()) {
                            let parts: Vec<&str> = key.split(':').collect();
                            if let Some(period) = parts.last() {
                                if let Ok(year) = period.parse::<i32>() {
                                    let date = chrono::NaiveDate::from_ymd_opt(year, 1, 1).unwrap();
                                    result.push(Observation { date, value: val });
                                }
                            }
                        }
                    }
                }
            }
        }

        Ok(result)
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![
            ("CPCV01", "Consumer Price Index", "inflation"),
            ("GDPVONOBSA", "GDP Volume", "growth"),
            ("LOLITAASTN", "Unemployment Rate", "employment"),
            ("CXCPCV01", "Current Account", "trade"),
            ("MABMM301", "Money Supply M3", "money_supply"),
            ("CPGDPV", "GDP per Capita", "growth"),
            ("CIVPART", "Civilian Participation Rate", "employment"),
            ("P3300000", "House Prices", "real_estate"),
        ]
    }
}
