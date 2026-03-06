use tauri::State;
use crate::AppState;
use crate::error::{AppError, AppResult};
use crate::models::project::*;
use crate::models::common::PageResult;
use crate::models::git_commit::GitCommit;
use crate::services::project_service;
use crate::clients::gitlab_client::{GitLabClient, GitLabCommit};
use crate::axum_gateway::sse;
use futures::stream::{self, StreamExt};
use serde::Serialize;
use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;

const BRANCH_SYNC_CONCURRENCY: usize = 4;
const COMMITS_PER_BRANCH: i32 = 100;

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

#[derive(Debug)]
struct BranchFetchResult {
    index: usize,
    branch_name: String,
    result: AppResult<Vec<GitLabCommit>>,
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

fn normalize_branch_names(mut branch_names: Vec<String>, configured_branch: &str) -> Vec<String> {
    if !branch_names.iter().any(|name| name == configured_branch) {
        branch_names.push(configured_branch.to_string());
    }
    if branch_names.is_empty() {
        branch_names.push(configured_branch.to_string());
    }

    let mut seen_branch = HashSet::new();
    let mut normalized_branches = Vec::new();
    for branch_name in branch_names {
        if seen_branch.insert(branch_name.clone()) {
            normalized_branches.push(branch_name);
        }
    }
    normalized_branches
}

fn branch_fetch_percent(completed: usize, total: usize) -> i32 {
    if total == 0 {
        return 30;
    }
    30 + ((completed as i32) * 35 / total as i32)
}

pub(crate) async fn sync_project_commits_internal(state: &AppState, id: i32, emit_events: bool) -> AppResult<i32> {
    let started_at = Instant::now();
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
    };

    project_name = name;

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "fetch".into(),
            message: "正在读取分支并拉取提交...".into(),
            percent: 30,
            status: "running".into(),
            added_count: None,
        },
    );

    let client = Arc::new(GitLabClient::new(&gitlab_url, &token));
    let configured_branch = if gitlab_branch.trim().is_empty() {
        "main".to_string()
    } else {
        gitlab_branch.trim().to_string()
    };

    let branch_names: Vec<String> = client
        .list_branches(gitlab_project_id)
        .await
        .map(|branches| {
            branches
                .into_iter()
                .map(|branch| branch.name.trim().to_string())
                .filter(|name| !name.is_empty())
                .collect::<Vec<_>>()
        })
        .unwrap_or_else(|err| {
            log::warn!(
                "[项目同步] 拉取分支列表失败，回退默认分支: project_id={}, err={}",
                id,
                err
            );
            Vec::new()
        });

    let normalized_branches = normalize_branch_names(branch_names, &configured_branch);
    let total_branches = normalized_branches.len();

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "fetch".into(),
            message: format!(
                "开始并发拉取 {} 个分支提交（并发 {}）...",
                total_branches,
                BRANCH_SYNC_CONCURRENCY
            ),
            percent: 30,
            status: "running".into(),
            added_count: None,
        },
    );

    let mut branch_results_stream = stream::iter(
        normalized_branches
            .into_iter()
            .enumerate()
            .map(|(index, branch_name)| {
                let client = Arc::clone(&client);
                async move {
                    let result = client
                        .list_commits(gitlab_project_id, &branch_name, COMMITS_PER_BRANCH)
                        .await;
                    BranchFetchResult {
                        index,
                        branch_name,
                        result,
                    }
                }
            }),
    )
    .buffer_unordered(BRANCH_SYNC_CONCURRENCY);

    let mut branch_results = Vec::new();
    let mut completed_branches = 0;

    while let Some(branch_result) = branch_results_stream.next().await {
        completed_branches += 1;
        let percent = branch_fetch_percent(completed_branches, total_branches);
        match &branch_result.result {
            Ok(_) => emit_project_sync_if_enabled(
                emit_events,
                &ProjectSyncSsePayload {
                    project_id: id,
                    project_name: project_name.clone(),
                    stage: "fetch".into(),
                    message: format!(
                        "已拉取分支提交：{}/{} {}",
                        completed_branches,
                        total_branches,
                        branch_result.branch_name
                    ),
                    percent,
                    status: "running".into(),
                    added_count: None,
                },
            ),
            Err(err) => emit_project_sync_if_enabled(
                emit_events,
                &ProjectSyncSsePayload {
                    project_id: id,
                    project_name: project_name.clone(),
                    stage: "fetch".into(),
                    message: format!(
                        "分支拉取失败：{}/{} {} ({})",
                        completed_branches,
                        total_branches,
                        branch_result.branch_name,
                        err
                    ),
                    percent,
                    status: "running".into(),
                    added_count: None,
                },
            ),
        }
        branch_results.push(branch_result);
    }

    branch_results.sort_by_key(|item| item.index);

    let mut branch_commits: Vec<(String, Vec<GitLabCommit>)> = Vec::new();
    let mut commit_shas_set: HashSet<String> = HashSet::new();
    let mut failed_branches = 0;

    for branch_result in branch_results {
        match branch_result.result {
            Ok(commits) => {
                for commit in &commits {
                    commit_shas_set.insert(commit.id.clone());
                }
                branch_commits.push((branch_result.branch_name, commits));
            }
            Err(err) => {
                failed_branches += 1;
                log::warn!(
                    "[项目同步] 分支提交拉取失败: project_id={}, branch={}, err={}",
                    id,
                    branch_result.branch_name,
                    err
                );
            }
        }
    }

    if branch_commits.is_empty() {
        let err = AppError::ExternalApi("GitLab 提交拉取失败：所有分支均失败".into());
        emit_project_sync_if_enabled(
            emit_events,
            &ProjectSyncSsePayload {
                project_id: id,
                project_name: project_name.clone(),
                stage: "error".into(),
                message: err.to_string(),
                percent: 100,
                status: "error".into(),
                added_count: None,
            },
        );
        return Err(err);
    }

    let commit_shas: Vec<String> = commit_shas_set.into_iter().collect();
    let total_fetched_commits: usize = branch_commits.iter().map(|(_, commits)| commits.len()).sum();

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "store".into(),
            message: format!(
                "已获取 {} 条提交（{} 个分支成功，{} 个分支失败），写入数据库...",
                total_fetched_commits,
                branch_commits.len(),
                failed_branches
            ),
            percent: 70,
            status: "running".into(),
            added_count: None,
        },
    );

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

    log::info!(
        "[项目同步] 同步完成: project_id={}, project_name={}, added_count={}, linked_count={}, failed_branches={}, elapsed_ms={}",
        id,
        project_name,
        added_count,
        linked_count,
        failed_branches,
        started_at.elapsed().as_millis()
    );

    emit_project_sync_if_enabled(
        emit_events,
        &ProjectSyncSsePayload {
            project_id: id,
            project_name: project_name.clone(),
            stage: "done".into(),
            message: format!(
                "同步完成：新增 {} 条提交，关联 {} 条提交记录{}",
                added_count,
                linked_count,
                if failed_branches > 0 {
                    format!("，{} 个分支拉取失败", failed_branches)
                } else {
                    String::new()
                }
            ),
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
    let (url, token, pid) = {
        let db = state.db.lock().await;
        project_service::list_gitlab_branches_prepare(&db.conn, &req)?
    };

    let client = GitLabClient::new(&url, &token);
    let branches = client.list_branches(pid).await?;
    Ok(branches.into_iter().map(|b| b.name).collect())
}

#[cfg(test)]
mod tests {
    use super::{branch_fetch_percent, normalize_branch_names};

    #[test]
    fn normalize_branch_names_keeps_order_and_adds_configured_branch() {
        let branches = vec![
            "develop".to_string(),
            "main".to_string(),
            "develop".to_string(),
            "release".to_string(),
        ];

        let normalized = normalize_branch_names(branches, "main");

        assert_eq!(normalized, vec!["develop", "main", "release"]);
    }

    #[test]
    fn normalize_branch_names_falls_back_to_configured_branch() {
        let normalized = normalize_branch_names(Vec::new(), "main");
        assert_eq!(normalized, vec!["main"]);
    }

    #[test]
    fn branch_fetch_percent_scales_with_completion() {
        assert_eq!(branch_fetch_percent(0, 4), 30);
        assert_eq!(branch_fetch_percent(2, 4), 47);
        assert_eq!(branch_fetch_percent(4, 4), 65);
    }
}
