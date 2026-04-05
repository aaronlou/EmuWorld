use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct CensusSource {
    api_base_url: String,
    api_key: String,
}

impl CensusSource {
    pub fn new(api_base_url: String, api_key: String) -> Self {
        Self { api_base_url, api_key }
    }
}

#[async_trait]
impl DataSource for CensusSource {
    fn name(&self) -> &str {
        "census"
    }

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        let key = if self.api_key.is_empty() { "demo" } else { &self.api_key };
        let url = format!(
            "https://api.stlouisfed.org/fred/series/observations?series_id={}&api_key={}&file_type=json",
            external_id, key
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).send().await?;
        let body: serde_json::Value = resp.json().await?;

        let mut result = Vec::new();
        for o in body.get("observations").and_then(|a| a.as_array()).into_iter().flatten() {
            if let (Some(date), Some(val_str)) = (
                o.get("date").and_then(|d| d.as_str()),
                o.get("value").and_then(|v| v.as_str()),
            ) {
                if val_str == "." {
                    continue;
                }
                if let (Ok(d), Ok(v)) = (
                    chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d"),
                    val_str.parse::<f64>(),
                ) {
                    result.push(Observation { date: d, value: v });
                }
            }
        }

        Ok(result)
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![
            ("RSMNS", "US Total Retail Sales", "retail"),
            ("RSXFS", "US Retail & Food Services Excl Food", "retail"),
            ("RSAFS", "US Total Retail & Food Services", "retail"),
            ("R44X45", "US Retail Excl General Merchandise Stores", "retail"),
            ("R452", "US General Merchandise Stores", "retail"),
            ("RSM44X452P453", "US Nonstore Retailers (E-commerce)", "ecommerce"),
            ("R448", "US Clothing & Accessories Stores", "retail"),
            ("R445", "US Health & Personal Care Stores", "retail"),
            ("R442", "US Furniture & Home Furnishings", "retail"),
            ("R443", "US Electronics & Appliances", "retail"),
            ("R441", "US Motor Vehicle & Parts Dealers", "retail"),
            ("R722", "US Food Services & Drinking Places", "retail"),
        ]
    }
}
