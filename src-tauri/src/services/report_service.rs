use rusqlite::{params, Connection};
use crate::error::{AppError, AppResult};
use crate::models::report::*;
use crate::models::common::PageResult;

pub fn list_reports(conn: &Connection, req: &ReportListReq) -> AppResult<PageResult<Report>> {
    let page = req.page.unwrap_or(1);
    let size = req.size.unwrap_or(20);
    let offset = (page - 1) * size;

    let mut wc = "WHERE state = 1 AND deleted_at IS NULL".to_string();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(t) = &req.r#type {
        if !t.is_empty() {
            wc.push_str(" AND type = ?");
            pv.push(Box::new(t.clone()));
        }
    }
    if let Some(kw) = &req.keyword {
        if !kw.is_empty() {
            wc.push_str(" AND (title LIKE ? OR content LIKE ?)");
            pv.push(Box::new(format!("%{}%", kw)));
            pv.push(Box::new(format!("%{}%", kw)));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM report {}", wc);
    let crefs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
    let total: i64 = conn.query_row(&count_sql, crefs.as_slice(), |r| r.get(0))?;

    let qsql = format!(
        "SELECT id, type, title, content, start_date, end_date, commit_summary, state, created_at, updated_at FROM report {} ORDER BY id DESC LIMIT ? OFFSET ?",
        wc
    );
    let mut qp: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(t) = &req.r#type { if !t.is_empty() { qp.push(Box::new(t.clone())); } }
    if let Some(kw) = &req.keyword { if !kw.is_empty() { qp.push(Box::new(format!("%{}%", kw))); qp.push(Box::new(format!("%{}%", kw))); } }
    qp.push(Box::new(size));
    qp.push(Box::new(offset));
    let qrefs: Vec<&dyn rusqlite::types::ToSql> = qp.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();

    let mut stmt = conn.prepare(&qsql)?;
    let rows = stmt.query_map(qrefs.as_slice(), |row| {
        Ok(Report {
            id: row.get(0)?, r#type: row.get(1)?, title: row.get(2)?, content: row.get(3)?,
            start_date: row.get(4)?, end_date: row.get(5)?, commit_summary: row.get(6)?,
            state: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)?,
        })
    })?;
    let records: Vec<Report> = rows.filter_map(|r| r.ok()).collect();
    Ok(PageResult { records, total, page, size })
}

pub fn get_report_detail(conn: &Connection, id: i32) -> AppResult<Report> {
    conn.query_row(
        "SELECT id, type, title, content, start_date, end_date, commit_summary, state, created_at, updated_at FROM report WHERE id = ? AND state = 1",
        params![id],
        |row| Ok(Report {
            id: row.get(0)?, r#type: row.get(1)?, title: row.get(2)?, content: row.get(3)?,
            start_date: row.get(4)?, end_date: row.get(5)?, commit_summary: row.get(6)?,
            state: row.get(7)?, created_at: row.get(8)?, updated_at: row.get(9)?,
        }),
    ).map_err(|_| AppError::NotFound("Report not found".into()))
}

/// Prepare data for report generation (sync DB reads only)
pub fn generate_report_prepare(conn: &Connection, req: &ReportGenerateReq) -> AppResult<GenerateReportContext> {
    let mut commit_sql = "SELECT gc.project_id, p.name, gc.message, gc.author_name, gc.author_email, gc.committed_at, gc.branch FROM git_commit gc INNER JOIN project p ON gc.project_id = p.id WHERE gc.state = 1 AND gc.committed_at >= ? AND gc.committed_at <= ?".to_string();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![
        Box::new(format!("{} 00:00:00", req.start_date)),
        Box::new(format!("{} 23:59:59", req.end_date)),
    ];

    if let Some(email) = &req.author_email {
        if !email.is_empty() {
            commit_sql.push_str(" AND gc.author_email = ?");
            pv.push(Box::new(email.clone()));
        }
    }
    if let Some(pids) = &req.project_ids {
        if !pids.is_empty() {
            let placeholders: Vec<String> = pids.iter().map(|_| "?".to_string()).collect();
            commit_sql.push_str(&format!(" AND gc.project_id IN ({})", placeholders.join(",")));
            for pid in pids {
                pv.push(Box::new(*pid));
            }
        }
    }
    commit_sql.push_str(" ORDER BY gc.committed_at ASC");

    let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
    let mut stmt = conn.prepare(&commit_sql)?;

    struct CommitRow { project_name: String, message: String }

    let commits: Vec<CommitRow> = stmt.query_map(refs.as_slice(), |row| {
        Ok(CommitRow { project_name: row.get(1)?, message: row.get(2)? })
    })?.filter_map(|r| r.ok())
    .filter(|c| !c.message.starts_with("Merge"))
    .collect();

    if commits.is_empty() {
        return Err(AppError::BadRequest("No commits found in the specified date range".into()));
    }

    let mut project_commits: std::collections::HashMap<String, Vec<String>> = std::collections::HashMap::new();
    for c in &commits {
        project_commits.entry(c.project_name.clone()).or_default().push(c.message.clone());
    }

    let commit_summary = serde_json::to_string(&project_commits).unwrap_or_default();

    let type_label = if req.r#type == "daily" { "日报".to_string() } else { "周报".to_string() };
    let mut prompt = format!(
        "请根据以下 Git 提交记录生成一份{}（{}至{}）。\n\n按项目分组，每个项目列出主要工作内容，使用 Markdown 格式。\n\n提交记录：\n",
        type_label, req.start_date, req.end_date
    );
    for (project, msgs) in &project_commits {
        prompt.push_str(&format!("\n## {}\n", project));
        for msg in msgs {
            prompt.push_str(&format!("- {}\n", msg));
        }
    }

    let template: Option<String> = conn.query_row(
        "SELECT content FROM report_template WHERE type = ? AND is_default = 1 AND state = 1",
        params![req.r#type], |row| row.get(0),
    ).ok();
    if let Some(tpl) = &template {
        prompt.push_str(&format!("\n\n请参考以下模板格式：\n{}", tpl));
    }

    let base_url: String = conn.query_row(
        "SELECT setting_value FROM system_setting WHERE setting_key = 'deepseek_base_url' AND state = 1",
        [], |r| r.get(0),
    ).unwrap_or_else(|_| "https://api.deepseek.com".to_string());

    let api_key: String = conn.query_row(
        "SELECT setting_value FROM system_setting WHERE setting_key = 'deepseek_api_key' AND state = 1",
        [], |r| r.get(0),
    ).unwrap_or_default();

    Ok(GenerateReportContext {
        commit_summary, project_commits, type_label, prompt, base_url, api_key,
    })
}

/// Context data collected from DB for report generation
pub struct GenerateReportContext {
    pub commit_summary: String,
    pub project_commits: std::collections::HashMap<String, Vec<String>>,
    pub type_label: String,
    pub prompt: String,
    pub base_url: String,
    pub api_key: String,
}

/// Insert generated report into DB (after async AI call)
pub fn generate_report_insert(conn: &Connection, req: &ReportGenerateReq, ctx: &GenerateReportContext, content: &str) -> AppResult<Report> {
    let title = format!("{} ({} ~ {})", ctx.type_label, req.start_date, req.end_date);
    conn.execute(
        "INSERT INTO report (type, title, content, start_date, end_date, commit_summary) VALUES (?, ?, ?, ?, ?, ?)",
        params![req.r#type, title, content, req.start_date, req.end_date, ctx.commit_summary],
    )?;
    let id = conn.last_insert_rowid() as i32;
    get_report_detail(conn, id)
}

/// Generate fallback content when AI is unavailable
pub fn generate_fallback(project_commits: &std::collections::HashMap<String, Vec<String>>, type_label: &str) -> String {
    generate_fallback_content(project_commits, type_label)
}

pub fn update_report(conn: &Connection, req: &ReportUpdateReq) -> AppResult<()> {
    let mut sets = vec![];
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &req.title { sets.push("title = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.content { sets.push("content = ?"); pv.push(Box::new(v.clone())); }

    if !sets.is_empty() {
        sets.push("updated_at = datetime('now','localtime')");
        pv.push(Box::new(req.id));
        let sql = format!("UPDATE report SET {} WHERE id = ?", sets.join(", "));
        let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, refs.as_slice())?;
    }
    Ok(())
}

pub fn delete_report(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute("UPDATE report SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?", params![id])?;
    Ok(())
}

pub fn get_month_summary(conn: &Connection, req: &ReportMonthSummaryReq) -> AppResult<MonthSummaryRsp> {
    let start = format!("{:04}-{:02}-01", req.year, req.month);
    let end = if req.month == 12 {
        format!("{:04}-01-01", req.year + 1)
    } else {
        format!("{:04}-{:02}-01", req.year, req.month + 1)
    };

    let mut daily_stmt = conn.prepare(
        "SELECT id, title, start_date, end_date, created_at FROM report WHERE type = 'daily' AND state = 1 AND deleted_at IS NULL AND start_date >= ? AND start_date < ? ORDER BY start_date"
    )?;
    let daily_reports: Vec<ReportBrief> = daily_stmt.query_map(params![start, end], |row| {
        Ok(ReportBrief {
            id: row.get(0)?, title: row.get(1)?, start_date: row.get(2)?,
            end_date: row.get(3)?, created_at: row.get(4)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    let mut weekly_stmt = conn.prepare(
        "SELECT id, title, start_date, end_date, created_at FROM report WHERE type = 'weekly' AND state = 1 AND deleted_at IS NULL AND start_date >= ? AND start_date < ? ORDER BY start_date"
    )?;
    let weekly_reports: Vec<ReportBrief> = weekly_stmt.query_map(params![start, end], |row| {
        Ok(ReportBrief {
            id: row.get(0)?, title: row.get(1)?, start_date: row.get(2)?,
            end_date: row.get(3)?, created_at: row.get(4)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    Ok(MonthSummaryRsp { daily_reports, weekly_reports })
}

fn generate_fallback_content(
    project_commits: &std::collections::HashMap<String, Vec<String>>,
    type_label: &str,
) -> String {
    let mut content = format!("# {}\n\n", type_label);
    for (project, msgs) in project_commits {
        content.push_str(&format!("## {}\n\n", project));
        for msg in msgs {
            content.push_str(&format!("- {}\n", msg));
        }
        content.push('\n');
    }
    content
}
