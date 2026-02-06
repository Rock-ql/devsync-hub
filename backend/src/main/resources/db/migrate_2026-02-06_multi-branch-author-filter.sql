-- 多分支同步 + 按作者过滤日报 + 需求关联分支
BEGIN;

-- 1. git_commit 表新增 branch 字段
ALTER TABLE git_commit
    ADD COLUMN IF NOT EXISTS branch VARCHAR(200) NOT NULL DEFAULT '';
COMMENT ON COLUMN git_commit.branch IS '所属分支名称';

-- 2. requirement 表新增 branch 字段
ALTER TABLE requirement
    ADD COLUMN IF NOT EXISTS branch VARCHAR(200) NOT NULL DEFAULT '';
COMMENT ON COLUMN requirement.branch IS '关联Git分支名称';

COMMIT;
