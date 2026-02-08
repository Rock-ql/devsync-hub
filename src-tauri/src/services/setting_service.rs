use rusqlite::{params, Connection};
use crate::error::AppResult;
use crate::models::system_setting::*;
use crate::models::api_key::*;
use sha2::{Sha256, Digest};

pub fn get_all_settings(conn: &Connection) -> AppResult<Vec<SystemSetting>> {
    let mut stmt = conn.prepare(
        "SELECT id, setting_key, setting_value, description FROM system_setting WHERE state = 1 AND deleted_at IS NULL"
    )?;
    let rows = stmt.query_map([], |row| {
        let key: String = row.get(1)?;
        let mut value: String = row.get(2)?;
        // 敏感值脱敏
        if key.contains("token") || key.contains("api_key") || key.contains("secret") {
            if value.len() > 8 {
                value = format!("{}****{}", &value[..4], &value[value.len()-4..]);
            }
        }
        Ok(SystemSetting {
            id: row.get(0)?,
            setting_key: key,
            setting_value: value,
            description: row.get(3)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn get_setting(conn: &Connection, key: &str) -> AppResult<Option<String>> {
    let result = conn.query_row(
        "SELECT setting_value FROM system_setting WHERE setting_key = ? AND state = 1",
        params![key], |row| row.get(0),
    ).ok();
    Ok(result)
}

pub fn update_setting(conn: &Connection, req: &SettingUpdateReq) -> AppResult<()> {
    let exists: i64 = conn.query_row(
        "SELECT COUNT(*) FROM system_setting WHERE setting_key = ? AND state = 1",
        params![req.key], |row| row.get(0),
    ).unwrap_or(0);

    if exists > 0 {
        conn.execute(
            "UPDATE system_setting SET setting_value = ?, updated_at = datetime('now','localtime') WHERE setting_key = ? AND state = 1",
            params![req.value, req.key],
        )?;
    } else {
        conn.execute(
            "INSERT INTO system_setting (setting_key, setting_value) VALUES (?, ?)",
            params![req.key, req.value],
        )?;
    }
    Ok(())
}

pub fn batch_update_settings(conn: &Connection, settings: &std::collections::HashMap<String, String>) -> AppResult<()> {
    for (key, value) in settings {
        update_setting(conn, &SettingUpdateReq { key: key.clone(), value: value.clone() })?;
    }
    Ok(())
}

pub fn create_api_key(conn: &Connection, req: &ApiKeyCreateReq) -> AppResult<ApiKeyCreateRsp> {
    let raw_key = format!("dsh_{}", uuid::Uuid::new_v4().to_string().replace("-", ""));
    let prefix = raw_key[..12].to_string();

    let mut hasher = Sha256::new();
    hasher.update(raw_key.as_bytes());
    let hash = format!("{:x}", hasher.finalize());

    conn.execute(
        "INSERT INTO api_key (name, key_hash, key_prefix) VALUES (?, ?, ?)",
        params![req.name, hash, prefix.clone()],
    )?;
    let id = conn.last_insert_rowid() as i32;

    Ok(ApiKeyCreateRsp {
        id,
        name: req.name.clone(),
        key: raw_key,
        key_prefix: prefix,
    })
}

pub fn list_api_keys(conn: &Connection) -> AppResult<Vec<ApiKey>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, key_hash, key_prefix, last_used_at, created_at FROM api_key WHERE state = 1 AND deleted_at IS NULL ORDER BY id DESC"
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(ApiKey {
            id: row.get(0)?,
            name: row.get(1)?,
            key_hash: "".to_string(), // 不暴露 hash
            key_prefix: row.get(3)?,
            last_used_at: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;
    Ok(rows.filter_map(|r| r.ok()).collect())
}

pub fn delete_api_key(conn: &Connection, id: i32) -> AppResult<()> {
    conn.execute(
        "UPDATE api_key SET deleted_at = datetime('now','localtime'), state = 0 WHERE id = ?",
        params![id],
    )?;
    Ok(())
}
