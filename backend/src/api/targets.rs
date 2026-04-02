use axum::{routing::get, Router};
use std::sync::Arc;

use crate::repo::AppRepo;

pub fn router() -> Router<Arc<dyn AppRepo>> {
    Router::new().route("/targets/list", get(super::predictions::list_targets))
}
