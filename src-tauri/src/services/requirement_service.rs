use rusqlite::{params, Connection};
use crate::error::AppResult;
use crate::models::requirement::*;

pub fn list_requirements(conn: &Connection, req: &RequirementListReq) -> AppResult<Vec<RequirementDetailRsp>> {
    let mut where_clause = "WHERE r.iteration_id = ? AND r.state = 1 AND r.deleted_at IS NULL".to_string();
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![Box::new(req.iteration_id)];

    if let Some(status) = &req.status {
        if !status.is_empty() {
            where_clause.push_str(" AND r.status = ?");
            pv.push(Box::new(status.clone()));
        }
    }

    let sql = format!(
        "SELECT r.id, r.iteration_id, r.name, r.requirement_code, r.environment, r.link, r.status, r.branch, r.state, r.created_at, r.updated_at FROM requirement r {} ORDER BY r.id DESC",
        where_clause
    );
    let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();

    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map(refs.as_slice(), |row| {
        Ok(Requirement {
            id: row.get(0)?, iteration_id: row.get(1)?, name: row.get(2)?,
            requirement_code: row.get(3)?, environment: row.get(4)?, link: row.get(5)?,
            status: row.get(6)?, branch: row.get(7)?, state: row.get(8)?,
            created_at: row.get(9)?, updated_at: row.get(10)?,
        })
    })?;

    let reqs: Vec<Requirement> = rows.filter_map(|r| r.ok()).collect();
    let mut results = vec![];
    for r in reqs {
        results.push(enrich_requirement(conn, r)?);
    }
    Ok(results)
}

pub fn add_requirement(conn: &Connection, req: &RequirementAddReq) -> AppResult<i32> {
    conn.execute(
        "INSERT INTO requirement (iteration_id, name, requirement_code, environment, link, status, branch) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params![
            req.iteration_id, req.name,
            req.requirement_code.as_deref().unwrap_or(""),
            req.environment.as_deref().unwrap_or(""),
            req.link.as_deref().unwrap_or(""),
            req.status.as_deref().unwrap_or("pending_dev"),
            req.branch.as_deref().unwrap_or(""),
        ],
    )?;
    let id = conn.last_insert_rowid() as i32;

    if let Some(pids) = &req.project_ids {
        for pid in pids {
            conn.execute(
                "INSERT INTO requirement_project (requirement_id, project_id) VALUES (?, ?)",
                params![id, pid],
            )?;
        }
    }
    Ok(id)
}

pub fn update_requirement(conn: &Connection, req: &RequirementUpdateReq) -> AppResult<()> {
    let mut sets = vec![];
    let mut pv: Vec<Box<dyn rusqlite::types::ToSql>> = vec![];

    if let Some(v) = &req.name { sets.push("name = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.requirement_code { sets.push("requirement_code = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.environment { sets.push("environment = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.link { sets.push("link = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.status { sets.push("status = ?"); pv.push(Box::new(v.clone())); }
    if let Some(v) = &req.branch { sets.push("branch = ?"); pv.push(Box::new(v.clone())); }

    if !sets.is_empty() {
        sets.push("updated_at = datetime('now','localtime')");
        pv.push(Box::new(req.id));
        let sql = format!("UPDATE requirement SET {} WHERE id = ?", sets.join(", "));
        let refs: Vec<&dyn rusqlite::types::ToSql> = pv.iter().map(|p| p.as_ref() as &dyn rusqlite::types::ToSql).collect();
        conn.execute(&sql, refs.as_slice())?;
    }

    if let Some(pids) = &req.project_ids {
        conn.execute("UPDATE requirement_project SET state = 0, deleted_at = datetime('now','localtime') WHERE requirement_id = ?", params![req.id])?;
        for pid in pids {
            conn.execute(
                "INSERT INTO requirement_project (requirement_id, project_id) VALUES (?, ?)",
                params![req.id, pid],
            )?;
        }
    }
    Ok(())
}

pub fn update_status(conn: &Connection, req: &RequirementStatusUpdateReq) -> AppResult<()> {
    conn.execute(
        "UPDATE requirement SET status = ?, updated_at = datetime('now','localtime') WHERE id = ? AND state = 1",
        params![req.status, req.id],
    )?;
    Ok(())
}

pub fn delete_requirement(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute("UPDATE requirement SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?", params![id])?;
    conn.execute("UPDATE requirement_project SET deleted_at = datetime('now','localtime'), state = 0 WHERE requirement_id = ?", params![id])?;
    conn.execute("UPDATE work_item_link SET deleted_at = datetime('now','localtime'), state = 0 WHERE link_type = 'requirement' AND link_id = ?", params![id])?;
    Ok(())
}

pub fn link_requirement(conn: &Connection, req: &RequirementLinkReq) -> AppResult<()> {
    // 先清除旧关联
    conn.execute(
        "UPDATE work_item_link SET state = 0, deleted_at = datetime('now','localtime') WHERE link_type = ? AND link_id = ? AND state = 1",
        params![req.link_type, req.link_id],
    )?;
    conn.execute(
        "INSERT INTO work_item_link (work_item_id, link_type, link_id) VALUES (?, ?, ?)",
        params![req.requirement_id, req.link_type, req.link_id],
    )?;
    Ok(())
}

pub fn get_linked_requirement(conn: &Connection, link_type: &str, link_id: i32) -> AppResult<Option<Requirement>> {
    let result = conn.query_row(
        "SELECT r.id, r.iteration_id, r.name, r.requirement_code, r.environment, r.link, r.status, r.branch, r.state, r.created_at, r.updated_at FROM requirement r INNER JOIN work_item_link wil ON r.id = wil.work_item_id WHERE wil.link_type = ? AND wil.link_id = ? AND wil.state = 1 AND r.state = 1",
        params![link_type, link_id],
        |row| Ok(Requirement {
            id: row.get(0)?, iteration_id: row.get(1)?, name: row.get(2)?,
            requirement_code: row.get(3)?, environment: row.get(4)?, link: row.get(5)?,
            status: row.get(6)?, branch: row.get(7)?, state: row.get(8)?,
            created_at: row.get(9)?, updated_at: row.get(10)?,
        }),
    ).ok();
    Ok(result)
}

fn enrich_requirement(conn: &Connection, req: Requirement) -> AppResult<RequirementDetailRsp> {
    let mut stmt = conn.prepare("SELECT project_id FROM requirement_project WHERE requirement_id = ? AND state = 1 AND deleted_at IS NULL")?;
    let pids: Vec<i32> = stmt.query_map(params![req.id], |row| row.get(0))?.filter_map(|r| r.ok()).collect();

    let project_names: Vec<String> = pids.iter().filter_map(|pid| {
        conn.query_row("SELECT name FROM project WHERE id = ?", params![pid], |row| row.get(0)).ok()
    }).collect();

    let sql_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM work_item_link WHERE work_item_id = ? AND link_type = 'sql' AND state = 1",
        params![req.id], |row| row.get(0),
    ).unwrap_or(0);

    let commit_count: i64 = conn.query_row(
        "SELECT COUNT(*) FROM work_item_link WHERE work_item_id = ? AND link_type = 'commit' AND state = 1",
        params![req.id], |row| row.get(0),
    ).unwrap_or(0);

    Ok(RequirementDetailRsp {
        requirement: req,
        project_ids: pids,
        project_names,
        sql_count,
        commit_count,
    })
}
