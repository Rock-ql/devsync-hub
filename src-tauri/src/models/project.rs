use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Project {
    pub id: i32,
    pub name: String,
    pub description: String,
    pub gitlab_url: String,
    pub gitlab_token: String,
    pub gitlab_project_id: i32,
    pub gitlab_branch: String,
    pub enabled: i32,
    pub state: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectListReq {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectAddReq {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub gitlab_url: Option<String>,
    #[serde(default)]
    pub gitlab_token: Option<String>,
    #[serde(default)]
    pub gitlab_project_id: Option<i32>,
    #[serde(default)]
    pub gitlab_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectUpdateReq {
    pub id: i32,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub gitlab_url: Option<String>,
    #[serde(default)]
    pub gitlab_token: Option<String>,
    #[serde(default)]
    pub gitlab_project_id: Option<i32>,
    #[serde(default)]
    pub gitlab_branch: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectDetailRsp {
    #[serde(flatten)]
    pub project: Project,
    pub iteration_count: i64,
    pub pending_sql_count: i64,
    pub has_gitlab_config: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectEnabledUpdateReq {
    pub id: i32,
    pub enabled: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLabBranchReq {
    #[serde(default)]
    pub project_id: Option<i32>,
    #[serde(default)]
    pub gitlab_url: Option<String>,
    #[serde(default)]
    pub gitlab_token: Option<String>,
    #[serde(default)]
    pub gitlab_project_id: Option<i32>,
}
