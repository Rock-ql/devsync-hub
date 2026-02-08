use rusqlite::Connection;
use crate::error::{AppError, AppResult};

pub const TABLE_NAMES: [&str; 14] = [
    "project", "iteration", "iteration_project", "pending_sql",
    "sql_env_config", "sql_execution_log", "report", "report_template",
    "api_key", "system_setting", "git_commit", "requirement",
    "requirement_project", "work_item_link",
];

#[derive(serde::Serialize)]
pub struct ImportResult {
    pub total: usize,
    pub tables: Vec<TableImportResult>,
}

#[derive(serde::Serialize)]
pub struct TableImportResult {
    pub table: String,
    pub count: usize,
}

fn json_value_to_sql(v: &serde_json::Value) -> Box<dyn rusqlite::types::ToSql> {
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
}

/// 从 JSON 字符串导入数据
pub fn import_from_json_content(conn: &Connection, json_content: &str) -> AppResult<ImportResult> {
    let tables: serde_json::Value = serde_json::from_str(json_content)
        .map_err(|e| AppError::BadRequest(format!("JSON 格式无效: {}", e)))?;

    let mut total = 0usize;
    let mut results = Vec::new();

    for table in &TABLE_NAMES {
        let mut count = 0usize;
        if let Some(rows) = tables.get(table).and_then(|v| v.as_array()) {
            for row in rows {
                if let Some(obj) = row.as_object() {
                    let cols: Vec<&str> = obj.keys().map(|k| k.as_str()).collect();
                    if cols.is_empty() { continue; }
                    let placeholders: Vec<&str> = cols.iter().map(|_| "?").collect();
                    let sql = format!(
                        "INSERT OR REPLACE INTO {} ({}) VALUES ({})",
                        table, cols.join(", "), placeholders.join(", ")
                    );
                    let values: Vec<Box<dyn rusqlite::types::ToSql>> = cols.iter()
                        .map(|c| json_value_to_sql(&obj[*c]))
                        .collect();
                    let params: Vec<&dyn rusqlite::types::ToSql> = values.iter()
                        .map(|v| v.as_ref() as &dyn rusqlite::types::ToSql)
                        .collect();
                    if conn.execute(&sql, params.as_slice()).is_ok() {
                        count += 1;
                    }
                }
            }
        }
        total += count;
        results.push(TableImportResult { table: table.to_string(), count });
    }

    Ok(ImportResult { total, tables: results })
}

/// 导出所有数据为 JSON 字符串
pub fn export_to_json(conn: &Connection) -> AppResult<String> {
    let mut data = serde_json::Map::new();

    for table in &TABLE_NAMES {
        let mut stmt = conn.prepare(&format!("SELECT * FROM {} ORDER BY id ASC", table))?;
        let col_names: Vec<String> = stmt.column_names().iter().map(|s| s.to_string()).collect();
        let rows: Vec<serde_json::Value> = stmt.query_map([], |row| {
            let mut obj = serde_json::Map::new();
            for (i, col) in col_names.iter().enumerate() {
                let val: rusqlite::types::Value = row.get_unwrap(i);
                let json_val = match val {
                    rusqlite::types::Value::Null => serde_json::Value::Null,
                    rusqlite::types::Value::Integer(n) => serde_json::json!(n),
                    rusqlite::types::Value::Real(f) => serde_json::json!(f),
                    rusqlite::types::Value::Text(s) => serde_json::Value::String(s),
                    rusqlite::types::Value::Blob(b) => serde_json::Value::String(
                        base64::Engine::encode(&base64::engine::general_purpose::STANDARD, &b)
                    ),
                };
                obj.insert(col.clone(), json_val);
            }
            Ok(serde_json::Value::Object(obj))
        })?.filter_map(|r| r.ok()).collect();

        data.insert(table.to_string(), serde_json::Value::Array(rows));
    }

    serde_json::to_string_pretty(&data)
        .map_err(|e| AppError::Internal(format!("JSON 序列化失败: {}", e)))
}
