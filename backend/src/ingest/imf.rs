use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct IMFSource {
    api_base_url: String,
    _api_key: String,
}

impl IMFSource {
    pub fn new(api_base_url: String, api_key: String) -> Self {
        Self { api_base_url, _api_key: api_key }
    }
}

#[async_trait]
impl DataSource for IMFSource {
    fn name(&self) -> &str {
        "imf"
    }

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "{}/sdmx/v2/data/{}/all?format=compactdata",
            self.api_base_url, external_id
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).send().await?;
        let text = resp.text().await?;

        let mut result = Vec::new();
        let json: serde_json::Value = serde_json::from_str(&text).unwrap_or(serde_json::Value::Null);

        if let Some(data) = json.get("data") {
            if let Some(datasets) = data.as_array() {
                for dataset in datasets {
                    if let Some(observations) = dataset.get("observations").and_then(|o| o.as_array()) {
                        for obs in observations {
                            if let (Some(date), Some(val)) = (
                                obs.get("TIME_PERIOD").and_then(|d| d.as_str()),
                                obs.get("OBS_VALUE").and_then(|v| v.as_f64()),
                            ) {
                                if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d") {
                                    result.push(Observation { date: d, value: val });
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
            ("PCPI_PCPIEA", "Consumer Price Index", "inflation"),
            ("NGDP_RPCH", "Real GDP Growth", "growth"),
            ("LUR", "Unemployment Rate", "employment"),
            ("NGDP", "Gross Domestic Product", "growth"),
            ("BCA_NGDP", "Current Account Balance", "trade"),
            ("RAFA_NGDP", "Central Government Revenue", "fiscal"),
        ]
    }
}
