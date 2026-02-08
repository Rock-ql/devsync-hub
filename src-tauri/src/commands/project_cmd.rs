use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::models::project::*;
use crate::models::common::PageResult;
use crate::models::git_commit::GitCommit;
use crate::services::project_service;
use crate::clients::gitlab_client::GitLabClient;

#[tauri::command]
pub async fn list_projects(state: State<'_, AppState>, req: ProjectListReq) -> AppResult<PageResult<Project>> {
    let db = state.db.lock().await;
    project_service::list_projects(&db.conn, &req)
}

#[tauri::command]
pub async fn list_all_projects(state: State<'_, AppState>) -> AppResult<Vec<Project>> {
    let db = state.db.lock().await;
    project_service::list_all_projects(&db.conn)
}

#[tauri::command]
pub async fn get_project_detail(state: State<'_, AppState>, id: i32) -> AppResult<ProjectDetailRsp> {
    let db = state.db.lock().await;
    project_service::get_project_detail(&db.conn, id)
}

#[tauri::command]
pub async fn add_project(state: State<'_, AppState>, req: ProjectAddReq) -> AppResult<i32> {
    let db = state.db.lock().await;
    project_service::add_project(&db.conn, &req)
}

#[tauri::command]
pub async fn update_project(state: State<'_, AppState>, req: ProjectUpdateReq) -> AppResult<()> {
    let db = state.db.lock().await;
    project_service::update_project(&db.conn, &req)
}

#[tauri::command]
pub async fn delete_project(state: State<'_, AppState>, id: i32) -> AppResult<()> {
    let db = state.db.lock().await;
    project_service::delete_project(&db.conn, id)
}

#[tauri::command]
pub async fn sync_commits(state: State<'_, AppState>, id: i32) -> AppResult<i32> {
    // Phase 1: Read project info from DB (sync)
    let (gitlab_url, token, gitlab_project_id) = {
        let db = state.db.lock().await;
        project_service::sync_commits_prepare(&db.conn, id)?
    }; // DB lock dropped here

    // Phase 2: Fetch from GitLab (async, no DB lock held)
    let client = GitLabClient::new(&gitlab_url, &token);
    let branches = client.list_branches(gitlab_project_id).await?;
    let mut branch_commits = Vec::new();
    for branch in &branches {
        let commits = client.list_commits(gitlab_project_id, &branch.name, 100).await?;
        branch_commits.push((branch.name.clone(), commits));
    }

    // Phase 3: Insert commits into DB (sync)
    let db = state.db.lock().await;
    project_service::sync_commits_insert(&db.conn, id, &branch_commits)
}

#[tauri::command]
pub async fn get_commits(state: State<'_, AppState>, project_id: i32) -> AppResult<Vec<GitCommit>> {
    let db = state.db.lock().await;
    project_service::get_commits(&db.conn, project_id)
}

#[tauri::command]
pub async fn list_gitlab_branches(state: State<'_, AppState>, req: GitLabBranchReq) -> AppResult<Vec<String>> {
    // Phase 1: Read config from DB (sync)
    let (url, token, pid) = {
        let db = state.db.lock().await;
        project_service::list_gitlab_branches_prepare(&db.conn, &req)?
    }; // DB lock dropped here

    // Phase 2: Fetch branches from GitLab (async, no DB lock held)
    let client = GitLabClient::new(&url, &token);
    let branches = client.list_branches(pid).await?;
    Ok(branches.into_iter().map(|b| b.name).collect())
}
