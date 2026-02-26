use crate::axum_gateway::sse;
use crate::error::{AppError, AppResult};
use chrono::Local;
use log::{Level, LevelFilter, Log, Metadata, Record};
use rusqlite::{params, Connection};
use serde::Serialize;
use std::sync::atomic::{AtomicBool, AtomicU8, Ordering};

pub const DEBUG_LOG_ENABLED_KEY: &str = "debug.log.enabled";
pub const DEBUG_LOG_LEVEL_KEY: &str = "debug.log.level";

static DEBUG_LOG_ENABLED: AtomicBool = AtomicBool::new(false);
static DEBUG_LOG_LEVEL: AtomicU8 = AtomicU8::new(3);

#[derive(Debug, Serialize)]
struct AppLogSsePayload {
    source: String,
    level: String,
    message: String,
    target: String,
    timestamp: String,
}

struct AppLogger {
    inner: env_logger::Logger,
}

impl Log for AppLogger {
    fn enabled(&self, metadata: &Metadata<'_>) -> bool {
        self.inner.enabled(metadata) || should_emit_backend_log(metadata.level())
    }

    fn log(&self, record: &Record<'_>) {
        if self.inner.enabled(record.metadata()) {
            self.inner.log(record);
        }

        if !should_emit_backend_log(record.level()) {
            return;
        }

        let payload = AppLogSsePayload {
            source: "backend".to_string(),
            level: record.level().to_string().to_lowercase(),
            message: format!("{}", record.args()),
            target: record.target().to_string(),
            timestamp: Local::now().format("%Y-%m-%d %H:%M:%S%.3f").to_string(),
        };
        let data = serde_json::to_string(&payload).unwrap_or_default();
        sse::publish("app_log", &data);
    }

    fn flush(&self) {
        self.inner.flush();
    }
}

pub fn init_logger(conn: &Connection) -> AppResult<()> {
    let inner = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).build();
    let logger = AppLogger { inner };

    log::set_boxed_logger(Box::new(logger))
        .map_err(|err| AppError::Internal(format!("初始化日志失败: {}", err)))?;
    log::set_max_level(LevelFilter::Trace);

    refresh_debug_settings(conn)?;
    Ok(())
}

pub fn refresh_debug_settings(conn: &Connection) -> AppResult<()> {
    let enabled: String = conn
        .query_row(
            "SELECT setting_value FROM system_setting WHERE setting_key = ? AND state = 1 AND deleted_at IS NULL",
            params![DEBUG_LOG_ENABLED_KEY],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "0".to_string());

    let level: String = conn
        .query_row(
            "SELECT setting_value FROM system_setting WHERE setting_key = ? AND state = 1 AND deleted_at IS NULL",
            params![DEBUG_LOG_LEVEL_KEY],
            |row| row.get(0),
        )
        .unwrap_or_else(|_| "info".to_string());

    apply_debug_settings(&enabled, &level);
    Ok(())
}

pub fn apply_debug_settings(enabled: &str, level: &str) {
    let enabled_flag = matches!(enabled.trim().to_ascii_lowercase().as_str(), "1" | "true" | "on" | "yes");
    DEBUG_LOG_ENABLED.store(enabled_flag, Ordering::Relaxed);
    DEBUG_LOG_LEVEL.store(level_weight(level), Ordering::Relaxed);
}

fn should_emit_backend_log(level: Level) -> bool {
    if !DEBUG_LOG_ENABLED.load(Ordering::Relaxed) {
        return false;
    }
    let configured = DEBUG_LOG_LEVEL.load(Ordering::Relaxed);
    level_weight(level.as_str()) <= configured
}

fn level_weight(level: &str) -> u8 {
    match level.trim().to_ascii_lowercase().as_str() {
        "error" => 1,
        "warn" | "warning" => 2,
        "info" => 3,
        "debug" => 4,
        "trace" => 5,
        _ => 3,
    }
}
