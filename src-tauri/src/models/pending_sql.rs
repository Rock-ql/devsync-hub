use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendingSql {
    pub id: i32,
    pub project_id: i32,
    pub iteration_id: i32,
    pub title: String,
    pub content: String,
    pub execution_order: i32,
    pub status: String,
    pub executed_at: Option<String>,
    pub executed_env: String,
    pub remark: String,
    pub state: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SqlEnvConfig {
    pub id: i32,
    pub project_id: i32,
    pub env_code: String,
    pub env_name: String,
    pub sort_order: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlEnvConfigListReq {
    pub project_id: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlEnvConfigAddReq {
    pub project_id: i32,
    pub env_code: String,
    pub env_name: String,
    #[serde(default)]
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlEnvConfigUpdateReq {
    pub id: i32,
    #[serde(default)]
    pub env_code: Option<String>,
    #[serde(default)]
    pub env_name: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SqlExecutionLog {
    pub id: i32,
    pub sql_id: i32,
    pub env: String,
    pub executed_at: String,
    pub executor: String,
    pub remark: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingSqlListReq {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub project_id: Option<i32>,
    #[serde(default)]
    pub iteration_id: Option<i32>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingSqlAddReq {
    pub project_id: i32,
    pub iteration_id: i32,
    pub title: String,
    pub content: String,
    #[serde(default)]
    pub execution_order: Option<i32>,
    #[serde(default)]
    pub remark: Option<String>,
    #[serde(default)]
    pub requirement_id: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingSqlUpdateReq {
    pub id: i32,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub execution_order: Option<i32>,
    #[serde(default)]
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingSqlExecuteReq {
    pub id: i32,
    pub env: String,
    #[serde(default)]
    pub executor: Option<String>,
    #[serde(default)]
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingSqlBatchExecuteReq {
    pub ids: Vec<i32>,
    pub env: String,
    #[serde(default)]
    pub executor: Option<String>,
    #[serde(default)]
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingSqlBatchDeleteReq {
    pub ids: Vec<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SqlExecutionRevokeReq {
    pub sql_id: i32,
    pub env: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnvExecution {
    pub env_code: String,
    pub env_name: String,
    pub executed: bool,
    pub executed_at: Option<String>,
    pub executor: Option<String>,
    pub remark: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PendingSqlDetailRsp {
    #[serde(flatten)]
    pub sql: PendingSql,
    pub project_name: String,
    pub iteration_name: String,
    pub env_executions: Vec<EnvExecution>,
    pub execution_status: String,
    pub completion_percent: f64,
    pub linked_requirement: Option<String>,
}
