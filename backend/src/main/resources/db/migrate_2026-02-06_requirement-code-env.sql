-- requirement 新增需求编号与环境字段
BEGIN;

ALTER TABLE requirement
    ADD COLUMN IF NOT EXISTS requirement_code VARCHAR(50) NOT NULL DEFAULT '';

ALTER TABLE requirement
    ADD COLUMN IF NOT EXISTS environment VARCHAR(30) NOT NULL DEFAULT '';

COMMENT ON COLUMN requirement.requirement_code IS '需求编号';
COMMENT ON COLUMN requirement.environment IS '当前环境';

COMMIT;

