use rusqlite::{params, params_from_iter, Connection};
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
    let start_date = req.start_date.as_deref().unwrap_or("").trim().to_string();
    let end_date = req.end_date.as_deref().unwrap_or("").trim().to_string();
    validate_date_range(&start_date, &end_date)?;

    conn.execute(
        "INSERT INTO iteration (name, description, status, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
        params![
            req.name.trim(),
            req.description.as_deref().unwrap_or("").trim(),
            req.status.as_deref().unwrap_or("planning").trim(),
            start_date,
            end_date,
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
    if req.start_date.is_some() || req.end_date.is_some() {
        let (current_start, current_end): (String, String) = conn
            .query_row(
                "SELECT start_date, end_date FROM iteration WHERE id = ? AND state = 1 AND deleted_at IS NULL",
                params![req.id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .map_err(|_| AppError::NotFound("Iteration not found".into()))?;

        let next_start = req
            .start_date
            .as_ref()
            .map(|value| value.trim().to_string())
            .unwrap_or(current_start);
        let next_end = req
            .end_date
            .as_ref()
            .map(|value| value.trim().to_string())
            .unwrap_or(current_end);
        validate_date_range(&next_start, &next_end)?;
    }

    let mut sets = vec![];
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &req.name {
        sets.push("name = ?");
        params_vec.push(Box::new(v.trim().to_string()));
    }
    if let Some(v) = &req.description {
        sets.push("description = ?");
        params_vec.push(Box::new(v.trim().to_string()));
    }
    if let Some(v) = &req.status {
        sets.push("status = ?");
        params_vec.push(Box::new(v.trim().to_string()));
    }
    if let Some(v) = &req.start_date {
        sets.push("start_date = ?");
        params_vec.push(Box::new(v.trim().to_string()));
    }
    if let Some(v) = &req.end_date {
        sets.push("end_date = ?");
        params_vec.push(Box::new(v.trim().to_string()));
    }

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

pub fn delete_iteration(conn: &mut Connection, id: i32) -> AppResult<()> {
    let tx = conn.transaction()?;
    delete_iteration_inner(&tx, id)?;
    tx.commit()?;
    Ok(())
}

/// 在已有事务或连接上执行级联删除（不创建新事务）
pub fn delete_iteration_inner(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute("UPDATE iteration SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?", params![id])?;
    conn.execute("UPDATE iteration_project SET deleted_at = datetime('now','localtime'), state = 0 WHERE iteration_id = ?", params![id])?;

    let requirement_ids = collect_ids(
        conn,
        "SELECT id FROM requirement WHERE iteration_id = ? AND state = 1 AND deleted_at IS NULL",
        id,
    )?;
    soft_delete_requirements(conn, &requirement_ids)?;

    let sql_ids = collect_ids(
        conn,
        "SELECT id FROM pending_sql WHERE iteration_id = ? AND state = 1 AND deleted_at IS NULL",
        id,
    )?;
    soft_delete_sqls(conn, &sql_ids)?;

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

fn validate_date_range(start_date: &str, end_date: &str) -> AppResult<()> {
    let start = start_date.trim();
    let end = end_date.trim();
    if !start.is_empty() && !end.is_empty() && end < start {
        return Err(AppError::BadRequest("end_date cannot be earlier than start_date".into()));
    }
    Ok(())
}

fn collect_ids(conn: &Connection, sql: &str, scope_id: i32) -> AppResult<Vec<i32>> {
    let mut stmt = conn.prepare(sql)?;
    let ids = stmt
        .query_map(params![scope_id], |row| row.get::<_, i32>(0))?
        .filter_map(|row| row.ok())
        .collect();
    Ok(ids)
}

fn soft_delete_requirements(conn: &Connection, requirement_ids: &[i32]) -> AppResult<()> {
    if requirement_ids.is_empty() {
        return Ok(());
    }

    let placeholders = std::iter::repeat("?")
        .take(requirement_ids.len())
        .collect::<Vec<_>>()
        .join(",");

    let requirement_sql = format!(
        "UPDATE requirement SET deleted_at = datetime('now','localtime'), state = 0 WHERE id IN ({}) AND state = 1 AND deleted_at IS NULL",
        placeholders
    );
    conn.execute(&requirement_sql, params_from_iter(requirement_ids.iter()))?;

    let project_sql = format!(
        "UPDATE requirement_project SET deleted_at = datetime('now','localtime'), state = 0 WHERE requirement_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&project_sql, params_from_iter(requirement_ids.iter()))?;

    let work_item_sql = format!(
        "UPDATE work_item_link SET deleted_at = datetime('now','localtime'), state = 0 WHERE work_item_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&work_item_sql, params_from_iter(requirement_ids.iter()))?;

    let requirement_link_sql = format!(
        "UPDATE work_item_link SET deleted_at = datetime('now','localtime'), state = 0 WHERE link_type = 'requirement' AND link_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&requirement_link_sql, params_from_iter(requirement_ids.iter()))?;

    Ok(())
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

    let execution_log_update = format!(
        "UPDATE sql_execution_log SET deleted_at = datetime('now','localtime'), state = 0 WHERE sql_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&execution_log_update, params_from_iter(sql_ids.iter()))?;

    let work_link_update = format!(
        "UPDATE work_item_link SET deleted_at = datetime('now','localtime'), state = 0 WHERE link_type = 'sql' AND link_id IN ({}) AND state = 1",
        placeholders
    );
    conn.execute(&work_link_update, params_from_iter(sql_ids.iter()))?;

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
        "SELECT COUNT(DISTINCT ps.id) FROM pending_sql ps \
         WHERE ps.state = 1 AND ps.deleted_at IS NULL \
         AND (ps.iteration_id = ? \
              OR ps.id IN ( \
                SELECT wil.link_id FROM work_item_link wil \
                INNER JOIN requirement r ON wil.work_item_id = r.id \
                WHERE wil.link_type = 'sql' AND wil.state = 1 \
                  AND r.iteration_id = ? AND r.state = 1 AND r.deleted_at IS NULL \
              ))",
        params![iter.id, iter.id], |row| row.get(0),
    ).unwrap_or(0);

    Ok(IterationDetailRsp {
        iteration: iter,
        project_ids: pids,
        project_names,
        requirement_count: req_count,
        pending_sql_count: sql_count,
    })
}
