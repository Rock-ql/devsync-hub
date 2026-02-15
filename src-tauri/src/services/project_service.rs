use rusqlite::{params, params_from_iter, Connection};
use base64::Engine;
use chrono::{DateTime, FixedOffset, NaiveDateTime, TimeZone};
use crate::error::{AppError, AppResult};
use crate::models::project::*;
use crate::models::common::PageResult;
use crate::models::requirement::Requirement;
use crate::services::iteration_service;

const NEAREST_ANCHOR_MAX_MINUTES: i64 = 30;

pub fn list_projects(conn: &Connection, req: &ProjectListReq) -> AppResult<PageResult<Project>> {
    let page = req.page.unwrap_or(1);
    let size = req.size.unwrap_or(20);
    let offset = (page - 1) * size;

    let mut where_clause = "WHERE state = 1 AND deleted_at IS NULL".to_string();
    let mut count_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(kw) = &req.keyword {
        if !kw.is_empty() {
            where_clause.push_str(" AND name LIKE ?");
            count_params.push(Box::new(format!("%{}%", kw)));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM project {}", where_clause);
    let count_refs: Vec<&dyn rusqlite::types::ToSql> = count_params.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
    let total: i64 = conn.query_row(&count_sql, count_refs.as_slice(), |row| row.get(0))?;

    let query_sql = format!(
        "SELECT id, name, description, gitlab_url, gitlab_token, gitlab_project_id, gitlab_branch, state, created_at, updated_at FROM project {} ORDER BY id DESC LIMIT ? OFFSET ?",
        where_clause
    );
    let mut query_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(kw) = &req.keyword {
        if !kw.is_empty() {
            query_params.push(Box::new(format!("%{}%", kw)));
        }
    }
    query_params.push(Box::new(size));
    query_params.push(Box::new(offset));
    let query_refs: Vec<&dyn rusqlite::types::ToSql> = query_params.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();

    let mut stmt = conn.prepare(&query_sql)?;
    let rows = stmt.query_map(query_refs.as_slice(), |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            gitlab_url: row.get(3)?,
            gitlab_token: row.get(4)?,
            gitlab_project_id: row.get(5)?,
            gitlab_branch: row.get(6)?,
            state: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;

    let records: Vec<Project> = rows.filter_map(|r| r.ok()).collect();
    Ok(PageResult { records, total, page, size })
}

pub fn list_all_projects(conn: &Connection) -> AppResult<Vec<Project>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, description, gitlab_url, gitlab_token, gitlab_project_id, gitlab_branch, state, created_at, updated_at FROM project WHERE state = 1 AND deleted_at IS NULL ORDER BY id DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            gitlab_url: row.get(3)?,
            gitlab_token: row.get(4)?,
            gitlab_project_id: row.get(5)?,
            gitlab_branch: row.get(6)?,
            state: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_project_detail(conn: &Connection, id: i32) -> AppResult<ProjectDetailRsp> {
    let project = conn.query_row(
        "SELECT id, name, description, gitlab_url, gitlab_token, gitlab_project_id, gitlab_branch, state, created_at, updated_at FROM project WHERE id = ? AND state = 1 AND deleted_at IS NULL",
        params![id],
        |row| Ok(Project {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
            gitlab_url: row.get(3)?,
            gitlab_token: row.get(4)?,
            gitlab_project_id: row.get(5)?,
            gitlab_branch: row.get(6)?,
            state: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        }),
    ).map_err(|_| AppError::NotFound("Project not found".into()))?;

    let iteration_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM iteration_project WHERE project_id = ? AND state = 1 AND deleted_at IS NULL",
        params![id], |row| row.get(0),
    ).unwrap_or(0);

    let pending_sql_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pending_sql WHERE project_id = ? AND state = 1 AND deleted_at IS NULL AND status = 'pending'",
        params![id], |row| row.get(0),
    ).unwrap_or(0);

    let has_gitlab_config = !project.gitlab_url.trim().is_empty();

    Ok(ProjectDetailRsp { project, iteration_count, pending_sql_count, has_gitlab_config })
}

pub fn add_project(conn: &Connection, req: &ProjectAddReq) -> AppResult<i32> {
    let existing: i64 = conn.query_row(
        "SELECT COUNT(*) FROM project WHERE name = ? AND state = 1 AND deleted_at IS NULL",
        params![req.name], |row| row.get(0),
    ).unwrap_or(0);
    if existing > 0 {
        return Err(AppError::BadRequest("Project name already exists".into()));
    }

    conn.execute(
        "INSERT INTO project (name, description, gitlab_url, gitlab_token, gitlab_project_id, gitlab_branch) VALUES (?, ?, ?, ?, ?, ?)",
        params![
            req.name,
            req.description.as_deref().unwrap_or(""),
            req.gitlab_url.as_deref().unwrap_or(""),
            req.gitlab_token.as_deref().unwrap_or(""),
            req.gitlab_project_id.unwrap_or(0),
            req.gitlab_branch.as_deref().unwrap_or(""),
        ],
    )?;
    let id = conn.last_insert_rowid() as i32;

    // 初始化默认环境配置
    let envs = vec![
        ("local", "本地", 1),
        ("dev", "开发", 2),
        ("test", "测试", 3),
        ("smoke", "冒烟", 4),
        ("prod", "生产", 5),
    ];
    for (code, name, order) in envs {
        conn.execute(
            "INSERT INTO sql_env_config (project_id, env_code, env_name, sort_order) VALUES (?, ?, ?, ?)",
            params![id, code, name, order],
        )?;
    }

    Ok(id)
}

pub fn update_project(conn: &Connection, req: &ProjectUpdateReq) -> AppResult<()> {
    let mut sets = vec![];
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(name) = &req.name {
        let dup: i64 = conn.query_row(
            "SELECT COUNT(*) FROM project WHERE name = ? AND id != ? AND state = 1 AND deleted_at IS NULL",
            params![name, req.id], |row| row.get(0),
        ).unwrap_or(0);
        if dup > 0 {
            return Err(AppError::BadRequest("Project name already exists".into()));
        }
        sets.push("name = ?");
        params_vec.push(Box::new(name.clone()));
    }
    if let Some(v) = &req.description { sets.push("description = ?"); params_vec.push(Box::new(v.clone())); }
    if let Some(v) = &req.gitlab_url { sets.push("gitlab_url = ?"); params_vec.push(Box::new(v.clone())); }
    if let Some(v) = &req.gitlab_token { sets.push("gitlab_token = ?"); params_vec.push(Box::new(v.clone())); }
    if let Some(v) = &req.gitlab_project_id { sets.push("gitlab_project_id = ?"); params_vec.push(Box::new(*v)); }
    if let Some(v) = &req.gitlab_branch { sets.push("gitlab_branch = ?"); params_vec.push(Box::new(v.clone())); }

    if sets.is_empty() {
        return Ok(());
    }

    sets.push("updated_at = datetime('now','localtime')");
    params_vec.push(Box::new(req.id));

    let sql = format!("UPDATE project SET {} WHERE id = ?", sets.join(", "));
    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
    conn.execute(&sql, refs.as_slice())?;
    Ok(())
}

pub fn delete_project(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute(
        "UPDATE project SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?",
        params![id],
    )?;

    conn.execute(
        "UPDATE sql_env_config SET deleted_at = datetime('now','localtime'), state = 0 WHERE project_id = ? AND state = 1",
        params![id],
    )?;

    let sql_ids = collect_project_ids(
        conn,
        "SELECT id FROM pending_sql WHERE project_id = ? AND state = 1 AND deleted_at IS NULL",
        id,
    )?;
    soft_delete_sqls(conn, &sql_ids)?;

    let commit_ids = collect_project_ids(
        conn,
        "SELECT id FROM git_commit WHERE project_id = ? AND state = 1 AND deleted_at IS NULL",
        id,
    )?;
    soft_delete_commits(conn, &commit_ids)?;

    let iteration_ids = collect_project_ids(
        conn,
        "SELECT iteration_id FROM iteration_project WHERE project_id = ? AND state = 1 AND deleted_at IS NULL",
        id,
    )?;
    conn.execute(
        "UPDATE iteration_project SET deleted_at = datetime('now','localtime'), state = 0 WHERE project_id = ? AND state = 1",
        params![id],
    )?;

    conn.execute(
        "UPDATE requirement_project SET deleted_at = datetime('now','localtime'), state = 0 WHERE project_id = ? AND state = 1",
        params![id],
    )?;

    for iteration_id in iteration_ids {
        let relation_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM iteration_project WHERE iteration_id = ? AND state = 1 AND deleted_at IS NULL",
                params![iteration_id],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if relation_count == 0 {
            iteration_service::delete_iteration_inner(conn, iteration_id)?;
        }
    }

    Ok(())
}

fn collect_project_ids(conn: &Connection, sql: &str, project_id: i32) -> AppResult<Vec<i32>> {
    let mut stmt = conn.prepare(sql)?;
    let ids = stmt
        .query_map(params![project_id], |row| row.get::<_, i32>(0))?
        .filter_map(|row| row.ok())
        .collect();
    Ok(ids)
}

fn soft_delete_sqls(conn: &Connection, sql_ids: &[i32]) -> AppResult<()> {
    if sql_ids.is_empty() {
        return Ok(());
    }

    let placeholders = std::iter::repeat("?")
        .take(sql_ids.len())
        .collect::<Vec<_>>()
        .join(",");

    let sql_update = format!(
        "UPDATE pending_sql SET deleted_at = datetime('now','localtime'), state = 0 WHERE id IN ({}) AND state = 1 AND deleted_at IS NULL",
        placeholders
    );
    conn.execute(&sql_update, params_from_iter(sql_ids.iter()))?;

    let log_update = format!(
        "UPDATE sql_execution_log SET deleted_at = datetime('now','localtime'), state = 0 WHERE sql_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&log_update, params_from_iter(sql_ids.iter()))?;

    let link_update = format!(
        "UPDATE work_item_link SET deleted_at = datetime('now','localtime'), state = 0 WHERE link_type = 'sql' AND link_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&link_update, params_from_iter(sql_ids.iter()))?;

    Ok(())
}

fn soft_delete_commits(conn: &Connection, commit_ids: &[i32]) -> AppResult<()> {
    if commit_ids.is_empty() {
        return Ok(());
    }

    let placeholders = std::iter::repeat("?")
        .take(commit_ids.len())
        .collect::<Vec<_>>()
        .join(",");

    let commit_update = format!(
        "UPDATE git_commit SET deleted_at = datetime('now','localtime'), state = 0 WHERE id IN ({}) AND state = 1 AND deleted_at IS NULL",
        placeholders
    );
    conn.execute(&commit_update, params_from_iter(commit_ids.iter()))?;

    let link_update = format!(
        "UPDATE work_item_link SET deleted_at = datetime('now','localtime'), state = 0 WHERE link_type = 'commit' AND link_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&link_update, params_from_iter(commit_ids.iter()))?;

    Ok(())
}

/// Prepare sync data needed for sync_commits (before async calls)
pub fn sync_commits_prepare(conn: &Connection, id: i32) -> AppResult<(String, String, i32, String, String)> {
    let project = get_project_detail(conn, id)?.project;
    if project.gitlab_url.trim().is_empty() {
        return Err(AppError::BadRequest("GitLab repository URL not configured".into()));
    }
    let token = resolve_token(conn, &project.gitlab_token)?;
    Ok((project.gitlab_url, token, project.gitlab_project_id, project.gitlab_branch, project.name))
}

fn normalize_datetime(input: &str) -> String {
    let trimmed = input.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if !trimmed.contains('T') {
        return trimmed.to_string();
    }
    if let Ok(dt) = DateTime::parse_from_rfc3339(trimmed) {
        let offset = FixedOffset::east_opt(8 * 3600).expect("UTC+8 offset is always valid");
        let local = dt.with_timezone(&offset);
        return local.format("%Y-%m-%d %H:%M:%S").to_string();
    }
    for fmt in ["%Y-%m-%dT%H:%M:%S%.f", "%Y-%m-%dT%H:%M:%S"] {
        if let Ok(naive) = NaiveDateTime::parse_from_str(trimmed, fmt) {
            return naive.format("%Y-%m-%d %H:%M:%S").to_string();
        }
    }
    trimmed.to_string()
}

/// Insert fetched commits into DB (after async calls)
pub fn sync_commits_insert(conn: &Connection, project_id: i32, branch_commits: &[(String, Vec<crate::clients::gitlab_client::GitLabCommit>)]) -> AppResult<i32> {
    let mut total_new = 0;
    for (branch_name, commits) in branch_commits {
        for commit in commits {
            let committed_at = normalize_datetime(&commit.committed_date);
            let changed = conn.execute(
                "INSERT OR IGNORE INTO git_commit (project_id, commit_id, message, author_name, author_email, committed_at, additions, deletions, branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                params![
                    project_id, commit.id, commit.message, commit.author_name, commit.author_email,
                    committed_at, commit.stats.additions, commit.stats.deletions, branch_name
                ],
            )?;
            total_new += changed as i32;
        }
    }
    Ok(total_new)
}

pub fn link_synced_commits_to_requirements(conn: &Connection, project_id: i32, commit_shas: &[String]) -> AppResult<i32> {
    if commit_shas.is_empty() {
        return Ok(0);
    }

    let requirements = load_project_requirements(conn, project_id)?;
    let mut coded: Vec<(i32, String)> = Vec::new();
    for requirement in &requirements {
        let code = get_requirement_code(requirement);
        if !code.is_empty() {
            coded.push((requirement.id, code));
        }
    }

    if coded.is_empty() {
        return Ok(0);
    }

    let placeholders = std::iter::repeat("?")
        .take(commit_shas.len())
        .collect::<Vec<_>>()
        .join(",");

    let sql = format!(
        "SELECT id, commit_id, message, committed_at FROM git_commit WHERE project_id = ? AND state = 1 AND deleted_at IS NULL AND commit_id IN ({}) ORDER BY committed_at ASC, id ASC",
        placeholders
    );

    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(project_id)];
    for sha in commit_shas {
        params_vec.push(Box::new(sha.clone()));
    }
    let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec
        .iter()
        .map(|value| value.as_ref() as &dyn rusqlite::types::ToSql)
        .collect();

    #[derive(Debug, Clone)]
    struct CommitCandidate {
        id: i32,
        commit_sha: String,
        message: String,
        committed_at: String,
    }

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(refs.as_slice(), |row| {
        Ok(CommitCandidate {
            id: row.get(0)?,
            commit_sha: row.get(1)?,
            message: row.get(2)?,
            committed_at: row.get(3)?,
        })
    })?;

    let commits: Vec<CommitCandidate> = rows.filter_map(|row| row.ok()).collect();
    if commits.is_empty() {
        return Ok(0);
    }

    let commit_ids: Vec<i32> = commits.iter().map(|item| item.id).collect();
    soft_delete_commit_links(conn, &commit_ids)?;

    #[derive(Debug, Clone)]
    struct CommitAnchor {
        requirement_id: i32,
        committed_at: DateTime<FixedOffset>,
    }

    let mut matched: std::collections::HashMap<i32, i32> = std::collections::HashMap::new();
    let mut anchors: Vec<CommitAnchor> = Vec::new();

    for commit in &commits {
        if is_merge_commit(&commit.message) {
            continue;
        }

        let message_code = extract_requirement_code_from_text(&commit.message);
        if message_code.is_empty() {
            continue;
        }

        let mut found_requirement: Option<i32> = None;
        for (req_id, req_code) in &coded {
            if *req_code == message_code {
                found_requirement = Some(*req_id);
                break;
            }
        }

        let Some(requirement_id) = found_requirement else {
            continue;
        };

        matched.insert(commit.id, requirement_id);

        if let Some(committed_at) = parse_commit_time(&commit.committed_at) {
            anchors.push(CommitAnchor {
                requirement_id,
                committed_at,
            });
        }
    }

    if !anchors.is_empty() {
        for commit in &commits {
            if matched.contains_key(&commit.id) || is_merge_commit(&commit.message) {
                continue;
            }

            let Some(commit_time) = parse_commit_time(&commit.committed_at) else {
                continue;
            };

            let mut nearest_requirement_id: Option<i32> = None;
            let mut nearest_minutes = i64::MAX;

            for anchor in &anchors {
                let minutes = (commit_time - anchor.committed_at).num_minutes().abs();
                if minutes <= NEAREST_ANCHOR_MAX_MINUTES && minutes < nearest_minutes {
                    nearest_minutes = minutes;
                    nearest_requirement_id = Some(anchor.requirement_id);
                }
            }

            if let Some(requirement_id) = nearest_requirement_id {
                matched.insert(commit.id, requirement_id);
            }
        }
    }

    let mut inserted = 0;
    for (commit_id, requirement_id) in matched {
        conn.execute(
            "INSERT INTO work_item_link (work_item_id, link_type, link_id) VALUES (?, 'commit', ?)",
            params![requirement_id, commit_id],
        )?;
        inserted += 1;
    }

    Ok(inserted)
}

fn load_project_requirements(conn: &Connection, project_id: i32) -> AppResult<Vec<Requirement>> {
    let mut stmt = conn.prepare(
        "SELECT r.id, r.iteration_id, r.name, r.requirement_code, r.environment, r.link, r.status, r.branch, r.state, r.created_at, r.updated_at          FROM requirement r          INNER JOIN requirement_project rp ON r.id = rp.requirement_id          WHERE rp.project_id = ? AND rp.state = 1 AND rp.deleted_at IS NULL            AND r.state = 1 AND r.deleted_at IS NULL          ORDER BY r.updated_at DESC, r.id DESC",
    )?;

    let rows = stmt.query_map(params![project_id], |row| {
        Ok(Requirement {
            id: row.get(0)?,
            iteration_id: row.get(1)?,
            name: row.get(2)?,
            requirement_code: row.get(3)?,
            environment: row.get(4)?,
            link: row.get(5)?,
            status: row.get(6)?,
            branch: row.get(7)?,
            state: row.get(8)?,
            created_at: row.get(9)?,
            updated_at: row.get(10)?,
        })
    })?;

    Ok(rows.filter_map(|row| row.ok()).collect())
}

fn soft_delete_commit_links(conn: &Connection, commit_ids: &[i32]) -> AppResult<()> {
    if commit_ids.is_empty() {
        return Ok(());
    }

    let placeholders = std::iter::repeat("?")
        .take(commit_ids.len())
        .collect::<Vec<_>>()
        .join(",");

    let sql = format!(
        "UPDATE work_item_link SET deleted_at = datetime('now','localtime'), state = 0 WHERE link_type = 'commit' AND link_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&sql, params_from_iter(commit_ids.iter()))?;
    Ok(())
}

fn is_merge_commit(message: &str) -> bool {
    let normalized = message.trim().to_lowercase();
    normalized.starts_with("merge branch")
        || normalized.starts_with("merge remote-tracking branch")
        || normalized.starts_with("merge pull request")
        || normalized.starts_with("merge !")
}

fn get_requirement_code(requirement: &Requirement) -> String {
    let configured = requirement.requirement_code.trim().to_uppercase();
    if !configured.is_empty() {
        return configured;
    }
    extract_requirement_code_from_text(&requirement.name)
}

fn extract_requirement_code_from_text(text: &str) -> String {
    let chars: Vec<char> = text.trim().to_uppercase().chars().collect();
    if chars.is_empty() {
        return String::new();
    }

    let mut index = 0;
    while index < chars.len() {
        if !chars[index].is_ascii_alphabetic() {
            index += 1;
            continue;
        }

        let start = index;
        while index < chars.len() && chars[index].is_ascii_alphabetic() {
            index += 1;
        }

        if index >= chars.len() || chars[index] != '-' {
            continue;
        }

        let hyphen_idx = index;
        index += 1;
        let digits_start = index;
        while index < chars.len() && chars[index].is_ascii_digit() {
            index += 1;
        }

        if index > digits_start {
            return chars[start..index].iter().collect();
        }

        index = hyphen_idx + 1;
    }

    String::new()
}

fn parse_commit_time(time_text: &str) -> Option<DateTime<FixedOffset>> {
    let value = time_text.trim();
    if value.is_empty() {
        return None;
    }

    if let Ok(parsed) = DateTime::parse_from_rfc3339(value) {
        return Some(parsed);
    }

    let offset = FixedOffset::east_opt(8 * 3600)?;

    for format in [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S%.f",
    ] {
        if let Ok(naive) = NaiveDateTime::parse_from_str(value, format) {
            if let Some(parsed) = offset.from_local_datetime(&naive).single() {
                return Some(parsed);
            }
        }
    }

    None
}


pub fn get_commits(conn: &Connection, project_id: i32) -> AppResult<Vec<crate::models::git_commit::GitCommit>> {
    let mut stmt = conn.prepare(
        "SELECT id, project_id, commit_id, message, author_name, author_email, committed_at, additions, deletions, branch, state, created_at FROM git_commit WHERE project_id = ? AND state = 1 ORDER BY committed_at DESC LIMIT 200"
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok(crate::models::git_commit::GitCommit {
            id: row.get(0)?,
            project_id: row.get(1)?,
            commit_id: row.get(2)?,
            message: row.get(3)?,
            author_name: row.get(4)?,
            author_email: row.get(5)?,
            committed_at: row.get(6)?,
            additions: row.get(7)?,
            deletions: row.get(8)?,
            branch: row.get(9)?,
            state: row.get(10)?,
            created_at: row.get(11)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

/// Prepare data for listing GitLab branches (sync DB reads only)
pub fn list_gitlab_branches_prepare(conn: &Connection, req: &GitLabBranchReq) -> AppResult<(String, String, i32)> {
    if let Some(project_id) = req.project_id {
        let p = get_project_detail(conn, project_id)?.project;
        let t = resolve_token(conn, &p.gitlab_token)?;
        Ok((p.gitlab_url, t, p.gitlab_project_id))
    } else {
        let url = req.gitlab_url.as_deref().unwrap_or("");
        let token = req.gitlab_token.as_deref().unwrap_or("");
        let pid = req.gitlab_project_id.unwrap_or(0);
        if url.trim().is_empty() {
            return Err(AppError::BadRequest("GitLab URL required".into()));
        }
        let t = if token.is_empty() { resolve_global_token(conn)? } else { token.to_string() };
        Ok((url.to_string(), t, pid))
    }
}

fn resolve_token(conn: &Connection, project_token: &str) -> AppResult<String> {
    let token = project_token.trim();
    if !token.is_empty() {
        return normalize_gitlab_token(token);
    }
    resolve_global_token(conn)
}

fn resolve_global_token(conn: &Connection) -> AppResult<String> {
    let mut raw_token = String::new();
    for key in ["gitlab_token", "git.gitlab.token"] {
        let token: String = conn.query_row(
            "SELECT setting_value FROM system_setting WHERE setting_key = ? AND state = 1 AND deleted_at IS NULL",
            params![key],
            |row| row.get(0),
        ).unwrap_or_default();
        if !token.trim().is_empty() {
            raw_token = token;
            break;
        }
    }

    if raw_token.trim().is_empty() {
        return Err(AppError::BadRequest("No GitLab token configured".into()));
    }

    normalize_gitlab_token(&raw_token)
}

fn normalize_gitlab_token(token: &str) -> AppResult<String> {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return Err(AppError::BadRequest("No GitLab token configured".into()));
    }
    if trimmed.contains("****") {
        return Err(AppError::BadRequest("GitLab token is masked, please re-enter a valid token".into()));
    }

    if let Some(decrypted) = try_decrypt_legacy_token(trimmed) {
        return Ok(decrypted);
    }
    Ok(trimmed.to_string())
}

fn try_decrypt_legacy_token(cipher_text: &str) -> Option<String> {
    if !looks_like_legacy_encrypted_token(cipher_text) {
        return None;
    }

    let encrypted = base64::engine::general_purpose::STANDARD
        .decode(cipher_text)
        .ok()?;
    if encrypted.is_empty() || encrypted.len() % 16 != 0 {
        return None;
    }

    let secret = std::env::var("ENCRYPT_KEY")
        .unwrap_or_else(|_| "devsync-hub-secret-key-2024".to_string());
    let key = legacy_aes_key(secret.as_bytes());
    let plain = decrypt_aes128_ecb_pkcs7(&encrypted, &key)?;
    let token = std::str::from_utf8(&plain).ok()?.trim();
    if token.is_empty() || token.chars().any(|ch| ch.is_control()) {
        return None;
    }
    Some(token.to_string())
}

fn looks_like_legacy_encrypted_token(value: &str) -> bool {
    !value.is_empty()
        && value.len() >= 24
        && value.len() % 4 == 0
        && !value.contains('-')
        && !value.contains('_')
        && (value.contains('=') || value.contains('+') || value.contains('/'))
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'+' | b'/' | b'='))
}

fn legacy_aes_key(secret: &[u8]) -> [u8; 16] {
    let digest = md5_hash(secret);
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut key = [0u8; 16];
    for i in 0..8 {
        let byte = digest[i];
        key[i * 2] = HEX[(byte >> 4) as usize];
        key[i * 2 + 1] = HEX[(byte & 0x0f) as usize];
    }
    key
}

fn decrypt_aes128_ecb_pkcs7(data: &[u8], key: &[u8; 16]) -> Option<Vec<u8>> {
    if data.is_empty() || data.len() % 16 != 0 {
        return None;
    }

    let round_keys = aes128_key_schedule(key);
    let mut out = Vec::with_capacity(data.len());
    for block in data.chunks_exact(16) {
        let mut block_bytes = [0u8; 16];
        block_bytes.copy_from_slice(block);
        let plain = aes128_decrypt_block(&block_bytes, &round_keys);
        out.extend_from_slice(&plain);
    }

    let pad_len = *out.last()? as usize;
    if pad_len == 0 || pad_len > 16 || pad_len > out.len() {
        return None;
    }
    if !out[out.len() - pad_len..].iter().all(|b| *b as usize == pad_len) {
        return None;
    }
    out.truncate(out.len() - pad_len);
    Some(out)
}

fn aes128_key_schedule(key: &[u8; 16]) -> [[u8; 16]; 11] {
    let mut words = [0u32; 44];
    for i in 0..4 {
        words[i] = u32::from_be_bytes([
            key[i * 4],
            key[i * 4 + 1],
            key[i * 4 + 2],
            key[i * 4 + 3],
        ]);
    }

    let mut rcon = 1u8;
    for i in 4..44 {
        let mut temp = words[i - 1];
        if i % 4 == 0 {
            temp = sub_word(rot_word(temp)) ^ ((rcon as u32) << 24);
            rcon = xtime(rcon);
        }
        words[i] = words[i - 4] ^ temp;
    }

    let mut round_keys = [[0u8; 16]; 11];
    for round in 0..11 {
        for col in 0..4 {
            let w = words[round * 4 + col].to_be_bytes();
            round_keys[round][col * 4..col * 4 + 4].copy_from_slice(&w);
        }
    }
    round_keys
}

fn aes128_decrypt_block(block: &[u8; 16], round_keys: &[[u8; 16]; 11]) -> [u8; 16] {
    let mut state = *block;

    add_round_key(&mut state, &round_keys[10]);
    for round in (1..10).rev() {
        inv_shift_rows(&mut state);
        inv_sub_bytes(&mut state);
        add_round_key(&mut state, &round_keys[round]);
        inv_mix_columns(&mut state);
    }
    inv_shift_rows(&mut state);
    inv_sub_bytes(&mut state);
    add_round_key(&mut state, &round_keys[0]);

    state
}

fn add_round_key(state: &mut [u8; 16], key: &[u8; 16]) {
    for i in 0..16 {
        state[i] ^= key[i];
    }
}

fn inv_sub_bytes(state: &mut [u8; 16]) {
    for byte in state.iter_mut() {
        *byte = INV_SBOX[*byte as usize];
    }
}

fn inv_shift_rows(state: &mut [u8; 16]) {
    let mut tmp = *state;
    tmp[1] = state[13];
    tmp[5] = state[1];
    tmp[9] = state[5];
    tmp[13] = state[9];

    tmp[2] = state[10];
    tmp[6] = state[14];
    tmp[10] = state[2];
    tmp[14] = state[6];

    tmp[3] = state[7];
    tmp[7] = state[11];
    tmp[11] = state[15];
    tmp[15] = state[3];

    *state = tmp;
}

fn inv_mix_columns(state: &mut [u8; 16]) {
    for col in 0..4 {
        let i = col * 4;
        let a0 = state[i];
        let a1 = state[i + 1];
        let a2 = state[i + 2];
        let a3 = state[i + 3];

        state[i] = gf_mul(a0, 14) ^ gf_mul(a1, 11) ^ gf_mul(a2, 13) ^ gf_mul(a3, 9);
        state[i + 1] = gf_mul(a0, 9) ^ gf_mul(a1, 14) ^ gf_mul(a2, 11) ^ gf_mul(a3, 13);
        state[i + 2] = gf_mul(a0, 13) ^ gf_mul(a1, 9) ^ gf_mul(a2, 14) ^ gf_mul(a3, 11);
        state[i + 3] = gf_mul(a0, 11) ^ gf_mul(a1, 13) ^ gf_mul(a2, 9) ^ gf_mul(a3, 14);
    }
}

fn rot_word(word: u32) -> u32 {
    word.rotate_left(8)
}

fn sub_word(word: u32) -> u32 {
    let b = word.to_be_bytes();
    u32::from_be_bytes([
        SBOX[b[0] as usize],
        SBOX[b[1] as usize],
        SBOX[b[2] as usize],
        SBOX[b[3] as usize],
    ])
}

fn xtime(byte: u8) -> u8 {
    if byte & 0x80 == 0x80 {
        (byte << 1) ^ 0x1b
    } else {
        byte << 1
    }
}

fn gf_mul(mut a: u8, mut b: u8) -> u8 {
    let mut result = 0u8;
    while b > 0 {
        if b & 1 == 1 {
            result ^= a;
        }
        a = xtime(a);
        b >>= 1;
    }
    result
}

fn md5_hash(data: &[u8]) -> [u8; 16] {
    let mut padded = data.to_vec();
    let bit_len = (padded.len() as u64) * 8;
    padded.push(0x80);
    while padded.len() % 64 != 56 {
        padded.push(0);
    }
    padded.extend_from_slice(&bit_len.to_le_bytes());

    let mut a0: u32 = 0x67452301;
    let mut b0: u32 = 0xefcdab89;
    let mut c0: u32 = 0x98badcfe;
    let mut d0: u32 = 0x10325476;

    for chunk in padded.chunks_exact(64) {
        let mut m = [0u32; 16];
        for i in 0..16 {
            let base = i * 4;
            m[i] = u32::from_le_bytes([
                chunk[base],
                chunk[base + 1],
                chunk[base + 2],
                chunk[base + 3],
            ]);
        }

        let mut a = a0;
        let mut b = b0;
        let mut c = c0;
        let mut d = d0;

        for i in 0..64 {
            let (mut f, g): (u32, usize);
            if i < 16 {
                f = (b & c) | ((!b) & d);
                g = i;
            } else if i < 32 {
                f = (d & b) | ((!d) & c);
                g = (5 * i + 1) % 16;
            } else if i < 48 {
                f = b ^ c ^ d;
                g = (3 * i + 5) % 16;
            } else {
                f = c ^ (b | (!d));
                g = (7 * i) % 16;
            }

            f = f
                .wrapping_add(a)
                .wrapping_add(MD5_K[i])
                .wrapping_add(m[g]);

            a = d;
            d = c;
            c = b;
            b = b.wrapping_add(f.rotate_left(MD5_S[i]));
        }

        a0 = a0.wrapping_add(a);
        b0 = b0.wrapping_add(b);
        c0 = c0.wrapping_add(c);
        d0 = d0.wrapping_add(d);
    }

    let mut out = [0u8; 16];
    out[0..4].copy_from_slice(&a0.to_le_bytes());
    out[4..8].copy_from_slice(&b0.to_le_bytes());
    out[8..12].copy_from_slice(&c0.to_le_bytes());
    out[12..16].copy_from_slice(&d0.to_le_bytes());
    out
}

const MD5_S: [u32; 64] = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const MD5_K: [u32; 64] = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
];

const SBOX: [u8; 256] = [
    0x63, 0x7c, 0x77, 0x7b, 0xf2, 0x6b, 0x6f, 0xc5, 0x30, 0x01, 0x67, 0x2b,
    0xfe, 0xd7, 0xab, 0x76, 0xca, 0x82, 0xc9, 0x7d, 0xfa, 0x59, 0x47, 0xf0,
    0xad, 0xd4, 0xa2, 0xaf, 0x9c, 0xa4, 0x72, 0xc0, 0xb7, 0xfd, 0x93, 0x26,
    0x36, 0x3f, 0xf7, 0xcc, 0x34, 0xa5, 0xe5, 0xf1, 0x71, 0xd8, 0x31, 0x15,
    0x04, 0xc7, 0x23, 0xc3, 0x18, 0x96, 0x05, 0x9a, 0x07, 0x12, 0x80, 0xe2,
    0xeb, 0x27, 0xb2, 0x75, 0x09, 0x83, 0x2c, 0x1a, 0x1b, 0x6e, 0x5a, 0xa0,
    0x52, 0x3b, 0xd6, 0xb3, 0x29, 0xe3, 0x2f, 0x84, 0x53, 0xd1, 0x00, 0xed,
    0x20, 0xfc, 0xb1, 0x5b, 0x6a, 0xcb, 0xbe, 0x39, 0x4a, 0x4c, 0x58, 0xcf,
    0xd0, 0xef, 0xaa, 0xfb, 0x43, 0x4d, 0x33, 0x85, 0x45, 0xf9, 0x02, 0x7f,
    0x50, 0x3c, 0x9f, 0xa8, 0x51, 0xa3, 0x40, 0x8f, 0x92, 0x9d, 0x38, 0xf5,
    0xbc, 0xb6, 0xda, 0x21, 0x10, 0xff, 0xf3, 0xd2, 0xcd, 0x0c, 0x13, 0xec,
    0x5f, 0x97, 0x44, 0x17, 0xc4, 0xa7, 0x7e, 0x3d, 0x64, 0x5d, 0x19, 0x73,
    0x60, 0x81, 0x4f, 0xdc, 0x22, 0x2a, 0x90, 0x88, 0x46, 0xee, 0xb8, 0x14,
    0xde, 0x5e, 0x0b, 0xdb, 0xe0, 0x32, 0x3a, 0x0a, 0x49, 0x06, 0x24, 0x5c,
    0xc2, 0xd3, 0xac, 0x62, 0x91, 0x95, 0xe4, 0x79, 0xe7, 0xc8, 0x37, 0x6d,
    0x8d, 0xd5, 0x4e, 0xa9, 0x6c, 0x56, 0xf4, 0xea, 0x65, 0x7a, 0xae, 0x08,
    0xba, 0x78, 0x25, 0x2e, 0x1c, 0xa6, 0xb4, 0xc6, 0xe8, 0xdd, 0x74, 0x1f,
    0x4b, 0xbd, 0x8b, 0x8a, 0x70, 0x3e, 0xb5, 0x66, 0x48, 0x03, 0xf6, 0x0e,
    0x61, 0x35, 0x57, 0xb9, 0x86, 0xc1, 0x1d, 0x9e, 0xe1, 0xf8, 0x98, 0x11,
    0x69, 0xd9, 0x8e, 0x94, 0x9b, 0x1e, 0x87, 0xe9, 0xce, 0x55, 0x28, 0xdf,
    0x8c, 0xa1, 0x89, 0x0d, 0xbf, 0xe6, 0x42, 0x68, 0x41, 0x99, 0x2d, 0x0f,
    0xb0, 0x54, 0xbb, 0x16,
];

const INV_SBOX: [u8; 256] = [
    0x52, 0x09, 0x6a, 0xd5, 0x30, 0x36, 0xa5, 0x38, 0xbf, 0x40, 0xa3, 0x9e,
    0x81, 0xf3, 0xd7, 0xfb, 0x7c, 0xe3, 0x39, 0x82, 0x9b, 0x2f, 0xff, 0x87,
    0x34, 0x8e, 0x43, 0x44, 0xc4, 0xde, 0xe9, 0xcb, 0x54, 0x7b, 0x94, 0x32,
    0xa6, 0xc2, 0x23, 0x3d, 0xee, 0x4c, 0x95, 0x0b, 0x42, 0xfa, 0xc3, 0x4e,
    0x08, 0x2e, 0xa1, 0x66, 0x28, 0xd9, 0x24, 0xb2, 0x76, 0x5b, 0xa2, 0x49,
    0x6d, 0x8b, 0xd1, 0x25, 0x72, 0xf8, 0xf6, 0x64, 0x86, 0x68, 0x98, 0x16,
    0xd4, 0xa4, 0x5c, 0xcc, 0x5d, 0x65, 0xb6, 0x92, 0x6c, 0x70, 0x48, 0x50,
    0xfd, 0xed, 0xb9, 0xda, 0x5e, 0x15, 0x46, 0x57, 0xa7, 0x8d, 0x9d, 0x84,
    0x90, 0xd8, 0xab, 0x00, 0x8c, 0xbc, 0xd3, 0x0a, 0xf7, 0xe4, 0x58, 0x05,
    0xb8, 0xb3, 0x45, 0x06, 0xd0, 0x2c, 0x1e, 0x8f, 0xca, 0x3f, 0x0f, 0x02,
    0xc1, 0xaf, 0xbd, 0x03, 0x01, 0x13, 0x8a, 0x6b, 0x3a, 0x91, 0x11, 0x41,
    0x4f, 0x67, 0xdc, 0xea, 0x97, 0xf2, 0xcf, 0xce, 0xf0, 0xb4, 0xe6, 0x73,
    0x96, 0xac, 0x74, 0x22, 0xe7, 0xad, 0x35, 0x85, 0xe2, 0xf9, 0x37, 0xe8,
    0x1c, 0x75, 0xdf, 0x6e, 0x47, 0xf1, 0x1a, 0x71, 0x1d, 0x29, 0xc5, 0x89,
    0x6f, 0xb7, 0x62, 0x0e, 0xaa, 0x18, 0xbe, 0x1b, 0xfc, 0x56, 0x3e, 0x4b,
    0xc6, 0xd2, 0x79, 0x20, 0x9a, 0xdb, 0xc0, 0xfe, 0x78, 0xcd, 0x5a, 0xf4,
    0x1f, 0xdd, 0xa8, 0x33, 0x88, 0x07, 0xc7, 0x31, 0xb1, 0x12, 0x10, 0x59,
    0x27, 0x80, 0xec, 0x5f, 0x60, 0x51, 0x7f, 0xa9, 0x19, 0xb5, 0x4a, 0x0d,
    0x2d, 0xe5, 0x7a, 0x9f, 0x93, 0xc9, 0x9c, 0xef, 0xa0, 0xe0, 0x3b, 0x4d,
    0xae, 0x2a, 0xf5, 0xb0, 0xc8, 0xeb, 0xbb, 0x3c, 0x83, 0x53, 0x99, 0x61,
    0x17, 0x2b, 0x04, 0x7e, 0xba, 0x77, 0xd6, 0x26, 0xe1, 0x69, 0x14, 0x63,
    0x55, 0x21, 0x0c, 0x7d,
];
