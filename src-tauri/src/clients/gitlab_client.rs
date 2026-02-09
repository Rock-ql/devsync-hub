use crate::error::{AppError, AppResult};
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};

pub struct GitLabClient {
    api_base_url: String,
    raw_gitlab_url: String,
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
    pub fn new(gitlab_url: &str, token: &str) -> Self {
        let raw_url = gitlab_url.trim().to_string();
        let api_base = parse_api_base_url(&raw_url);
        Self {
            api_base_url: api_base,
            raw_gitlab_url: raw_url,
            token: token.to_string(),
            http: reqwest::Client::new(),
        }
    }

    pub async fn list_branches(&self, project_id: i32) -> AppResult<Vec<GitLabBranch>> {
        let primary_identifier = self.resolve_project_identifier(project_id)?;
        match self.list_branches_by_identifier(&primary_identifier).await {
            Ok(branches) => Ok(branches),
            Err((status, body)) if should_retry_with_project_path(status, project_id) => {
                let fallback_identifier = self
                    .resolve_project_path_identifier()
                    .ok_or_else(|| self.format_api_error(status, body.clone()))?;

                if fallback_identifier == primary_identifier {
                    return Err(self.format_api_error(status, body));
                }

                self.list_branches_by_identifier(&fallback_identifier)
                    .await
                    .map_err(|(retry_status, retry_body)| self.format_api_error(retry_status, retry_body))
            }
            Err((status, body)) => Err(self.format_api_error(status, body)),
        }
    }

    pub async fn list_commits(&self, project_id: i32, branch: &str, per_page: i32) -> AppResult<Vec<GitLabCommit>> {
        let primary_identifier = self.resolve_project_identifier(project_id)?;
        match self
            .list_commits_by_identifier(&primary_identifier, branch, per_page)
            .await
        {
            Ok(commits) => Ok(commits),
            Err((status, body)) if should_retry_with_project_path(status, project_id) => {
                let fallback_identifier = self
                    .resolve_project_path_identifier()
                    .ok_or_else(|| self.format_api_error(status, body.clone()))?;

                if fallback_identifier == primary_identifier {
                    return Err(self.format_api_error(status, body));
                }

                self.list_commits_by_identifier(&fallback_identifier, branch, per_page)
                    .await
                    .map_err(|(retry_status, retry_body)| self.format_api_error(retry_status, retry_body))
            }
            Err((status, body)) => Err(self.format_api_error(status, body)),
        }
    }

    fn resolve_project_identifier(&self, project_id: i32) -> AppResult<String> {
        if project_id > 0 {
            return Ok(project_id.to_string());
        }
        self.resolve_project_path_identifier()
            .ok_or_else(|| AppError::BadRequest("GitLab repository URL format is invalid".into()))
    }

    fn resolve_project_path_identifier(&self) -> Option<String> {
        let project_path = parse_project_path(&self.raw_gitlab_url)?;
        Some(encode_url_component(&project_path))
    }

    fn format_api_error(&self, status: StatusCode, body: String) -> AppError {
        AppError::ExternalApi(format!(
            "GitLab API error {} (base: {}): {}",
            status, self.api_base_url, body
        ))
    }

    async fn list_branches_by_identifier(
        &self,
        project_identifier: &str,
    ) -> Result<Vec<GitLabBranch>, (StatusCode, String)> {
        let url = format!(
            "{}/projects/{}/repository/branches?per_page=100",
            self.api_base_url, project_identifier
        );
        let resp = self
            .http
            .get(&url)
            .header("PRIVATE-TOKEN", &self.token)
            .send()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("GitLab branches request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err((status, body));
        }

        resp.json::<Vec<GitLabBranch>>()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse branches: {}", e)))
    }

    async fn list_commits_by_identifier(
        &self,
        project_identifier: &str,
        branch: &str,
        per_page: i32,
    ) -> Result<Vec<GitLabCommit>, (StatusCode, String)> {
        let encoded_branch = encode_url_component(branch);
        let url = format!(
            "{}/projects/{}/repository/commits?ref_name={}&per_page={}&with_stats=true",
            self.api_base_url, project_identifier, encoded_branch, per_page
        );
        let resp = self
            .http
            .get(&url)
            .header("PRIVATE-TOKEN", &self.token)
            .send()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("GitLab commits request failed: {}", e)))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let body = resp.text().await.unwrap_or_default();
            return Err((status, body));
        }

        resp.json::<Vec<GitLabCommit>>()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, format!("Failed to parse commits: {}", e)))
    }
}

fn should_retry_with_project_path(status: StatusCode, project_id: i32) -> bool {
    project_id > 0 && (status == StatusCode::FORBIDDEN || status == StatusCode::NOT_FOUND)
}

fn parse_api_base_url(gitlab_url: &str) -> String {
    let mut cleaned = strip_query_and_hash(gitlab_url.trim()).trim_end_matches('/').to_string();
    if cleaned.ends_with(".git") {
        cleaned.truncate(cleaned.len().saturating_sub(4));
    }

    if let Some(idx) = cleaned.find("/api/v4") {
        let end = idx + "/api/v4".len();
        return cleaned[..end].trim_end_matches('/').to_string();
    }

    let host = extract_host_root(&cleaned);
    format!("{}/api/v4", host.trim_end_matches('/'))
}

fn parse_project_path(gitlab_url: &str) -> Option<String> {
    let mut cleaned = strip_query_and_hash(gitlab_url.trim()).trim_end_matches('/').to_string();
    if cleaned.ends_with(".git") {
        cleaned.truncate(cleaned.len().saturating_sub(4));
    }

    let path_start = if let Some(pos) = cleaned.find("://") {
        let after_scheme = pos + 3;
        cleaned[after_scheme..]
            .find('/')
            .map(|offset| after_scheme + offset + 1)
    } else {
        cleaned.find('/').map(|idx| idx + 1)
    }?;

    if path_start >= cleaned.len() {
        return None;
    }

    let mut path = cleaned[path_start..].to_string();
    if let Some(idx) = path.find("/-/") {
        path.truncate(idx);
    }
    let path = path.trim_matches('/');
    if path.is_empty() {
        None
    } else {
        Some(path.to_string())
    }
}

fn strip_query_and_hash(url: &str) -> &str {
    let query_idx = url.find('?').unwrap_or(url.len());
    let hash_idx = url.find('#').unwrap_or(url.len());
    let end = query_idx.min(hash_idx);
    &url[..end]
}

fn extract_host_root(url: &str) -> String {
    if let Some(pos) = url.find("://") {
        let after_scheme = pos + 3;
        if let Some(path_idx) = url[after_scheme..].find('/') {
            return url[..after_scheme + path_idx].to_string();
        }
        return url.to_string();
    }

    if let Some(path_idx) = url.find('/') {
        return url[..path_idx].to_string();
    }
    url.to_string()
}

fn encode_url_component(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    for byte in input.bytes() {
        if byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.' | b'~') {
            out.push(byte as char);
        } else {
            out.push('%');
            out.push(HEX[(byte >> 4) as usize] as char);
            out.push(HEX[(byte & 0x0f) as usize] as char);
        }
    }
    out
}
