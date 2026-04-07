use async_trait::async_trait;
use sqlx::Row;

use crate::{
    models::{CreateNewsArticleRequest, NewsArticle, NewsQuery},
    repo::{NewsRepo, RepoError, Result},
};

use super::PostgresRepo;

#[async_trait]
impl NewsRepo for PostgresRepo {
    async fn create_news_article(&self, article: &CreateNewsArticleRequest) -> Result<NewsArticle> {
        let row = sqlx::query(
            "INSERT INTO news_articles (source_name, title, url, description, content, author, published_at, category, language, country, sentiment_score, entities) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
        )
        .bind(&article.source_name)
        .bind(&article.title)
        .bind(&article.url)
        .bind(&article.description)
        .bind(&article.content)
        .bind(&article.author)
        .bind(&article.published_at)
        .bind(&article.category)
        .bind(article.language.as_deref().unwrap_or("en"))
        .bind(article.country.as_deref().unwrap_or("us"))
        .bind(article.sentiment_score)
        .bind(article.entities.as_ref())
        .fetch_one(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;

        let id: i64 = row.get::<i32, _>("id").into();
        self.get_news_article(id)
            .await?
            .ok_or_else(|| RepoError::NotFound(format!("news article {}", id)))
    }

    async fn list_news(&self, query: &NewsQuery) -> Result<Vec<NewsArticle>> {
        let mut sql = String::from(
            "SELECT id::bigint AS id, source_name, title, url, description, content, author, published_at, category, language, country, fetched_at, sentiment_score, entities, processed_at \
             FROM news_articles WHERE 1=1",
        );

        if query.source.is_some() {
            sql.push_str(" AND source_name = $1");
        }
        if query.category.is_some() {
            sql.push_str(if query.source.is_some() { " AND category = $2" } else { " AND category = $1" });
        }
        if query.from_date.is_some() {
            let param = match (&query.source, &query.category) {
                (Some(_), Some(_)) => "$3",
                (Some(_), None) | (None, Some(_)) => "$2",
                (None, None) => "$1",
            };
            sql.push_str(&format!(" AND published_at >= {}", param));
        }
        if query.to_date.is_some() {
            let param_count = [&query.source, &query.category, &query.from_date]
                .iter()
                .filter(|o| o.is_some())
                .count() + 1;
            sql.push_str(&format!(" AND published_at <= ${}", param_count));
        }
        if query.min_sentiment.is_some() {
            let param_count = [&query.source, &query.category, &query.from_date, &query.to_date]
                .iter()
                .filter(|o| o.is_some())
                .count() + 1;
            sql.push_str(&format!(" AND sentiment_score >= ${}", param_count));
        }

        sql.push_str(&format!(
            " ORDER BY published_at DESC LIMIT {} OFFSET {}",
            query.limit, query.offset
        ));

        let mut q = sqlx::query_as::<_, NewsArticle>(&sql);

        if let Some(ref source) = query.source {
            q = q.bind(source);
        }
        if let Some(ref category) = query.category {
            q = q.bind(category);
        }
        if let Some(ref from_date) = query.from_date {
            q = q.bind(from_date);
        }
        if let Some(ref to_date) = query.to_date {
            q = q.bind(to_date);
        }
        if let Some(min_s) = query.min_sentiment {
            q = q.bind(min_s);
        }

        q.fetch_all(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_news_article(&self, id: i64) -> Result<Option<NewsArticle>> {
        sqlx::query_as::<_, NewsArticle>(
            "SELECT id::bigint AS id, source_name, title, url, description, content, author, published_at, category, language, country, fetched_at, sentiment_score, entities, processed_at \
             FROM news_articles WHERE id = $1",
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn get_news_by_url(&self, url: &str) -> Result<Option<NewsArticle>> {
        sqlx::query_as::<_, NewsArticle>(
            "SELECT id::bigint AS id, source_name, title, url, description, content, author, published_at, category, language, country, fetched_at, sentiment_score, entities, processed_at \
             FROM news_articles WHERE url = $1",
        )
        .bind(url)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))
    }

    async fn delete_news_article(&self, id: i64) -> Result<()> {
        sqlx::query("DELETE FROM news_articles WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await
            .map_err(|e| RepoError::Database(e.to_string()))?;
        Ok(())
    }

    async fn batch_upsert_news(&self, articles: &[CreateNewsArticleRequest]) -> Result<usize> {
        let mut count = 0;
        for article in articles {
            let existing = self.get_news_by_url(&article.url).await?;
            if existing.is_none() {
                self.create_news_article(article).await?;
                count += 1;
            }
        }
        Ok(count)
    }

    async fn update_news_nlp(&self, id: i64, sentiment_score: f64, entities: serde_json::Value) -> Result<()> {
        sqlx::query(
            "UPDATE news_articles SET sentiment_score = $1, entities = $2, processed_at = NOW() WHERE id = $3",
        )
        .bind(sentiment_score)
        .bind(entities)
        .bind(id)
        .execute(&self.pool)
        .await
        .map_err(|e| RepoError::Database(e.to_string()))?;
        Ok(())
    }
}
