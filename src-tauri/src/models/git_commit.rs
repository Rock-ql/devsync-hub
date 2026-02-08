use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GitCommit {
    pub id: i32,
    pub project_id: i32,
    pub commit_id: String,
    pub message: String,
    pub author_name: String,
    pub author_email: String,
    pub committed_at: String,
    pub additions: i32,
    pub deletions: i32,
    pub branch: String,
    pub state: i32,
    pub created_at: String,
}
