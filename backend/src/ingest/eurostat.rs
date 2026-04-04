use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct EurostatSource {
    api_base_url: String,
    _api_key: String,
}

impl EurostatSource {
    pub fn new(api_base_url: String, api_key: String) -> Self {
        Self { api_base_url, _api_key: api_key }
    }
}

#[async_trait]
impl DataSource for EurostatSource {
    fn name(&self) -> &str {
        "eurostat"
    }

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "{}/data/{}?format=JSONv2.0",
            self.api_base_url, external_id
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).send().await?;
        let body: serde_json::Value = resp.json().await?;

        let mut result = Vec::new();

        if let Some(value) = body.get("value") {
            if let Some(label) = body.get("label") {
                let _series_name = label.as_str().unwrap_or("");
            }
            if let Some(values) = value.as_object() {
                for (key, val) in values {
                    if let Some(v) = val.as_f64() {
                        let parts: Vec<&str> = key.split(',').collect();
                        if let Some(period) = parts.last() {
                            if let Ok(year) = period.parse::<i32>() {
                                let date = chrono::NaiveDate::from_ymd_opt(year, 1, 1).unwrap();
                                result.push(Observation { date, value: v });
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
            ("prc_hicp_manr", "Harmonised Index of Consumer Prices", "inflation"),
            ("nama_10_gdp", "GDP and main components", "growth"),
            ("une_rt_a", "Unemployment by sex and age", "employment"),
            ("bop_eu6", "Balance of Payments", "trade"),
            ("m3_eur_m", "M3 Money Supply", "money_supply"),
            ("ei_bs_q_r", "Business Surveys", "growth"),
            ("ei_pmn_q_r", "PMI Composite", "growth"),
            ("prc_ppp_ind", "Purchasing Power Parities", "growth"),
        ]
    }
}
