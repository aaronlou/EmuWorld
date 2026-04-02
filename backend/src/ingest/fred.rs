use sqlx::SqlitePool;

const FRED_API_BASE: &str = "https://api.stlouisfed.org/fred";

pub async fn sync_fred_series(
    pool: &SqlitePool,
    series_id: &str,
    dataset_id: i64,
    api_key: &str,
) -> Result<usize, Box<dyn std::error::Error>> {
    let url = format!(
        "{}/series/observations?series_id={}&api_key={}&file_type=json",
        FRED_API_BASE, series_id, api_key
    );

    let client = reqwest::Client::new();
    let resp = client.get(&url).send().await?;
    let observations: Vec<serde_json::Value> = resp.json().await?;

    let mut count = 0;
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

        let result = sqlx::query(
            "INSERT OR REPLACE INTO data_points (dataset_id, date, value) VALUES (?, ?, ?)"
        )
        .bind(dataset_id)
        .bind(date)
        .bind(value)
        .execute(pool)
        .await?;

        count += result.rows_affected() as usize;
    }

    Ok(count)
}

pub fn default_datasets() -> Vec<(&'static str, &'static str, &'static str, &'static str)> {
    vec![
        ("CPIAUCSL", "Consumer Price Index", "inflation", "FRED"),
        ("UNRATE", "Unemployment Rate", "employment", "FRED"),
        ("FEDFUNDS", "Federal Funds Rate", "interest_rate", "FRED"),
        ("GDP", "Gross Domestic Product", "growth", "FRED"),
        ("M2SL", "M2 Money Supply", "money_supply", "FRED"),
        ("EXUSEU", "USD/EUR Exchange Rate", "exchange_rate", "FRED"),
        ("HOUST", "Housing Starts", "real_estate", "FRED"),
        ("CASHPIN", "S&P/Case-Shiller Home Price", "real_estate", "FRED"),
        ("TOTALES", "Total Employment", "employment", "FRED"),
        ("EXPIM", "Exports/Imports Ratio", "trade", "FRED"),
    ]
}
