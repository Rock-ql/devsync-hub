pub mod schema;
pub mod migration;

use rusqlite::Connection;
use std::path::PathBuf;
use crate::error::{AppError, AppResult};

pub struct Database {
    pub conn: Connection,
}

impl Database {
    pub fn new() -> AppResult<Self> {
        let db_path = Self::db_path();
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Internal(e.to_string()))?;
        }
        let conn = Connection::open(&db_path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;
        Ok(Self { conn })
    }

    fn db_path() -> PathBuf {
        let mut path = dirs_data_path();
        path.push("devsync-hub");
        path.push("devsync.db");
        path
    }

    pub fn migrate(&self) -> AppResult<()> {
        schema::run_migrations(&self.conn)
    }
}

fn dirs_data_path() -> PathBuf {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        PathBuf::from(home).join("Library/Application Support")
    }
    #[cfg(target_os = "windows")]
    {
        std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| PathBuf::from("."))
    }
    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").unwrap_or_default();
        PathBuf::from(home).join(".local/share")
    }
}
