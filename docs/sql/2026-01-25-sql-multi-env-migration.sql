-- SQL多环境执行迁移脚本

-- 1) 为现有项目初始化默认环境
INSERT INTO sql_env_config (user_id, project_id, env_code, env_name, sort_order, state)
SELECT p.user_id, p.id, env.env_code, env.env_name, env.sort_order, 1
FROM project p
CROSS JOIN (
    VALUES
        ('local', 'local', 1),
        ('dev', 'dev', 2),
        ('test', 'test', 3),
        ('smoke', 'smoke', 4),
        ('prod', 'prod', 5)
) AS env(env_code, env_name, sort_order)
ON CONFLICT (project_id, env_code) WHERE deleted_at IS NULL DO NOTHING;

-- 1.1) 更新已有环境名称为最新默认值
UPDATE sql_env_config SET env_name = 'local'
WHERE env_code = 'local' AND deleted_at IS NULL;
UPDATE sql_env_config SET env_name = 'dev'
WHERE env_code = 'dev' AND deleted_at IS NULL;
UPDATE sql_env_config SET env_name = 'test'
WHERE env_code = 'test' AND deleted_at IS NULL;
UPDATE sql_env_config SET env_name = 'smoke'
WHERE env_code = 'smoke' AND deleted_at IS NULL;
UPDATE sql_env_config SET env_name = 'prod'
WHERE env_code = 'prod' AND deleted_at IS NULL;

-- 2) 迁移 pending_sql 已执行环境到执行记录表
INSERT INTO sql_execution_log (user_id, sql_id, env, executed_at, executor, remark, state, created_at, updated_at)
SELECT
    ps.user_id,
    ps.id,
    ps.executed_env,
    COALESCE(ps.executed_at, NOW()),
    '',
    '',
    1,
    NOW(),
    NOW()
FROM pending_sql ps
WHERE ps.deleted_at IS NULL
  AND ps.status = 'executed'
  AND ps.executed_env IS NOT NULL
  AND ps.executed_env <> ''
ON CONFLICT (sql_id, env) WHERE deleted_at IS NULL DO NOTHING;
