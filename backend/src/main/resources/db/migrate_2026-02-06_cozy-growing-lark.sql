-- DevSync Hub 数据库迁移脚本
-- 计划: cozy-growing-lark（迭代多项目绑定 + 需求状态 + SQL关联需求修复）
-- 日期: 2026-02-06
-- 适用: 已有数据库（docker 首次 init.sql 不会再次执行时）

BEGIN;

-- 1) 迭代支持绑定多个项目：新增 迭代-项目 关联表
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

-- 2) 需求增加状态字段（默认“已宣讲”）
ALTER TABLE requirement
    ADD COLUMN IF NOT EXISTS status VARCHAR(30) NOT NULL DEFAULT 'presented';

COMMENT ON COLUMN requirement.status IS '需求状态';

-- 3) 修复 work_item_link 软删除导致唯一约束冲突：使用部分唯一索引替代全表唯一约束
ALTER TABLE work_item_link
    DROP CONSTRAINT IF EXISTS work_item_link_work_item_id_link_type_link_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS uk_work_item_link_active
ON work_item_link(work_item_id, link_type, link_id)
WHERE deleted_at IS NULL;

COMMIT;

