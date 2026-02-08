use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use crate::error::AppResult;

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardOverview {
    pub project_count: i64,
    pub active_project_count: i64,
    pub iteration_count: i64,
    pub active_iteration_count: i64,
    pub pending_sql_count: i64,
    pub requirement_count: i64,
    pub today_commit_count: i64,
    pub week_commit_count: i64,
    pub recent_projects: Vec<RecentProject>,
    pub recent_iterations: Vec<RecentIteration>,
    pub pending_sql_by_project: Vec<ProjectPendingCount>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentProject {
    pub id: i32,
    pub name: String,
    pub pending_sql_count: i64,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentIteration {
    pub id: i32,
    pub name: String,
    pub status: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProjectPendingCount {
    pub project_id: i32,
    pub project_name: String,
    pub count: i64,
}

pub fn get_overview(conn: &Connection) -> AppResult<DashboardOverview> {
    let project_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM project WHERE state = 1 AND deleted_at IS NULL", [], |r| r.get(0),
    ).unwrap_or(0);

    let active_project_count = project_count;

    let iteration_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM iteration WHERE state = 1 AND deleted_at IS NULL", [], |r| r.get(0),
    ).unwrap_or(0);

    let active_iteration_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM iteration WHERE state = 1 AND deleted_at IS NULL AND status IN ('developing', 'testing')", [], |r| r.get(0),
    ).unwrap_or(0);

    let pending_sql_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pending_sql WHERE state = 1 AND deleted_at IS NULL AND status = 'pending'", [], |r| r.get(0),
    ).unwrap_or(0);

    let requirement_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM requirement WHERE state = 1 AND deleted_at IS NULL", [], |r| r.get(0),
    ).unwrap_or(0);

    let today_commit_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM git_commit WHERE state = 1 AND date(committed_at) = date('now','localtime')", [], |r| r.get(0),
    ).unwrap_or(0);

    // 本周一开始
    let week_commit_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM git_commit WHERE state = 1 AND committed_at >= date('now','localtime','weekday 1','-7 days')", [], |r| r.get(0),
    ).unwrap_or(0);

    // 最近项目
    let mut proj_stmt = conn.prepare(
        "SELECT id, name, updated_at FROM project WHERE state = 1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5"
    )?;
    let recent_projects: Vec<RecentProject> = proj_stmt.query_map([], |row| {
        let id: i32 = row.get(0)?;
        Ok((id, row.get::<_, String>(1)?, row.get::<_, String>(2)?))
    })?.filter_map(|r| r.ok()).map(|(id, name, updated_at)| {
        let cnt: i64 = conn.query_row(
            "SELECT COUNT(*) FROM pending_sql WHERE project_id = ? AND state = 1 AND deleted_at IS NULL AND status = 'pending'",
            params![id], |r| r.get(0),
        ).unwrap_or(0);
        RecentProject { id, name, pending_sql_count: cnt, updated_at }
    }).collect();

    // 最近迭代
    let mut iter_stmt = conn.prepare(
        "SELECT id, name, status, updated_at FROM iteration WHERE state = 1 AND deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5"
    )?;
    let recent_iterations: Vec<RecentIteration> = iter_stmt.query_map([], |row| {
        Ok(RecentIteration {
            id: row.get(0)?,
            name: row.get(1)?,
            status: row.get(2)?,
            updated_at: row.get(3)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    // 按项目统计待执行SQL
    let mut sql_stmt = conn.prepare(
        "SELECT ps.project_id, p.name, COUNT(*) FROM pending_sql ps INNER JOIN project p ON ps.project_id = p.id WHERE ps.state = 1 AND ps.deleted_at IS NULL AND ps.status = 'pending' AND p.state = 1 GROUP BY ps.project_id ORDER BY COUNT(*) DESC"
    )?;
    let pending_sql_by_project: Vec<ProjectPendingCount> = sql_stmt.query_map([], |row| {
        Ok(ProjectPendingCount {
            project_id: row.get(0)?,
            project_name: row.get(1)?,
            count: row.get(2)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(DashboardOverview {
        project_count,
        active_project_count,
        iteration_count,
        active_iteration_count,
        pending_sql_count,
        requirement_count,
        today_commit_count,
        week_commit_count,
        recent_projects,
        recent_iterations,
        pending_sql_by_project,
    })
}
