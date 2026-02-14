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
    pub requirement_status_dist: Vec<StatusCount>,
    pub daily_commit_trend: Vec<DailyCommitCount>,
    pub recent_reports: Vec<RecentReport>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct StatusCount {
    pub status: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DailyCommitCount {
    pub date: String,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecentReport {
    pub id: i32,
    pub r#type: String,
    pub title: String,
    pub created_at: String,
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
        "SELECT ps.project_id, p.name, COUNT(*) FROM pending_sql ps \
         INNER JOIN project p ON ps.project_id = p.id \
         WHERE ps.state = 1 AND ps.deleted_at IS NULL AND ps.status = 'pending' AND p.state = 1 \
         GROUP BY ps.project_id ORDER BY COUNT(*) DESC"
    )?;
    let pending_sql_by_project: Vec<ProjectPendingCount> = sql_stmt.query_map([], |row| {
        Ok(ProjectPendingCount {
            project_id: row.get(0)?,
            project_name: row.get(1)?,
            count: row.get(2)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    // 需求状态分布
    let mut req_stmt = conn.prepare(
        "SELECT status, COUNT(*) FROM requirement WHERE state = 1 AND deleted_at IS NULL GROUP BY status ORDER BY COUNT(*) DESC"
    )?;
    let requirement_status_dist: Vec<StatusCount> = req_stmt.query_map([], |row| {
        Ok(StatusCount { status: row.get(0)?, count: row.get(1)? })
    })?.filter_map(|r| r.ok()).collect();

    // 近7天提交趋势
    let mut trend_stmt = conn.prepare(
        "SELECT d.date, COALESCE(c.cnt, 0) FROM ( \
             SELECT date('now','localtime','-6 days') AS date \
             UNION ALL SELECT date('now','localtime','-5 days') \
             UNION ALL SELECT date('now','localtime','-4 days') \
             UNION ALL SELECT date('now','localtime','-3 days') \
             UNION ALL SELECT date('now','localtime','-2 days') \
             UNION ALL SELECT date('now','localtime','-1 days') \
             UNION ALL SELECT date('now','localtime') \
         ) d LEFT JOIN ( \
             SELECT SUBSTR(committed_at, 1, 10) AS dt, COUNT(*) AS cnt \
             FROM git_commit WHERE state = 1 \
             AND SUBSTR(committed_at, 1, 10) >= date('now','localtime','-6 days') \
             GROUP BY dt \
         ) c ON d.date = c.dt ORDER BY d.date"
    )?;
    let daily_commit_trend: Vec<DailyCommitCount> = trend_stmt.query_map([], |row| {
        Ok(DailyCommitCount { date: row.get(0)?, count: row.get(1)? })
    })?.filter_map(|r| r.ok()).collect();

    // 最近报告
    let mut rpt_stmt = conn.prepare(
        "SELECT id, type, title, created_at FROM report WHERE state = 1 AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 5"
    )?;
    let recent_reports: Vec<RecentReport> = rpt_stmt.query_map([], |row| {
        Ok(RecentReport {
            id: row.get(0)?,
            r#type: row.get(1)?,
            title: row.get(2)?,
            created_at: row.get(3)?,
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
        requirement_status_dist,
        daily_commit_trend,
        recent_reports,
    })
}
