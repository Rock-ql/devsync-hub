use rusqlite::{params, Connection};
use crate::error::{AppError, AppResult};
use crate::models::pending_sql::*;
use crate::models::common::PageResult;

pub fn list_sql(conn: &Connection, req: &PendingSqlListReq) -> AppResult<PageResult<PendingSqlDetailRsp>> {
    let page = req.page.unwrap_or(1);
    let size = req.size.unwrap_or(20);
    let offset = (page - 1) * size;

    let mut where_clause = "WHERE ps.state = 1 AND ps.deleted_at IS NULL".to_string();
    let mut params_vec: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(pid) = req.project_id {
        where_clause.push_str(" AND ps.project_id = ?");
        params_vec.push(Box::new(pid));
    }
    if let Some(iid) = req.iteration_id {
        where_clause.push_str(" AND ps.iteration_id = ?");
        params_vec.push(Box::new(iid));
    }
    if let Some(kw) = &req.keyword {
        if !kw.is_empty() {
            where_clause.push_str(" AND ps.title LIKE ?");
            params_vec.push(Box::new(format!("%{}%", kw)));
        }
    }

    let count_sql = format!("SELECT COUNT(*) FROM pending_sql ps {}", where_clause);
    let count_refs: Vec<&dyn rusqlite::types::ToSql> = params_vec.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
    let total: i64 = conn.query_row(&count_sql, count_refs.as_slice(), |row| row.get(0))?;

    let query_sql = format!(
        "SELECT ps.id, ps.project_id, ps.iteration_id, ps.title, ps.content, ps.execution_order, ps.status, ps.executed_at, ps.executed_env, ps.remark, ps.state, ps.created_at, ps.updated_at FROM pending_sql ps {} ORDER BY ps.execution_order ASC, ps.id DESC LIMIT ? OFFSET ?",
        where_clause
    );
    let mut qp: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];
    if let Some(pid) = req.project_id { qp.push(Box::new(pid)); }
    if let Some(iid) = req.iteration_id { qp.push(Box::new(iid)); }
    if let Some(kw) = &req.keyword { if !kw.is_empty() { qp.push(Box::new(format!("%{}%", kw))); } }
    qp.push(Box::new(size));
    qp.push(Box::new(offset));
    let qrefs: Vec<&dyn rusqlite::types::ToSql> = qp.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();

    let mut stmt = conn.prepare(&query_sql)?;
    let rows = stmt.query_map(qrefs.as_slice(), |row| {
        Ok(PendingSql {
            id: row.get(0)?, project_id: row.get(1)?, iteration_id: row.get(2)?,
            title: row.get(3)?, content: row.get(4)?, execution_order: row.get(5)?,
            status: row.get(6)?, executed_at: row.get(7)?, executed_env: row.get(8)?,
            remark: row.get(9)?, state: row.get(10)?, created_at: row.get(11)?, updated_at: row.get(12)?,
        })
    })?;

    let sqls: Vec<PendingSql> = rows.filter_map(|r| r.ok()).collect();
    let mut results = vec![];

    for sql in sqls {
        let detail = enrich_sql(conn, sql, req.status.as_deref())?;
        if let Some(d) = detail {
            results.push(d);
        }
    }

    Ok(PageResult { records: results, total, page, size })
}

pub fn get_sql_detail(conn: &Connection, id: i32) -> AppResult<PendingSqlDetailRsp> {
    let sql = conn.query_row(
        "SELECT id, project_id, iteration_id, title, content, execution_order, status, executed_at, executed_env, remark, state, created_at, updated_at FROM pending_sql WHERE id = ? AND state = 1 AND deleted_at IS NULL",
        params![id],
        |row| Ok(PendingSql {
            id: row.get(0)?, project_id: row.get(1)?, iteration_id: row.get(2)?,
            title: row.get(3)?, content: row.get(4)?, execution_order: row.get(5)?,
            status: row.get(6)?, executed_at: row.get(7)?, executed_env: row.get(8)?,
            remark: row.get(9)?, state: row.get(10)?, created_at: row.get(11)?, updated_at: row.get(12)?,
        }),
    ).map_err(|_| AppError::NotFound("SQL not found".into()))?;
    enrich_sql(conn, sql, None)?.ok_or_else(|| AppError::NotFound("SQL not found".into()))
}

pub fn add_sql(conn: &Connection, req: &PendingSqlAddReq) -> AppResult<i32> {
    let max_order: i32 = conn.query_row(
        "SELECT COALESCE(MAX(execution_order), 0) FROM pending_sql WHERE iteration_id = ? AND state = 1",
        params![req.iteration_id], |row| row.get(0),
    ).unwrap_or(0);

    let order = req.execution_order.unwrap_or(max_order + 1);
    conn.execute(
        "INSERT INTO pending_sql (project_id, iteration_id, title, content, execution_order, remark) VALUES (?, ?, ?, ?, ?, ?)",
        params![req.project_id, req.iteration_id, req.title, req.content, order, req.remark.as_deref().unwrap_or("")],
    )?;
    Ok(conn.last_insert_rowid() as i32)
}

pub fn update_sql(conn: &Connection, req: &PendingSqlUpdateReq) -> AppResult<()> {
    let mut sets = vec![];
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &req.title { sets.push("title = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.content { sets.push("content = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.execution_order { sets.push("execution_order = ?"); pv.push(Box::new(*v)); }
    if let Some(v) = &req.remark { sets.push("remark = ?"); pv.push(Box::new(v.clone())); }

    if !sets.is_empty() {
        sets.push("updated_at = datetime('now','localtime')");
        pv.push(Box::new(req.id));
        let sql = format!("UPDATE pending_sql SET {} WHERE id = ?", sets.join(", "));
        let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, refs.as_slice())?;
    }
    Ok(())
}

pub fn delete_sql(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute("UPDATE pending_sql SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?", params![id])?;
    Ok(())
}

pub fn execute_sql(conn: &Connection, req: &PendingSqlExecuteReq) -> AppResult<()> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM sql_execution_log WHERE sql_id = ? AND env = ? AND state = 1",
        params![req.id, req.env], |row| row.get(0),
    ).unwrap_or(0);
    if exists > 0 {
        return Err(AppError::BadRequest(format!("SQL already executed in {} environment", req.env)));
    }

    conn.execute(
        "INSERT INTO sql_execution_log (sql_id, env, executor, remark) VALUES (?, ?, ?, ?)",
        params![req.id, req.env, req.executor.as_deref().unwrap_or(""), req.remark.as_deref().unwrap_or("")],
    )?;
    Ok(())
}

pub fn batch_execute_sql(conn: &Connection, req: &PendingSqlBatchExecuteReq) -> AppResult<()> {
    for id in &req.ids {
        let single = PendingSqlExecuteReq {
            id: *id,
            env: req.env.clone(),
            executor: req.executor.clone(),
            remark: req.remark.clone(),
        };
        execute_sql(conn, &single).ok();
    }
    Ok(())
}

pub fn revoke_execution(conn: &Connection, req: &SqlExecutionRevokeReq) -> AppResult<()> {
    conn.execute(
        "DELETE FROM sql_execution_log WHERE sql_id = ? AND env = ?",
        params![req.sql_id, req.env],
    )?;
    Ok(())
}

fn enrich_sql(conn: &Connection, sql: PendingSql, status_filter: Option<&str>) -> AppResult<Option<PendingSqlDetailRsp>> {
    let project_name: String = conn.query_row(
        "SELECT name FROM project WHERE id = ?", params![sql.project_id], |row| row.get(0),
    ).unwrap_or_default();

    let iteration_name: String = conn.query_row(
        "SELECT name FROM iteration WHERE id = ?", params![sql.iteration_id], |row| row.get(0),
    ).unwrap_or_default();

    // 获取环境配置
    let mut env_stmt = conn.prepare(
        "SELECT env_code, env_name FROM sql_env_config WHERE project_id = ? AND state = 1 ORDER BY sort_order"
    )?;
    let envs: Vec<(String, String)> = env_stmt.query_map(params![sql.project_id], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
    })?.filter_map(|r| r.ok()).collect();

    // 获取执行日志
    let mut log_stmt = conn.prepare(
        "SELECT env, executed_at, executor, remark FROM sql_execution_log WHERE sql_id = ? AND state = 1"
    )?;
    let logs: Vec<SqlExecutionLog> = log_stmt.query_map(params![sql.id], |row| {
        Ok(SqlExecutionLog {
            id: 0,
            sql_id: sql.id,
            env: row.get(0)?,
            executed_at: row.get(1)?,
            executor: row.get(2)?,
            remark: row.get(3)?,
        })
    })?.filter_map(|r| r.ok()).collect();

    let mut env_executions = vec![];
    let mut executed_count = 0;
    for (code, name) in &envs {
        let log = logs.iter().find(|l| &l.env == code);
        let executed = log.is_some();
        if executed { executed_count += 1; }
        env_executions.push(EnvExecution {
            env_code: code.clone(),
            env_name: name.clone(),
            executed,
            executed_at: log.map(|l| l.executed_at.clone()),
            executor: log.map(|l| l.executor.clone()),
            remark: log.map(|l| l.remark.clone()),
        });
    }

    let total_envs = envs.len();
    let execution_status = if executed_count == 0 {
        "pending".to_string()
    } else if executed_count >= total_envs {
        "completed".to_string()
    } else {
        "partial".to_string()
    };

    let completion_percent = if total_envs > 0 {
        (executed_count as f64 / total_envs as f64) * 100.0
    } else {
        0.0
    };

    // 状态过滤
    if let Some(sf) = status_filter {
        if !sf.is_empty() && sf != execution_status {
            return Ok(None);
        }
    }

    // 关联需求
    let linked_req: Option<String> = conn.query_row(
        "SELECT r.name FROM work_item_link wil INNER JOIN requirement r ON wil.work_item_id = r.id WHERE wil.link_type = 'sql' AND wil.link_id = ? AND wil.state = 1 AND r.state = 1",
        params![sql.id], |row| row.get(0),
    ).ok();

    Ok(Some(PendingSqlDetailRsp {
        sql,
        project_name,
        iteration_name,
        env_executions,
        execution_status,
        completion_percent,
        linked_requirement: linked_req,
    }))
}
