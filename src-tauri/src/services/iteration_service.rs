use rusqlite::{params, Connection};
use crate::error::{AppError, AppResult};
use crate::models::iteration::*;
use crate::models::common::PageResult;

pub fn list_iterations(conn: &Connection, req: &IterationListReq) -> AppResult<PageResult<IterationDetailRsp>> {
    let page = req.page.unwrap_or(1);
    let size = req.size.unwrap_or(20);
    let offset = (page - 1) * size;

    let mut where_clause = "WHERE i.state = 1 AND i.deleted_at IS NULL".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(pid) = req.project_id {
        where_clause.push_str(" AND i.id IN (SELECT iteration_id FROM iteration_project WHERE project_id = ? AND state = 1 AND deleted_at IS NULL)");
        params_vec.push(Box::new(pid));
    }
    if let Some(status) = &req.status {
        if !status.is_empty() {
            where_clause.push_str(" AND i.status = ?");
            params_vec.push(Box::new(status.clone()));
        }
    }
    if let Some(kw) = &req.keyword {
        if !kw.is_empty() {
            where_clause.push_str(" AND i.name LIKE ?");
            params_vec.push(Box::new(format!("%{}%", kw)));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM iteration i {}", where_clause);
    let count_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
    let total: i64 = conn.query_row(&count_sql, count_refs.as_slice(), |row| row.get(0))?;

    let query_sql = format!(
        "SELECT i.id, i.project_id, i.name, i.description, i.status, i.start_date, i.end_date, i.state, i.created_at, i.updated_at FROM iteration i {} ORDER BY i.id DESC LIMIT ? OFFSET ?",
        where_clause
    );
    let mut query_params: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(pid) = req.project_id { query_params.push(Box::new(pid)); }
    if let Some(status) = &req.status { if !status.is_empty() { query_params.push(Box::new(status.clone())); } }
    if let Some(kw) = &req.keyword { if !kw.is_empty() { query_params.push(Box::new(format!("%{}%", kw))); } }
    query_params.push(Box::new(size));
    query_params.push(Box::new(offset));
    let query_refs: Vec<&dyn rusqlite::types::ToSql> = query_params.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();

    let mut stmt = conn.prepare(&query_sql)?;
    let rows = stmt.query_map(query_refs.as_slice(), |row| {
        Ok(Iteration {
            id: row.get(0)?,
            project_id: row.get(1)?,
            name: row.get(2)?,
            description: row.get(3)?,
            status: row.get(4)?,
            start_date: row.get(5)?,
            end_date: row.get(6)?,
            state: row.get(7)?,
            created_at: row.get(8)?,
            updated_at: row.get(9)?,
        })
    })?;

    let iterations: Vec<Iteration> = rows.filter_map(|r| r.ok()).collect();
    let mut results = vec![];

    for iter in iterations {
        let detail = enrich_iteration(conn, iter)?;
        results.push(detail);
    }

    Ok(PageResult { records: results, total, page, size })
}

pub fn list_by_project(conn: &Connection, project_id: i32) -> AppResult<Vec<Iteration>> {
    let mut stmt = conn.prepare(
        "SELECT i.id, i.project_id, i.name, i.description, i.status, i.start_date, i.end_date, i.state, i.created_at, i.updated_at FROM iteration i INNER JOIN iteration_project ip ON i.id = ip.iteration_id AND ip.state = 1 AND ip.deleted_at IS NULL WHERE i.state = 1 AND i.deleted_at IS NULL AND ip.project_id = ? ORDER BY i.id DESC"
    )?;
    let rows = stmt.query_map(params![project_id], |row| {
        Ok(Iteration {
            id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, description: row.get(3)?,
            status: row.get(4)?, start_date: row.get(5)?, end_date: row.get(6)?, state: row.get(7)?,
            created_at: row.get(8)?, updated_at: row.get(9)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_iteration_detail(conn: &Connection, id: i32) -> AppResult<IterationDetailRsp> {
    let iter = conn.query_row(
        "SELECT id, project_id, name, description, status, start_date, end_date, state, created_at, updated_at FROM iteration WHERE id = ? AND state = 1 AND deleted_at IS NULL",
        params![id],
        |row| Ok(Iteration {
            id: row.get(0)?, project_id: row.get(1)?, name: row.get(2)?, description: row.get(3)?,
            status: row.get(4)?, start_date: row.get(5)?, end_date: row.get(6)?, state: row.get(7)?,
            created_at: row.get(8)?, updated_at: row.get(9)?,
        }),
    ).map_err(|_| AppError::NotFound("Iteration not found".into()))?;
    enrich_iteration(conn, iter)
}

pub fn add_iteration(conn: &Connection, req: &IterationAddReq) -> AppResult<i32> {
    conn.execute(
        "INSERT INTO iteration (name, description, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
        params![
            req.name,
            req.description.as_deref().unwrap_or(""),
            req.status.as_deref().unwrap_or("planning"),
            req.start_date.as_deref().unwrap_or(""),
            req.end_date.as_deref().unwrap_or(""),
        ],
    )?;
    let id = conn.last_insert_rowid() as i32;

    if let Some(project_ids) = &req.project_ids {
        for pid in project_ids {
            conn.execute(
                "INSERT INTO iteration_project (iteration_id, project_id) VALUES (?, ?)",
                params![id, pid],
            )?;
        }
    }
    Ok(id)
}

pub fn update_iteration(conn: &Connection, req: &IterationUpdateReq) -> AppResult<()> {
    let mut sets = vec![];
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &req.name { sets.push("name = ?"); params_vec.push(Box::new(v.clone())); }
    if let Some(v) = &req.description { sets.push("description = ?"); params_vec.push(Box::new(v.clone())); }
    if let Some(v) = &req.status { sets.push("status = ?"); params_vec.push(Box::new(v.clone())); }
    if let Some(v) = &req.start_date { sets.push("start_date = ?"); params_vec.push(Box::new(v.clone())); }
    if let Some(v) = &req.end_date { sets.push("end_date = ?"); params_vec.push(Box::new(v.clone())); }

    if !sets.is_empty() {
        sets.push("updated_at = datetime('now','localtime')");
        params_vec.push(Box::new(req.id));
        let sql = format!("UPDATE iteration SET {} WHERE id = ?", sets.join(", "));
        let refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, refs.as_slice())?;
    }

    if let Some(project_ids) = &req.project_ids {
        conn.execute("UPDATE iteration_project SET state = 0, deleted_at = datetime('now','localtime') WHERE iteration_id = ?", params![req.id])?;
        for pid in project_ids {
            conn.execute(
                "INSERT INTO iteration_project (iteration_id, project_id) VALUES (?, ?)",
                params![req.id, pid],
            )?;
        }
    }
    Ok(())
}

pub fn delete_iteration(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute("UPDATE iteration SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?", params![id])?;
    conn.execute("UPDATE iteration_project SET deleted_at = datetime('now','localtime'), state = 0 WHERE iteration_id = ?", params![id])?;
    Ok(())
}

pub fn update_status(conn: &Connection, id: i32, status: &str) -> AppResult<()> {
    let valid = ["planning", "developing", "testing", "released"];
    if !valid.contains(&status) {
        return Err(AppError::BadRequest(format!("Invalid status: {}", status)));
    }
    conn.execute("UPDATE iteration SET status = ?, updated_at = datetime('now','localtime') WHERE id = ? AND state = 1", params![status, id])?;
    Ok(())
}

fn enrich_iteration(conn: &Connection, iter: Iteration) -> AppResult<IterationDetailRsp> {
    let mut stmt = conn.prepare("SELECT project_id FROM iteration_project WHERE iteration_id = ? AND state = 1 AND deleted_at IS NULL")?;
    let pids: Vec<i32> = stmt.query_map(params![iter.id], |row| row.get(0))?.filter_map(|r| r.ok()).collect();

    let project_names: Vec<String> = pids.iter().filter_map(|pid| {
        conn.query_row("SELECT name FROM project WHERE id = ? AND state = 1", params![pid], |row| row.get(0)).ok()
    }).collect();

    let req_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM requirement WHERE iteration_id = ? AND state = 1 AND deleted_at IS NULL",
        params![iter.id], |row| row.get(0),
    ).unwrap_or(0);

    let sql_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pending_sql WHERE iteration_id = ? AND state = 1 AND deleted_at IS NULL AND status = 'pending'",
        params![iter.id], |row| row.get(0),
    ).unwrap_or(0);

    Ok(IterationDetailRsp {
        iteration: iter,
        project_ids: pids,
        project_names,
        requirement_count: req_count,
        pending_sql_count: sql_count,
    })
}
