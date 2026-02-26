use tauri::State;
use crate::AppState;
use crate::error::AppResult;
use crate::models::project::*;
use crate::models::common::PageResult;
use crate::models::git_commit::GitCommit;
use crate::services::project_service;
use crate::clients::gitlab_client::GitLabClient;
use crate::axum_gateway::sse;
use serde::Serialize;


#[derive(Debug, Serialize)]
struct ProjectSyncSsePayload {
    project_id: i32,
    project_name: String,
    stage: String,
    message: String,
    percent: i32,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    added_count: Option<i32>,
}

fn emit_project_sync(payload: &ProjectSyncSsePayload) {
    let data = serde_json::to_string(payload).unwrap_or_default();
    sse::publish("project_sync", &data);
}

fn emit_project_sync_if_enabled(enabled: bool, payload: &ProjectSyncSsePayload) {
    if enabled {
        emit_project_sync(payload);
    }
}

pub(crate) async fn sync_project_commits_internal(state: &AppState, id: i32, emit_events: bool) -> AppResult<i32> {
    let mut project_name = format!("#{}", id);

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "prepare".into(),
            message: "准备同步提交...".into(),
            percent: 0,
            status: "running".into(),
            added_count: None,
        },
    );

    // Phase 1: Read project info from DB (sync)
    let (gitlab_url, token, gitlab_project_id, gitlab_branch, name) = {
        let db = state.db.lock().await;
        project_service::sync_commits_prepare(&db.conn, id).map_err(|e| {
            emit_project_sync_if_enabled(
                emit_events,
                &ProjectSyncSsePayload {
                    project_id: id,
                    project_name: project_name.clone(),
                    stage: "error".into(),
                    message: format!("同步准备失败：{}", e),
                    percent: 100,
                    status: "error".into(),
                    added_count: None,
                },
            );
            e
        })?
    }; // DB lock dropped here

    project_name = name;

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "fetch".into(),
            message: "正在从 GitLab 拉取提交...".into(),
            percent: 30,
            status: "running".into(),
            added_count: None,
        },
    );

    // Phase 2: Fetch from GitLab (async, no DB lock held)
    let client = GitLabClient::new(&gitlab_url, &token);
    let branch = if gitlab_branch.trim().is_empty() { "main".to_string() } else { gitlab_branch };
    let commits = client
        .list_commits(gitlab_project_id, &branch, 100)
        .await
        .map_err(|e| {
            emit_project_sync_if_enabled(
                emit_events,
                &ProjectSyncSsePayload {
                    project_id: id,
                    project_name: project_name.clone(),
                    stage: "error".into(),
                    message: format!("GitLab 拉取失败：{}", e),
                    percent: 100,
                    status: "error".into(),
                    added_count: None,
                },
            );
            e
        })?;

    let commit_shas: Vec<String> = commits.iter().map(|item| item.id.clone()).collect();

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "store".into(),
            message: format!("已获取 {} 条提交，写入数据库...", commits.len()),
            percent: 70,
            status: "running".into(),
            added_count: None,
        },
    );

    let branch_commits = vec![(branch, commits)];

    // Phase 3: Insert commits into DB (sync)
    let db = state.db.lock().await;
    let added_count = project_service::sync_commits_insert(&db.conn, id, &branch_commits).map_err(|e| {
        emit_project_sync_if_enabled(
            emit_events,
            &ProjectSyncSsePayload {
                project_id: id,
                project_name: project_name.clone(),
                stage: "error".into(),
                message: format!("写入数据库失败：{}", e),
                percent: 100,
                status: "error".into(),
                added_count: None,
            },
        );
        e
    })?;

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "link".into(),
            message: "正在匹配需求并更新关联...".into(),
            percent: 85,
            status: "running".into(),
            added_count: Some(added_count),
        },
    );

    let linked_count = project_service::link_synced_commits_to_requirements(&db.conn, id, &commit_shas).unwrap_or(0);

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "done".into(),
            message: format!("同步完成：新增 {} 条提交，关联 {} 条提交记录", added_count, linked_count),
            percent: 100,
            status: "done".into(),
            added_count: Some(added_count),
        },
    );

    Ok(added_count)
}

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
    sync_project_commits_internal(state.inner(), id, true).await
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
