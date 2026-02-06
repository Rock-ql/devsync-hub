-- DevSync Hub 数据库初始化脚本
-- 数据库: PostgreSQL 15+

-- 1. 项目表
CREATE TABLE IF NOT EXISTS project (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    gitlab_url VARCHAR(500) DEFAULT '',
    gitlab_token VARCHAR(500) DEFAULT '',
    gitlab_project_id INTEGER DEFAULT 0,
    gitlab_branch VARCHAR(100) DEFAULT 'main',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE project IS '项目表';
COMMENT ON COLUMN project.user_id IS '用户ID（预留多用户扩展）';
COMMENT ON COLUMN project.name IS '项目名称';
COMMENT ON COLUMN project.description IS '项目描述';
COMMENT ON COLUMN project.gitlab_url IS 'GitLab 仓库地址';
COMMENT ON COLUMN project.gitlab_token IS 'GitLab Access Token（加密存储）';
COMMENT ON COLUMN project.gitlab_project_id IS 'GitLab 项目ID';
COMMENT ON COLUMN project.gitlab_branch IS '默认分支';
COMMENT ON COLUMN project.state IS '状态 1:启用 2:归档';

-- 2. 迭代表
CREATE TABLE IF NOT EXISTS iteration (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    project_id INTEGER DEFAULT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'planning',
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE iteration IS '迭代表';
COMMENT ON COLUMN iteration.project_id IS '关联项目ID（可选）';
COMMENT ON COLUMN iteration.name IS '迭代名称';
COMMENT ON COLUMN iteration.status IS '状态: planning/developing/testing/released';

-- 2.1 迭代-项目关联表
CREATE TABLE IF NOT EXISTS iteration_project (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    iteration_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    UNIQUE(iteration_id, project_id)
);

COMMENT ON TABLE iteration_project IS '迭代-项目关联表';
COMMENT ON COLUMN iteration_project.iteration_id IS '迭代ID';
COMMENT ON COLUMN iteration_project.project_id IS '项目ID';

-- 3. 待执行SQL表
CREATE TABLE IF NOT EXISTS pending_sql (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    project_id INTEGER NOT NULL,
    iteration_id INTEGER DEFAULT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    execution_order INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    executed_at TIMESTAMP DEFAULT NULL,
    executed_env VARCHAR(50) DEFAULT '',
    remark TEXT DEFAULT '',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE pending_sql IS '待执行SQL表';
COMMENT ON COLUMN pending_sql.status IS '状态: pending/executed';

-- 4. SQL环境配置表
CREATE TABLE IF NOT EXISTS sql_env_config (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    project_id INTEGER NOT NULL,
    env_code VARCHAR(50) NOT NULL,
    env_name VARCHAR(100) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE sql_env_config IS '项目环境配置表';
COMMENT ON COLUMN sql_env_config.project_id IS '项目ID';
COMMENT ON COLUMN sql_env_config.env_code IS '环境代码';
COMMENT ON COLUMN sql_env_config.env_name IS '环境名称';
COMMENT ON COLUMN sql_env_config.sort_order IS '排序';

CREATE UNIQUE INDEX IF NOT EXISTS uk_env_project_code
ON sql_env_config(project_id, env_code)
WHERE deleted_at IS NULL;

-- 5. SQL执行记录表
CREATE TABLE IF NOT EXISTS sql_execution_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    sql_id INTEGER NOT NULL,
    env VARCHAR(50) NOT NULL,
    executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    executor VARCHAR(100) DEFAULT '',
    remark TEXT DEFAULT '',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE sql_execution_log IS 'SQL执行记录表';
COMMENT ON COLUMN sql_execution_log.sql_id IS 'SQL ID';
COMMENT ON COLUMN sql_execution_log.env IS '执行环境代码';
COMMENT ON COLUMN sql_execution_log.executor IS '执行人';
COMMENT ON COLUMN sql_execution_log.remark IS '执行备注';

CREATE INDEX IF NOT EXISTS idx_sql_execution_log_sql_id
ON sql_execution_log(sql_id);

CREATE UNIQUE INDEX IF NOT EXISTS uk_sql_execution_env
ON sql_execution_log(sql_id, env)
WHERE deleted_at IS NULL;

-- 6. 日报周报表
CREATE TABLE IF NOT EXISTS report (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    type VARCHAR(10) NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    commit_summary TEXT DEFAULT '{}',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE report IS '日报周报表';
COMMENT ON COLUMN report.type IS '类型: daily/weekly';

-- 7. 报告模板表
CREATE TABLE IF NOT EXISTS report_template (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    type VARCHAR(10) NOT NULL,
    name VARCHAR(100) NOT NULL,
    content TEXT NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE report_template IS '报告模板表';

-- 8. API Key表
CREATE TABLE IF NOT EXISTS api_key (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,
    last_used_at TIMESTAMP DEFAULT NULL,
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE api_key IS 'API Key表';

-- 9. 系统设置表
CREATE TABLE IF NOT EXISTS system_setting (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT DEFAULT '',
    description VARCHAR(200) DEFAULT '',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    UNIQUE(user_id, setting_key)
);

COMMENT ON TABLE system_setting IS '系统设置表';

-- 10. Git提交记录缓存表
CREATE TABLE IF NOT EXISTS git_commit (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    project_id INTEGER NOT NULL,
    commit_id VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    author_name VARCHAR(100) DEFAULT '',
    author_email VARCHAR(200) DEFAULT '',
    committed_at TIMESTAMP NOT NULL,
    additions INTEGER DEFAULT 0,
    deletions INTEGER DEFAULT 0,
    branch VARCHAR(200) NOT NULL DEFAULT '',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    UNIQUE(project_id, commit_id)
);

COMMENT ON TABLE git_commit IS 'Git提交记录缓存表';
COMMENT ON COLUMN git_commit.branch IS '所属分支名称';

-- 兼容旧库：CREATE TABLE IF NOT EXISTS 不会自动补字段
ALTER TABLE git_commit
    ADD COLUMN IF NOT EXISTS branch VARCHAR(200) NOT NULL DEFAULT '';

-- 11. 需求表
CREATE TABLE IF NOT EXISTS requirement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    iteration_id INTEGER NOT NULL,
    name VARCHAR(500) NOT NULL,
    link VARCHAR(1000) DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'presented',
    branch VARCHAR(200) NOT NULL DEFAULT '',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

-- 兼容旧库：CREATE TABLE IF NOT EXISTS 不会自动补字段
ALTER TABLE requirement
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'presented';

ALTER TABLE requirement
    ADD COLUMN IF NOT EXISTS branch VARCHAR(200) NOT NULL DEFAULT '';

COMMENT ON TABLE requirement IS '需求表';
COMMENT ON COLUMN requirement.iteration_id IS '归属迭代ID（必填）';
COMMENT ON COLUMN requirement.name IS '需求名称';
COMMENT ON COLUMN requirement.link IS '需求链接URL';
COMMENT ON COLUMN requirement.status IS '需求状态';
COMMENT ON COLUMN requirement.branch IS '关联Git分支名称';

-- 12. 需求-项目关联表
CREATE TABLE IF NOT EXISTS requirement_project (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    requirement_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL,
    UNIQUE(requirement_id, project_id)
);

COMMENT ON TABLE requirement_project IS '需求-项目关联表';

-- 13. 工作项关联表
CREATE TABLE IF NOT EXISTS work_item_link (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    work_item_id INTEGER NOT NULL,
    link_type VARCHAR(20) NOT NULL,
    link_id INTEGER NOT NULL,
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE work_item_link IS '工作项关联表';

-- work_item_link：部分唯一索引（仅对未删除记录生效），避免软删除后唯一约束冲突
ALTER TABLE work_item_link
    DROP CONSTRAINT IF EXISTS work_item_link_work_item_id_link_type_link_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uk_work_item_link_active
ON work_item_link(work_item_id, link_type, link_id)
WHERE deleted_at IS NULL;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_project_user_id ON project(user_id);
CREATE INDEX IF NOT EXISTS idx_iteration_project_id ON iteration(project_id);
CREATE INDEX IF NOT EXISTS idx_pending_sql_project_id ON pending_sql(project_id);
CREATE INDEX IF NOT EXISTS idx_pending_sql_iteration_id ON pending_sql(iteration_id);
CREATE INDEX IF NOT EXISTS idx_pending_sql_status ON pending_sql(status);
CREATE INDEX IF NOT EXISTS idx_report_type ON report(type);
CREATE INDEX IF NOT EXISTS idx_report_date ON report(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_git_commit_project_id ON git_commit(project_id);
CREATE INDEX IF NOT EXISTS idx_git_commit_committed_at ON git_commit(committed_at);

-- 插入默认报告模板
INSERT INTO report_template (user_id, type, name, content, is_default) VALUES
(1, 'daily', '默认日报模板', '## 今日工作
{{commits}}

## 明日计划
-

## 问题与风险
- 无', TRUE),
(1, 'weekly', '默认周报模板', '## 本周工作总结
{{commits}}

## 下周计划
-

## 问题与风险
- 无

## 需要协助
- 无', TRUE)
ON CONFLICT DO NOTHING;
