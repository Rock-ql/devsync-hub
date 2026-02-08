use rusqlite::{params, Connection};
use crate::error::{AppError, AppResult};
use crate::models::project::*;
use crate::models::common::PageResult;

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

    let has_gitlab_config = !project.gitlab_url.is_empty() && project.gitlab_project_id > 0;

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
    Ok(())
}

/// Prepare sync data needed for sync_commits (before async calls)
pub fn sync_commits_prepare(conn: &Connection, id: i32) -> AppResult<(String, String, i32)> {
    let project = get_project_detail(conn, id)?.project;
    if project.gitlab_url.is_empty() || project.gitlab_project_id == 0 {
        return Err(AppError::BadRequest("GitLab not configured".into()));
    }
    let token = resolve_token(conn, &project.gitlab_token)?;
    Ok((project.gitlab_url, token, project.gitlab_project_id))
}

/// Insert fetched commits into DB (after async calls)
pub fn sync_commits_insert(conn: &Connection, project_id: i32, branch_commits: &[(String, Vec<crate::clients::gitlab_client::GitLabCommit>)]) -> AppResult<i32> {
    let mut total_new = 0;
    for (branch_name, commits) in branch_commits {
        for commit in commits {
            let exists: i64 = conn.query_row(
                "SELECT COUNT(*) FROM git_commit WHERE project_id = ? AND commit_id = ? AND branch = ?",
                params![project_id, commit.id, branch_name],
                |row| row.get(0),
            ).unwrap_or(0);

            if exists == 0 {
                conn.execute(
                    "INSERT INTO git_commit (project_id, commit_id, message, author_name, author_email, committed_at, additions, deletions, branch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    params![
                        project_id, commit.id, commit.message, commit.author_name, commit.author_email,
                        commit.committed_date, commit.stats.additions, commit.stats.deletions, branch_name
                    ],
                )?;
                total_new += 1;
            }
        }
    }
    Ok(total_new)
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
        if url.is_empty() || pid == 0 {
            return Err(AppError::BadRequest("GitLab URL and project ID required".into()));
        }
        let t = if token.is_empty() { resolve_global_token(conn)? } else { token.to_string() };
        Ok((url.to_string(), t, pid))
    }
}

fn resolve_token(conn: &Connection, project_token: &str) -> AppResult<String> {
    if !project_token.is_empty() {
        return Ok(project_token.to_string());
    }
    resolve_global_token(conn)
}

fn resolve_global_token(conn: &Connection) -> AppResult<String> {
    let token: String = conn.query_row(
        "SELECT setting_value FROM system_setting WHERE setting_key = 'gitlab_token' AND state = 1",
        [], |row| row.get(0),
    ).unwrap_or_default();
    if token.is_empty() {
        return Err(AppError::BadRequest("No GitLab token configured".into()));
    }
    Ok(token)
}
