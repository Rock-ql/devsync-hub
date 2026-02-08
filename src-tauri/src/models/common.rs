use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PageReq {
    #[serde(default = "default_page")]
    pub page: i64,
    #[serde(default = "default_size")]
    pub size: i64,
}

fn default_page() -> i64 { 1 }
fn default_size() -> i64 { 20 }

#[derive(Debug, Serialize, Deserialize)]
pub struct PageResult<T> {
    pub records: Vec<T>,
    pub total: i64,
    pub page: i64,
    pub size: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IdReq {
    pub id: i32,
}
