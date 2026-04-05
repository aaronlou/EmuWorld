use async_trait::async_trait;

use super::{DataSource, Observation};

pub struct YFinanceSource {
    ai_service_url: String,
    _api_key: String,
}

impl YFinanceSource {
    pub fn new(ai_service_url: String, api_key: String) -> Self {
        Self { ai_service_url, _api_key: api_key }
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
        let url = format!(
            "{}/agent/fetch",
            self.ai_service_url.trim_end_matches('/')
        );

        let payload = serde_json::json!({
            "source": "yfinance",
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
                    let date = chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d").ok();

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
            ("^GSPC", "S&P 500 Index", "equity"),
            ("^DJI", "Dow Jones Industrial Average", "equity"),
            ("^IXIC", "NASDAQ Composite", "equity"),
            ("^N225", "Nikkei 225 (Japan)", "equity"),
            ("^FTSE", "FTSE 100 (UK)", "equity"),
            ("^HSI", "Hang Seng Index (Hong Kong)", "equity"),
            ("000001.SS", "SSE Composite Index (Shanghai)", "equity"),
            ("^VIX", "CBOE Volatility Index (VIX)", "volatility"),
            ("EURUSD=X", "EUR/USD Exchange Rate", "forex"),
            ("GBPUSD=X", "GBP/USD Exchange Rate", "forex"),
            ("USDJPY=X", "USD/JPY Exchange Rate", "forex"),
            ("USDCNY=X", "USD/CNY Exchange Rate", "forex"),
            ("GC=F", "Gold Futures", "commodity"),
            ("CL=F", "Crude Oil WTI Futures", "commodity"),
            ("SI=F", "Silver Futures", "commodity"),
            ("^TNX", "US 10-Year Treasury Yield", "bond"),
            ("^TYX", "US 30-Year Treasury Yield", "bond"),
            ("BTC-USD", "Bitcoin / USD", "crypto"),
            ("ETH-USD", "Ethereum / USD", "crypto"),
        ]
    }
}
