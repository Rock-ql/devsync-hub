use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Requirement {
    pub id: i32,
    pub iteration_id: i32,
    pub name: String,
    pub requirement_code: String,
    pub environment: String,
    pub link: String,
    pub status: String,
    pub branch: String,
    pub state: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequirementProject {
    pub id: i32,
    pub requirement_id: i32,
    pub project_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementListReq {
    pub iteration_id: i32,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementPageReq {
    pub iteration_id: i32,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementAddReq {
    pub iteration_id: i32,
    pub name: String,
    #[serde(default)]
    pub requirement_code: Option<String>,
    #[serde(default)]
    pub environment: Option<String>,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub project_ids: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementUpdateReq {
    pub id: i32,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub requirement_code: Option<String>,
    #[serde(default)]
    pub environment: Option<String>,
    #[serde(default)]
    pub link: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub branch: Option<String>,
    #[serde(default)]
    pub project_ids: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementStatusUpdateReq {
    pub id: i32,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementDeleteReq {
    pub id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementMigrateReq {
    pub requirement_ids: Vec<i32>,
    pub target_iteration_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementLinkReq {
    pub requirement_id: i32,
    pub link_type: String,
    pub link_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementDetailRsp {
    #[serde(flatten)]
    pub requirement: Requirement,
    pub project_ids: Vec<i32>,
    pub project_names: Vec<String>,
    pub sql_count: i64,
    pub commit_count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RequirementCommitListReq {
    pub requirement_id: i32,
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RequirementCommitRsp {
    pub id: i32,
    pub project_id: i32,
    pub project_name: String,
    pub commit_id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub committed_at: String,
    pub additions: i32,
    pub deletions: i32,
    pub branch: String,
}

