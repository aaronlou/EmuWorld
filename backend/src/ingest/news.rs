use async_trait::async_trait;
use chrono::{NaiveDateTime, Utc};
use rss::Channel;

use super::{DataSource, Observation};

pub struct NewsSource {
    feeds: Vec<FeedConfig>,
}

struct FeedConfig {
    name: String,
    url: String,
    category: String,
}

impl NewsSource {
    pub fn new() -> Self {
        let feeds = vec![
            FeedConfig {
                name: "Reuters".to_string(),
                url: "https://www.reutersagency.com/feed/?best-topics=business-finance".to_string(),
                category: "finance".to_string(),
            },
            FeedConfig {
                name: "BBC World".to_string(),
                url: "http://feeds.bbci.co.uk/news/world/rss.xml".to_string(),
                category: "world".to_string(),
            },
            FeedConfig {
                name: "WSJ".to_string(),
                url: "https://feeds.a.dj.com/rss/RSSMarketsMain.xml".to_string(),
                category: "finance".to_string(),
            },
            FeedConfig {
                name: "Bloomberg".to_string(),
                url: "https://feeds.bloomberg.com/markets/news.rss".to_string(),
                category: "finance".to_string(),
            },
            FeedConfig {
                name: "Financial Times".to_string(),
                url: "https://www.ft.com/rss/home".to_string(),
                category: "finance".to_string(),
            },
            FeedConfig {
                name: "CNBC".to_string(),
                url: "https://www.cnbc.com/id/100003114/device/rss/rss.html".to_string(),
                category: "finance".to_string(),
            },
        ];
        Self { feeds }
    }

    pub async fn fetch_all_feeds(&self) -> Result<Vec<NewsItem>, Box<dyn std::error::Error + Send + Sync>> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        let mut all_items = Vec::new();

        for feed_config in &self.feeds {
            match Self::fetch_feed(&client, &feed_config.url).await {
                Ok(items) => {
                    for item in items {
                        all_items.push(NewsItem {
                            source_name: feed_config.name.clone(),
                            title: item.title,
                            url: item.url,
                            description: item.description,
                            content: item.content,
                            author: item.author,
                            published_at: item.published_at,
                            category: Some(feed_config.category.clone()),
                        });
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to fetch {}: {}", feed_config.name, e);
                }
            }
        }

        Ok(all_items)
    }

    async fn fetch_feed(
        client: &reqwest::Client,
        url: &str,
    ) -> Result<Vec<ParsedItem>, Box<dyn std::error::Error + Send + Sync>> {
        let response = client.get(url).send().await?;
        let body = response.bytes().await?;
        let channel = Channel::read_from(&body[..])?;

        let mut items = Vec::new();
        for entry in channel.items() {
            let title = entry.title().unwrap_or("").to_string();
            let url = entry.link().unwrap_or("").to_string();
            let description = entry.description().map(|s| s.to_string());
            let content = entry.content().map(|c| c.to_string());
            let author = entry.author().map(|s| s.to_string());
            let published_at = entry.pub_date()
                .and_then(|s| chrono::DateTime::parse_from_rfc2822(s).ok())
                .map(|dt| dt.naive_utc())
                .unwrap_or_else(|| Utc::now().naive_utc());

            if !title.is_empty() && !url.is_empty() {
                items.push(ParsedItem {
                    title,
                    url,
                    description,
                    content,
                    author,
                    published_at,
                });
            }
        }

        Ok(items)
    }
}

impl Default for NewsSource {
    fn default() -> Self {
        Self::new()
    }
}

struct ParsedItem {
    title: String,
    url: String,
    description: Option<String>,
    content: Option<String>,
    author: Option<String>,
    published_at: NaiveDateTime,
}

pub struct NewsItem {
    pub source_name: String,
    pub title: String,
    pub url: String,
    pub description: Option<String>,
    pub content: Option<String>,
    pub author: Option<String>,
    pub published_at: NaiveDateTime,
    pub category: Option<String>,
}

#[async_trait]
impl DataSource for NewsSource {
    fn name(&self) -> &str {
        "news"
    }

    async fn fetch_series(
        &self,
        _external_id: &str,
    ) -> Result<Vec<Observation>, Box<dyn std::error::Error + Send + Sync>> {
        Ok(Vec::new())
    }

    fn default_datasets(&self) -> Vec<(&'static str, &'static str, &'static str)> {
        vec![]
    }
}
