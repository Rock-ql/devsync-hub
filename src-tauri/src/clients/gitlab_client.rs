use crate::error::{AppError, AppResult};
use serde::{Deserialize, Serialize};

pub struct GitLabClient {
    base_url: String,
    token: String,
    http: reqwest::Client,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLabBranch {
    pub name: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct GitLabCommit {
    pub id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub committed_date: String,
    #[serde(default)]
    pub stats: CommitStats,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct CommitStats {
    #[serde(default)]
    pub additions: i32,
    #[serde(default)]
    pub deletions: i32,
}

impl GitLabClient {
    pub fn new(base_url: &str, token: &str) -> Self {
        let url = base_url.trim_end_matches('/');
        let api_base = if url.contains("/api/v4") {
            url.to_string()
        } else {
            format!("{}/api/v4", url)
        };
        Self {
            base_url: api_base,
            token: token.to_string(),
            http: reqwest::Client::new(),
        }
    }

    pub async fn list_branches(&self, project_id: i32) -> AppResult<Vec<GitLabBranch>> {
        let url = format!("{}/projects/{}/repository/branches?per_page=100", self.base_url, project_id);
        let resp = self.http.get(&url)
            .header("PRIVATE-TOKEN", &self.token)
            .send()
            .await
            .map_err(|e| AppError::ExternalApi(format!("GitLab branches request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi(format!("GitLab API error {}: {}", status, body)));
        }

        resp.json::<Vec<GitLabBranch>>()
            .await
            .map_err(|e| AppError::ExternalApi(format!("Failed to parse branches: {}", e)))
    }

    pub async fn list_commits(&self, project_id: i32, branch: &str, per_page: i32) -> AppResult<Vec<GitLabCommit>> {
        let url = format!(
            "{}/projects/{}/repository/commits?ref_name={}&per_page={}&with_stats=true",
            self.base_url, project_id, branch, per_page
        );
        let resp = self.http.get(&url)
            .header("PRIVATE-TOKEN", &self.token)
            .send()
            .await
            .map_err(|e| AppError::ExternalApi(format!("GitLab commits request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi(format!("GitLab API error {}: {}", status, body)));
        }

        resp.json::<Vec<GitLabCommit>>()
            .await
            .map_err(|e| AppError::ExternalApi(format!("Failed to parse commits: {}", e)))
    }
}
