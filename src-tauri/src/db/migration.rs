use rusqlite::Connection;
use crate::error::{AppError, AppResult};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct PgConfig {
    pub host: String,
    pub port: u16,
    pub database: String,
    pub user: String,
    pub password: String,
}

/// PG → SQLite 数据迁移（预留接口，需要 postgres crate 支持）
pub fn migrate_from_pg(_conn: &Connection, _config: &PgConfig) -> AppResult<()> {
    // TODO: 实现 PG 数据导出为 JSON，再导入 SQLite
    Err(AppError::Internal("PG migration not yet implemented. Use JSON export/import instead.".into()))
}

/// 从 JSON 文件导入数据
pub fn import_from_json(conn: &Connection, json_path: &str) -> AppResult<()> {
    let data = std::fs::read_to_string(json_path)
        .map_err(|e| AppError::Internal(format!("Failed to read JSON file: {}", e)))?;
    let tables: serde_json::Value = serde_json::from_str(&data)
        .map_err(|e| AppError::Internal(format!("Invalid JSON: {}", e)))?;

    let table_names = [
        "project", "iteration", "iteration_project", "pending_sql",
        "sql_env_config", "sql_execution_log", "report", "report_template",
        "api_key", "system_setting", "git_commit", "requirement",
        "requirement_project", "work_item_link",
    ];

    for table in &table_names {
        if let Some(rows) = tables.get(table).and_then(|v| v.as_array()) {
            for row in rows {
                if let Some(obj) = row.as_object() {
                    let cols: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
                    let placeholders: Vec<String> = cols.iter().map(|_| "?".to_string()).collect();
                    let sql = format!(
                        "INSERT OR IGNORE INTO {} ({}) VALUES ({})",
                        table,
                        cols.join(", "),
                        placeholders.join(", ")
                    );
                    let values: Vec<Box<dyn rusqlite::types::ToSql>> = cols.iter().map(|c| {
                        let v = &obj[*c];
                        match v {
                            serde_json::Value::Null => Box::new(rusqlite::types::Null) as Box<dyn rusqlite::types::ToSql>,
                            serde_json::Value::Number(n) => {
                                if let Some(i) = n.as_i64() {
                                    Box::new(i) as Box<dyn rusqlite::types::ToSql>
                                } else {
                                    Box::new(n.as_f64().unwrap_or(0.0)) as Box<dyn rusqlite::types::ToSql>
                                }
                            }
                            serde_json::Value::String(s) => Box::new(s.clone()),
                            serde_json::Value::Bool(b) => Box::new(*b as i32),
                            _ => Box::new(v.to_string()),
                        }
                    }).collect();
                    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref() as &dyn rusqlite::types::ToSql).collect();
                    conn.execute(&sql, params.as_slice()).ok();
                }
            }
        }
    }
    Ok(())
}
