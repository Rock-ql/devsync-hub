use rusqlite::Connection;
use crate::error::AppResult;

pub fn run_migrations(conn: &Connection) -> AppResult<()> {
    conn.execute_batch("
        CREATE TABLE IF NOT EXISTS project (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            name TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            gitlab_url TEXT NOT NULL DEFAULT '',
            gitlab_token TEXT NOT NULL DEFAULT '',
            gitlab_project_id INTEGER NOT NULL DEFAULT 0,
            gitlab_branch TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS iteration (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            project_id INTEGER NOT NULL DEFAULT 0,
            name TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'planning',
            start_date TEXT NOT NULL DEFAULT '',
            end_date TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS iteration_project (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            iteration_id INTEGER NOT NULL DEFAULT 0,
            project_id INTEGER NOT NULL DEFAULT 0,
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS pending_sql (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            project_id INTEGER NOT NULL DEFAULT 0,
            iteration_id INTEGER NOT NULL DEFAULT 0,
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            execution_order INTEGER NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            executed_at TEXT,
            executed_env TEXT NOT NULL DEFAULT '',
            remark TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sql_env_config (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            project_id INTEGER NOT NULL DEFAULT 0,
            env_code TEXT NOT NULL DEFAULT '',
            env_name TEXT NOT NULL DEFAULT '',
            sort_order INTEGER NOT NULL DEFAULT 0,
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS sql_execution_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            sql_id INTEGER NOT NULL DEFAULT 0,
            env TEXT NOT NULL DEFAULT '',
            executed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            executor TEXT NOT NULL DEFAULT '',
            remark TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS report (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            type TEXT NOT NULL DEFAULT 'daily',
            title TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            start_date TEXT NOT NULL DEFAULT '',
            end_date TEXT NOT NULL DEFAULT '',
            commit_summary TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS report_template (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            type TEXT NOT NULL DEFAULT 'daily',
            name TEXT NOT NULL DEFAULT '',
            content TEXT NOT NULL DEFAULT '',
            is_default INTEGER NOT NULL DEFAULT 0,
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS api_key (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            name TEXT NOT NULL DEFAULT '',
            key_hash TEXT NOT NULL DEFAULT '',
            key_prefix TEXT NOT NULL DEFAULT '',
            last_used_at TEXT,
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS system_setting (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            setting_key TEXT NOT NULL DEFAULT '',
            setting_value TEXT NOT NULL DEFAULT '',
            description TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS git_commit (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            project_id INTEGER NOT NULL DEFAULT 0,
            commit_id TEXT NOT NULL DEFAULT '',
            message TEXT NOT NULL DEFAULT '',
            author_name TEXT NOT NULL DEFAULT '',
            author_email TEXT NOT NULL DEFAULT '',
            committed_at TEXT NOT NULL DEFAULT '',
            additions INTEGER NOT NULL DEFAULT 0,
            deletions INTEGER NOT NULL DEFAULT 0,
            branch TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS requirement (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            iteration_id INTEGER NOT NULL DEFAULT 0,
            name TEXT NOT NULL DEFAULT '',
            requirement_code TEXT NOT NULL DEFAULT '',
            environment TEXT NOT NULL DEFAULT '',
            link TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending_dev',
            branch TEXT NOT NULL DEFAULT '',
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS requirement_project (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            requirement_id INTEGER NOT NULL DEFAULT 0,
            project_id INTEGER NOT NULL DEFAULT 0,
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS work_item_link (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL DEFAULT 0,
            work_item_id INTEGER NOT NULL DEFAULT 0,
            link_type TEXT NOT NULL DEFAULT '',
            link_id INTEGER NOT NULL DEFAULT 0,
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );

        CREATE TABLE IF NOT EXISTS requirement_status_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            requirement_id INTEGER NOT NULL DEFAULT 0,
            from_status TEXT NOT NULL DEFAULT '',
            to_status TEXT NOT NULL DEFAULT '',
            changed_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            state INTEGER NOT NULL DEFAULT 1,
            created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
            deleted_at TEXT
        );
    ")?;

    // 清理 git_commit 重复数据并建立唯一索引（按 commit SHA 去重，不区分分支）
    conn.execute_batch("
        DROP INDEX IF EXISTS uk_git_commit_project_commit_branch;
        DELETE FROM git_commit WHERE id NOT IN (
            SELECT MIN(id) FROM git_commit GROUP BY project_id, commit_id
        );
        CREATE UNIQUE INDEX IF NOT EXISTS uk_git_commit_project_commit
            ON git_commit(project_id, commit_id);
    ")?;

    // 修复 committed_at 中 RFC3339 格式为统一的 'YYYY-MM-DD HH:MM:SS' 格式
    conn.execute_batch("
        UPDATE git_commit SET committed_at = REPLACE(SUBSTR(committed_at, 1, 19), 'T', ' ')
        WHERE committed_at LIKE '%T%';
    ")?;

    // 常用查询索引
    conn.execute_batch("
        CREATE INDEX IF NOT EXISTS idx_requirement_iteration_id ON requirement(iteration_id);
        CREATE INDEX IF NOT EXISTS idx_requirement_status ON requirement(status);
        CREATE INDEX IF NOT EXISTS idx_pending_sql_project_id ON pending_sql(project_id);
        CREATE INDEX IF NOT EXISTS idx_pending_sql_iteration_id ON pending_sql(iteration_id);
        CREATE INDEX IF NOT EXISTS idx_pending_sql_status ON pending_sql(status);
        CREATE INDEX IF NOT EXISTS idx_git_commit_project_id ON git_commit(project_id);
        CREATE INDEX IF NOT EXISTS idx_git_commit_committed_at ON git_commit(committed_at);
        CREATE INDEX IF NOT EXISTS idx_report_type_start_date ON report(type, start_date);
        CREATE INDEX IF NOT EXISTS idx_iteration_project_iteration_id ON iteration_project(iteration_id);
        CREATE INDEX IF NOT EXISTS idx_iteration_project_project_id ON iteration_project(project_id);
        CREATE INDEX IF NOT EXISTS idx_requirement_project_requirement_id ON requirement_project(requirement_id);
        CREATE INDEX IF NOT EXISTS idx_requirement_project_project_id ON requirement_project(project_id);
        CREATE INDEX IF NOT EXISTS idx_work_item_link_work_item_id ON work_item_link(work_item_id);
        CREATE INDEX IF NOT EXISTS idx_work_item_link_link_type_link_id ON work_item_link(link_type, link_id);
        CREATE INDEX IF NOT EXISTS idx_sql_execution_log_sql_id ON sql_execution_log(sql_id);
        CREATE INDEX IF NOT EXISTS idx_req_status_log_requirement_id ON requirement_status_log(requirement_id);
        CREATE INDEX IF NOT EXISTS idx_req_status_log_changed_at ON requirement_status_log(changed_at);
    ")?;

    Ok(())
}
