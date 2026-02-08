use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiKey {
    pub id: i32,
    pub name: String,
    pub key_hash: String,
    pub key_prefix: String,
    pub last_used_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyCreateReq {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApiKeyCreateRsp {
    pub id: i32,
    pub name: String,
    pub key: String,
    pub key_prefix: String,
}
