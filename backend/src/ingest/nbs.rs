use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct NBSSource {
    api_base_url: String,
    _api_key: String,
}

impl NBSSource {
    pub fn new(api_base_url: String, api_key: String) -> Self {
        Self { api_base_url, _api_key: api_key }
    }
}

#[async_trait]
impl DataSource for NBSSource {
    fn name(&self) -> &str {
        "nbs"
    }

    async fn fetch_series(
        &self,
        external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        let url = format!(
            "{}/api/data?code={}",
            self.api_base_url, external_id
        );

        let client = reqwest::Client::new();
        let resp = client.get(&url).send().await?;
        let body: serde_json::Value = resp.json().await?;

        let mut result = Vec::new();

        if let Some(data) = body.get("data").and_then(|d| d.as_array()) {
            for item in data {
                if let (Some(date), Some(val)) = (
                    item.get("sj").and_then(|d| d.as_str()),
                    item.get("data").and_then(|v| v.as_f64()),
                ) {
                    if let Ok(d) = chrono::NaiveDate::parse_from_str(date, "%Y-%m") {
                        result.push(Observation { date: d, value: val });
                    }
                }
            }
        }

        Ok(result)
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![
            ("A0201000101", "居民消费价格指数(CPI)", "inflation"),
            ("A0201000102", "工业生产者出厂价格指数(PPI)", "inflation"),
            ("A0201000103", "工业增加值增速", "growth"),
            ("A0201000104", "采购经理指数(PMI)", "growth"),
            ("A0201000105", "城镇调查失业率", "employment"),
            ("A0201000106", "社会消费品零售总额", "growth"),
            ("A0201000107", "固定资产投资(不含农户)", "growth"),
            ("A0201000108", "进出口总额", "trade"),
            ("A0201000109", "房地产开发投资", "real_estate"),
            ("A0201000110", "货币供应量(M2)", "money_supply"),
            ("A0201000111", "国内生产总值(GDP)", "growth"),
            ("A0201000112", "70个大中城市新建商品住宅价格指数", "real_estate"),
        ]
    }
}
