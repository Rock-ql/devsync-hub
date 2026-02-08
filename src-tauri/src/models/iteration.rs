use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Iteration {
    pub id: i32,
    pub project_id: i32,
    pub name: String,
    pub description: String,
    pub status: String,
    pub start_date: String,
    pub end_date: String,
    pub state: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IterationProject {
    pub id: i32,
    pub iteration_id: i32,
    pub project_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IterationListReq {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub project_id: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IterationAddReq {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub project_ids: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IterationUpdateReq {
    pub id: i32,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub project_ids: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IterationDetailRsp {
    #[serde(flatten)]
    pub iteration: Iteration,
    pub project_ids: Vec<i32>,
    pub project_names: Vec<String>,
    pub requirement_count: i64,
    pub pending_sql_count: i64,
}
