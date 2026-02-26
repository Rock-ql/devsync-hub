use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Report {
    pub id: i32,
    pub r#type: String,
    pub title: String,
    pub content: String,
    pub start_date: String,
    pub end_date: String,
    pub commit_summary: String,
    pub state: i32,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReportTemplate {
    pub id: i32,
    pub r#type: String,
    pub name: String,
    pub content: String,
    pub is_default: bool,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportListReq {
    #[serde(default)]
    pub page: Option<i64>,
    #[serde(default)]
    pub size: Option<i64>,
    #[serde(default)]
    pub r#type: Option<String>,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportGenerateReq {
    pub r#type: String,
    pub start_date: String,
    pub end_date: String,
    #[serde(default)]
    pub force: bool,
    #[serde(default)]
    pub append_existing: bool,
    #[serde(default)]
    pub author_email: Option<String>,
    #[serde(default)]
    pub project_ids: Option<Vec<i32>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportUpdateReq {
    pub id: i32,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportMonthSummaryReq {
    pub year: i32,
    pub month: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MonthSummaryRsp {
    pub daily_reports: Vec<ReportBrief>,
    pub weekly_reports: Vec<ReportBrief>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ReportBrief {
    pub id: i32,
    pub title: String,
    pub start_date: String,
    pub end_date: String,
    pub created_at: String,
}
