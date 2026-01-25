# SQL多环境执行功能 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 引入环境配置与执行记录两张表，实现多环境独立执行追踪、SQL持续可编辑、前端替换为环境按钮组交互。

**架构：** 后端新增环境配置与执行记录实体/服务，以执行记录数量与环境数量动态计算状态与进度；前端用环境按钮组件与确认弹窗替换原有 prompt 交互；保留既有字段与接口以维持兼容。

**技术栈：** Spring Boot + MyBatis-Plus + PostgreSQL；React + React Query + Tailwind。

---

相关技能：@writing-plans

### 任务 1: 更新数据库结构与迁移脚本

**文件：**
- 修改：`backend/src/main/resources/db/init.sql:1`
- 创建：`docs/sql/2026-01-25-sql-multi-env-migration.sql`

**步骤 1: 在 init.sql 中新增环境配置表与执行记录表**

```sql
-- 9. SQL环境配置表
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

-- 10. SQL执行记录表
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
```

**步骤 2: 新增迁移脚本，初始化默认环境并迁移已执行记录**

```sql
-- 1) 为现有项目初始化默认环境
INSERT INTO sql_env_config (user_id, project_id, env_code, env_name, sort_order, state)
SELECT p.user_id, p.id, env.env_code, env.env_name, env.sort_order, 1
FROM project p
CROSS JOIN (
    VALUES
        ('local', '本地', 1),
        ('dev', '开发', 2),
        ('test', '测试', 3),
        ('prod', '生产', 4)
) AS env(env_code, env_name, sort_order)
ON CONFLICT (project_id, env_code) WHERE deleted_at IS NULL DO NOTHING;

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
```

**步骤 3: 运行后端编译验证**

运行：`mvn -q -DskipTests compile`
预期：编译通过，无语法错误。

**步骤 4: 提交**

```bash
git add backend/src/main/resources/db/init.sql docs/sql/2026-01-25-sql-multi-env-migration.sql

git commit -m "新增SQL环境配置与执行记录表"
```

---

### 任务 2: 新增环境配置与执行记录实体/Mapper

**文件：**
- 创建：`backend/src/main/java/com/devsync/entity/SqlEnvConfig.java`
- 创建：`backend/src/main/java/com/devsync/entity/SqlExecutionLog.java`
- 创建：`backend/src/main/java/com/devsync/mapper/SqlEnvConfigMapper.java`
- 创建：`backend/src/main/java/com/devsync/mapper/SqlExecutionLogMapper.java`

**步骤 1: 新增环境配置实体**

```java
package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * SQL环境配置实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sql_env_config")
public class SqlEnvConfig extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * 关联项目ID
     */
    private Integer projectId;

    /**
     * 环境代码
     */
    private String envCode;

    /**
     * 环境名称
     */
    private String envName;

    /**
     * 排序
     */
    private Integer sortOrder;
}
```

**步骤 2: 新增执行记录实体**

```java
package com.devsync.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

/**
 * SQL执行记录实体
 *
 * @author xiaolei
 */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("sql_execution_log")
public class SqlExecutionLog extends BaseEntity {

    private static final long serialVersionUID = 1L;

    /**
     * SQL ID
     */
    private Integer sqlId;

    /**
     * 执行环境代码
     */
    private String env;

    /**
     * 执行时间
     */
    private LocalDateTime executedAt;

    /**
     * 执行人
     */
    private String executor;

    /**
     * 执行备注
     */
    private String remark;
}
```

**步骤 3: 新增 Mapper 接口**

```java
package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.SqlEnvConfig;
import org.apache.ibatis.annotations.Mapper;

/**
 * SQL环境配置 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface SqlEnvConfigMapper extends BaseMapper<SqlEnvConfig> {
}
```

```java
package com.devsync.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.devsync.entity.SqlExecutionLog;
import org.apache.ibatis.annotations.Mapper;

/**
 * SQL执行记录 Mapper
 *
 * @author xiaolei
 */
@Mapper
public interface SqlExecutionLogMapper extends BaseMapper<SqlExecutionLog> {
}
```

**步骤 4: 运行后端编译验证**

运行：`mvn -q -DskipTests compile`
预期：编译通过，无语法错误。

**步骤 5: 提交**

```bash
git add backend/src/main/java/com/devsync/entity/SqlEnvConfig.java \
       backend/src/main/java/com/devsync/entity/SqlExecutionLog.java \
       backend/src/main/java/com/devsync/mapper/SqlEnvConfigMapper.java \
       backend/src/main/java/com/devsync/mapper/SqlExecutionLogMapper.java

git commit -m "新增SQL环境与执行记录实体"
```

---

### 任务 3: 新增请求/响应模型与状态计算工具

**文件：**
- 修改：`backend/src/main/java/com/devsync/dto/req/PendingSqlExecuteReq.java:1`
- 修改：`backend/src/main/java/com/devsync/dto/req/PendingSqlListReq.java:1`
- 修改：`backend/src/main/java/com/devsync/dto/rsp/PendingSqlRsp.java:1`
- 创建：`backend/src/main/java/com/devsync/dto/req/SqlEnvListReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/SqlEnvAddReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/SqlEnvDeleteReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/SqlExecutionRevokeReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/rsp/SqlEnvConfigRsp.java`
- 创建：`backend/src/main/java/com/devsync/dto/rsp/PendingSqlEnvExecutionRsp.java`
- 创建：`backend/src/main/java/com/devsync/common/enums/SqlExecutionStatusEnum.java`
- 创建：`backend/src/main/java/com/devsync/common/util/SqlExecutionStatusHelper.java`

**步骤 1: 扩展执行请求与列表请求模型**

```java
@Data
@Schema(description = "SQL执行请求")
public class PendingSqlExecuteReq {

    @NotNull(message = "SQL ID不能为空")
    @Schema(description = "SQL ID")
    private Integer id;

    @NotBlank(message = "执行环境不能为空")
    @Schema(description = "执行环境代码（如：local/dev/test/prod）")
    private String executedEnv;

    @Schema(description = "执行备注")
    private String remark;

    @Schema(description = "执行人")
    private String executor;
}
```

```java
@Schema(description = "SQL列表请求")
public class PendingSqlListReq extends PageReq {

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "迭代ID")
    private Integer iterationId;

    @Schema(description = "标题（模糊搜索）")
    private String title;

    @Schema(description = "状态: pending/partial/completed")
    private String status;
}
```

**步骤 2: 新增环境/撤销请求模型**

```java
package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 环境列表请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "环境列表请求")
public class SqlEnvListReq {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID")
    private Integer projectId;
}
```

```java
package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 添加环境请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "添加环境请求")
public class SqlEnvAddReq {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID")
    private Integer projectId;

    @NotBlank(message = "环境代码不能为空")
    @Schema(description = "环境代码")
    private String envCode;

    @NotBlank(message = "环境名称不能为空")
    @Schema(description = "环境名称")
    private String envName;
}
```

```java
package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 删除环境请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "删除环境请求")
public class SqlEnvDeleteReq {

    @NotNull(message = "项目ID不能为空")
    @Schema(description = "项目ID")
    private Integer projectId;

    @NotBlank(message = "环境代码不能为空")
    @Schema(description = "环境代码")
    private String envCode;
}
```

```java
package com.devsync.dto.req;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 撤销执行请求
 *
 * @author xiaolei
 */
@Data
@Schema(description = "撤销执行请求")
public class SqlExecutionRevokeReq {

    @NotNull(message = "SQL ID不能为空")
    @Schema(description = "SQL ID")
    private Integer sqlId;

    @NotBlank(message = "环境代码不能为空")
    @Schema(description = "环境代码")
    private String env;
}
```

**步骤 3: 新增环境与执行记录响应模型**

```java
package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

/**
 * SQL环境配置响应
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL环境配置响应")
public class SqlEnvConfigRsp {

    @Schema(description = "环境ID")
    private Integer id;

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "环境代码")
    private String envCode;

    @Schema(description = "环境名称")
    private String envName;

    @Schema(description = "排序")
    private Integer sortOrder;
}
```

```java
package com.devsync.dto.rsp;

import io.swagger.v3.oas.annotations.media.Schema;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * SQL环境执行状态
 *
 * @author xiaolei
 */
@Data
@Schema(description = "SQL环境执行状态")
public class PendingSqlEnvExecutionRsp {

    @Schema(description = "环境代码")
    private String envCode;

    @Schema(description = "环境名称")
    private String envName;

    @Schema(description = "是否已执行")
    private Boolean executed;

    @Schema(description = "执行时间")
    private LocalDateTime executedAt;

    @Schema(description = "执行人")
    private String executor;

    @Schema(description = "执行备注")
    private String remark;
}
```

**步骤 4: 扩展 SQL 响应模型**

```java
@Schema(description = "SQL详情响应")
public class PendingSqlRsp {

    @Schema(description = "SQL ID")
    private Integer id;

    @Schema(description = "项目ID")
    private Integer projectId;

    @Schema(description = "项目名称")
    private String projectName;

    @Schema(description = "迭代ID")
    private Integer iterationId;

    @Schema(description = "迭代名称")
    private String iterationName;

    @Schema(description = "SQL标题")
    private String title;

    @Schema(description = "SQL内容")
    private String content;

    @Schema(description = "执行顺序")
    private Integer executionOrder;

    @Schema(description = "状态: pending/partial/completed")
    private String status;

    @Schema(description = "状态描述")
    private String statusDesc;

    @Schema(description = "最近执行时间")
    private LocalDateTime executedAt;

    @Schema(description = "最近执行环境")
    private String executedEnv;

    @Schema(description = "备注")
    private String remark;

    @Schema(description = "已执行环境数")
    private Integer executedCount;

    @Schema(description = "环境总数")
    private Integer envTotal;

    @Schema(description = "环境执行列表")
    private List<PendingSqlEnvExecutionRsp> envExecutionList;

    @Schema(description = "创建时间")
    private LocalDateTime createdAt;

    @Schema(description = "更新时间")
    private LocalDateTime updatedAt;
}
```

**步骤 5: 新增状态枚举与计算工具**

```java
package com.devsync.common.enums;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * SQL多环境执行状态枚举
 *
 * @author xiaolei
 */
@Getter
@AllArgsConstructor
public enum SqlExecutionStatusEnum {

    PENDING("pending", "待执行"),
    PARTIAL("partial", "部分执行"),
    COMPLETED("completed", "全部完成");

    private final String code;
    private final String desc;

    public static SqlExecutionStatusEnum getByCode(String code) {
        for (SqlExecutionStatusEnum status : values()) {
            if (status.getCode().equals(code)) {
                return status;
            }
        }
        return null;
    }
}
```

```java
package com.devsync.common.util;

import com.devsync.common.enums.SqlExecutionStatusEnum;

/**
 * SQL执行状态计算工具
 *
 * @author xiaolei
 */
public final class SqlExecutionStatusHelper {

    private SqlExecutionStatusHelper() {
    }

    public static SqlExecutionStatusEnum calculate(Integer executedCount, Integer envTotal) {
        int executed = executedCount == null ? 0 : executedCount;
        int total = envTotal == null ? 0 : envTotal;
        if (total <= 0 || executed <= 0) {
            return SqlExecutionStatusEnum.PENDING;
        }
        if (executed >= total) {
            return SqlExecutionStatusEnum.COMPLETED;
        }
        return SqlExecutionStatusEnum.PARTIAL;
    }
}
```

**步骤 6: 运行后端编译验证**

运行：`mvn -q -DskipTests compile`
预期：编译通过，无语法错误。

**步骤 7: 提交**

```bash
git add backend/src/main/java/com/devsync/dto/req/PendingSqlExecuteReq.java \
       backend/src/main/java/com/devsync/dto/req/PendingSqlListReq.java \
       backend/src/main/java/com/devsync/dto/req/SqlEnvListReq.java \
       backend/src/main/java/com/devsync/dto/req/SqlEnvAddReq.java \
       backend/src/main/java/com/devsync/dto/req/SqlEnvDeleteReq.java \
       backend/src/main/java/com/devsync/dto/req/SqlExecutionRevokeReq.java \
       backend/src/main/java/com/devsync/dto/rsp/PendingSqlRsp.java \
       backend/src/main/java/com/devsync/dto/rsp/SqlEnvConfigRsp.java \
       backend/src/main/java/com/devsync/dto/rsp/PendingSqlEnvExecutionRsp.java \
       backend/src/main/java/com/devsync/common/enums/SqlExecutionStatusEnum.java \
       backend/src/main/java/com/devsync/common/util/SqlExecutionStatusHelper.java

git commit -m "补充SQL多环境请求响应模型"
```

---

### 任务 4: 新增环境与执行记录服务并改造SQL逻辑

**文件：**
- 创建：`backend/src/main/java/com/devsync/service/ISqlEnvConfigService.java`
- 创建：`backend/src/main/java/com/devsync/service/ISqlExecutionLogService.java`
- 创建：`backend/src/main/java/com/devsync/service/impl/SqlEnvConfigServiceImpl.java`
- 创建：`backend/src/main/java/com/devsync/service/impl/SqlExecutionLogServiceImpl.java`
- 创建：`backend/src/main/java/com/devsync/mapper/SqlExecutionCount.java`
- 创建：`backend/src/main/java/com/devsync/mapper/ProjectPendingCount.java`
- 修改：`backend/src/main/java/com/devsync/service/IPendingSqlService.java:1`
- 修改：`backend/src/main/java/com/devsync/service/impl/PendingSqlServiceImpl.java:1`
- 修改：`backend/src/main/java/com/devsync/mapper/PendingSqlMapper.java:1`
- 修改：`backend/src/main/java/com/devsync/service/impl/ProjectServiceImpl.java:1`
- 修改：`backend/src/main/java/com/devsync/service/impl/DashboardServiceImpl.java:1`

**步骤 1: 新增环境配置服务接口与实现**

```java
package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.dto.rsp.SqlEnvConfigRsp;
import com.devsync.entity.SqlEnvConfig;

import java.util.List;

/**
 * SQL环境配置服务接口
 *
 * @author xiaolei
 */
public interface ISqlEnvConfigService extends IService<SqlEnvConfig> {

    List<SqlEnvConfigRsp> listByProjectId(Integer projectId);

    Map<Integer, List<SqlEnvConfigRsp>> listByProjectIds(List<Integer> projectIds);

    void addEnv(Integer projectId, String envCode, String envName);

    void deleteEnv(Integer projectId, String envCode);

    void initDefaultEnvs(Integer projectId, Integer userId);
}
```

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class SqlEnvConfigServiceImpl extends ServiceImpl<SqlEnvConfigMapper, SqlEnvConfig>
        implements ISqlEnvConfigService {

    private final SqlEnvConfigMapper sqlEnvConfigMapper;
    private final SqlExecutionLogMapper sqlExecutionLogMapper;

    @Override
    public List<SqlEnvConfigRsp> listByProjectId(Integer projectId) {
        LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SqlEnvConfig::getProjectId, projectId)
                .orderByAsc(SqlEnvConfig::getSortOrder)
                .orderByAsc(SqlEnvConfig::getId);
        return sqlEnvConfigMapper.selectList(wrapper).stream()
                .map(env -> {
                    SqlEnvConfigRsp rsp = new SqlEnvConfigRsp();
                    BeanUtil.copyProperties(env, rsp);
                    return rsp;
                })
                .toList();
    }

    @Override
    public Map<Integer, List<SqlEnvConfigRsp>> listByProjectIds(List<Integer> projectIds) {
        if (projectIds == null || projectIds.isEmpty()) {
            return Map.of();
        }
        LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(SqlEnvConfig::getProjectId, projectIds)
                .orderByAsc(SqlEnvConfig::getSortOrder)
                .orderByAsc(SqlEnvConfig::getId);
        return sqlEnvConfigMapper.selectList(wrapper).stream()
                .map(env -> {
                    SqlEnvConfigRsp rsp = new SqlEnvConfigRsp();
                    BeanUtil.copyProperties(env, rsp);
                    return rsp;
                })
                .collect(Collectors.groupingBy(SqlEnvConfigRsp::getProjectId));
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void addEnv(Integer projectId, String envCode, String envName) {
        LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SqlEnvConfig::getProjectId, projectId)
                .eq(SqlEnvConfig::getEnvCode, envCode);
        if (sqlEnvConfigMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(400, "环境代码已存在");
        }
        SqlEnvConfig env = new SqlEnvConfig();
        env.setProjectId(projectId);
        env.setEnvCode(envCode);
        env.setEnvName(envName);
        Integer maxSort = sqlEnvConfigMapper.selectList(new LambdaQueryWrapper<SqlEnvConfig>()
                        .eq(SqlEnvConfig::getProjectId, projectId))
                .stream()
                .map(SqlEnvConfig::getSortOrder)
                .max(Integer::compareTo)
                .orElse(0);
        env.setSortOrder(maxSort + 1);
        sqlEnvConfigMapper.insert(env);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void deleteEnv(Integer projectId, String envCode) {
        LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SqlEnvConfig::getProjectId, projectId)
                .eq(SqlEnvConfig::getEnvCode, envCode);
        SqlEnvConfig env = sqlEnvConfigMapper.selectOne(wrapper);
        if (env == null) {
            throw new BusinessException(404, "环境不存在");
        }
        sqlEnvConfigMapper.deleteById(env.getId());
        sqlExecutionLogMapper.softDeleteByProjectAndEnv(projectId, envCode);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void initDefaultEnvs(Integer projectId, Integer userId) {
        List<SqlEnvConfig> defaults = List.of(
                buildEnv(projectId, userId, "local", "本地", 1),
                buildEnv(projectId, userId, "dev", "开发", 2),
                buildEnv(projectId, userId, "test", "测试", 3),
                buildEnv(projectId, userId, "prod", "生产", 4)
        );
        for (SqlEnvConfig env : defaults) {
            LambdaQueryWrapper<SqlEnvConfig> wrapper = new LambdaQueryWrapper<>();
            wrapper.eq(SqlEnvConfig::getProjectId, projectId)
                    .eq(SqlEnvConfig::getEnvCode, env.getEnvCode());
            if (sqlEnvConfigMapper.selectCount(wrapper) == 0) {
                sqlEnvConfigMapper.insert(env);
            }
        }
    }

    private SqlEnvConfig buildEnv(Integer projectId, Integer userId, String code, String name, Integer sort) {
        SqlEnvConfig env = new SqlEnvConfig();
        env.setProjectId(projectId);
        env.setUserId(userId);
        env.setEnvCode(code);
        env.setEnvName(name);
        env.setSortOrder(sort);
        return env;
    }
}
```

**步骤 2: 新增执行记录服务接口与实现**

```java
package com.devsync.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.devsync.entity.SqlExecutionLog;

import java.util.List;
import java.util.Map;

/**
 * SQL执行记录服务接口
 *
 * @author xiaolei
 */
public interface ISqlExecutionLogService extends IService<SqlExecutionLog> {

    void createLog(Integer sqlId, String env, String executor, String remark);

    void revokeLog(Integer sqlId, String env);

    List<SqlExecutionLog> listBySqlIds(List<Integer> sqlIds);

    Map<Integer, Long> countExecutedBySqlIds(List<Integer> sqlIds);
}
```

```java
@Service
@RequiredArgsConstructor
@Slf4j
public class SqlExecutionLogServiceImpl extends ServiceImpl<SqlExecutionLogMapper, SqlExecutionLog>
        implements ISqlExecutionLogService {

    private final SqlExecutionLogMapper sqlExecutionLogMapper;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void createLog(Integer sqlId, String env, String executor, String remark) {
        LambdaQueryWrapper<SqlExecutionLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(SqlExecutionLog::getSqlId, sqlId)
                .eq(SqlExecutionLog::getEnv, env);
        if (sqlExecutionLogMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(400, "该环境已执行");
        }
        SqlExecutionLog logEntity = new SqlExecutionLog();
        logEntity.setSqlId(sqlId);
        logEntity.setEnv(env);
        logEntity.setExecutor(executor == null ? "" : executor);
        logEntity.setRemark(remark == null ? "" : remark);
        logEntity.setExecutedAt(LocalDateTime.now());
        sqlExecutionLogMapper.insert(logEntity);
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void revokeLog(Integer sqlId, String env) {
        SqlExecutionLog logEntity = sqlExecutionLogMapper.selectOne(new LambdaQueryWrapper<SqlExecutionLog>()
                .eq(SqlExecutionLog::getSqlId, sqlId)
                .eq(SqlExecutionLog::getEnv, env));
        if (logEntity == null) {
            throw new BusinessException(404, "执行记录不存在");
        }
        sqlExecutionLogMapper.deleteById(logEntity.getId());
    }

    @Override
    public List<SqlExecutionLog> listBySqlIds(List<Integer> sqlIds) {
        if (sqlIds == null || sqlIds.isEmpty()) {
            return List.of();
        }
        LambdaQueryWrapper<SqlExecutionLog> wrapper = new LambdaQueryWrapper<>();
        wrapper.in(SqlExecutionLog::getSqlId, sqlIds)
                .orderByDesc(SqlExecutionLog::getExecutedAt);
        return sqlExecutionLogMapper.selectList(wrapper);
    }

    @Override
    public Map<Integer, Long> countExecutedBySqlIds(List<Integer> sqlIds) {
        if (sqlIds == null || sqlIds.isEmpty()) {
            return Map.of();
        }
        return sqlExecutionLogMapper.countBySqlIds(sqlIds).stream()
                .collect(Collectors.toMap(SqlExecutionCount::getSqlId, SqlExecutionCount::getCount));
    }
}
```

**步骤 3: 补充 SqlExecutionLogMapper 的批量统计与软删除**

```java
public interface SqlExecutionLogMapper extends BaseMapper<SqlExecutionLog> {

    @Select({
            "<script>",
            "SELECT sql_id AS sqlId, COUNT(*) AS count",
            "FROM sql_execution_log",
            "WHERE deleted_at IS NULL",
            "<if test='sqlIds != null and sqlIds.size > 0'>",
            "  AND sql_id IN",
            "  <foreach collection='sqlIds' item='id' open='(' separator=',' close=')'>",
            "    #{id}",
            "  </foreach>",
            "</if>",
            "GROUP BY sql_id",
            "</script>"
    })
    List<SqlExecutionCount> countBySqlIds(@Param("sqlIds") List<Integer> sqlIds);

    @Update({
            "UPDATE sql_execution_log",
            "SET deleted_at = NOW(), updated_at = NOW()",
            "WHERE deleted_at IS NULL",
            "  AND env = #{envCode}",
            "  AND sql_id IN (",
            "    SELECT id FROM pending_sql",
            "    WHERE project_id = #{projectId} AND deleted_at IS NULL",
            "  )"
    })
    int softDeleteByProjectAndEnv(@Param("projectId") Integer projectId,
                                  @Param("envCode") String envCode);
}
```

```java
package com.devsync.mapper;

import lombok.Data;

/**
 * SQL执行次数统计
 *
 * @author xiaolei
 */
@Data
public class SqlExecutionCount {

    private Integer sqlId;

    private Long count;
}
```

```java
package com.devsync.mapper;

import lombok.Data;

/**
 * 项目待执行SQL统计
 *
 * @author xiaolei
 */
@Data
public class ProjectPendingCount {

    private Integer projectId;

    private Long count;
}
```

**步骤 4: 更新 PendingSqlMapper 的待执行统计SQL**

```java
@Select({
        "SELECT COUNT(*) FROM pending_sql ps",
        "LEFT JOIN (",
        "  SELECT sql_id, COUNT(*) AS executed_count",
        "  FROM sql_execution_log",
        "  WHERE deleted_at IS NULL",
        "  GROUP BY sql_id",
        ") log ON log.sql_id = ps.id",
        "WHERE ps.project_id = #{projectId}",
        "  AND ps.deleted_at IS NULL",
        "  AND COALESCE(log.executed_count, 0) = 0"
})
Integer countPendingByProjectId(Integer projectId);
```

```java
@Select({
        "SELECT COUNT(*) FROM pending_sql ps",
        "LEFT JOIN (",
        "  SELECT sql_id, COUNT(*) AS executed_count",
        "  FROM sql_execution_log",
        "  WHERE deleted_at IS NULL",
        "  GROUP BY sql_id",
        ") log ON log.sql_id = ps.id",
        "WHERE ps.iteration_id = #{iterationId}",
        "  AND ps.deleted_at IS NULL",
        "  AND COALESCE(log.executed_count, 0) = 0"
})
Integer countPendingByIterationId(Integer iterationId);
```

```java
@Select({
        "SELECT COUNT(*) FROM pending_sql ps",
        "LEFT JOIN (",
        "  SELECT sql_id, COUNT(*) AS executed_count",
        "  FROM sql_execution_log",
        "  WHERE deleted_at IS NULL",
        "  GROUP BY sql_id",
        ") log ON log.sql_id = ps.id",
        "WHERE ps.deleted_at IS NULL",
        "  AND COALESCE(log.executed_count, 0) = 0"
})
Integer countPendingAll();
```

```java
@Select({
        "SELECT ps.project_id AS projectId, COUNT(*) AS count",
        "FROM pending_sql ps",
        "LEFT JOIN (",
        "  SELECT sql_id, COUNT(*) AS executed_count",
        "  FROM sql_execution_log",
        "  WHERE deleted_at IS NULL",
        "  GROUP BY sql_id",
        ") log ON log.sql_id = ps.id",
        "WHERE ps.deleted_at IS NULL",
        "  AND COALESCE(log.executed_count, 0) = 0",
        "GROUP BY ps.project_id"
})
List<ProjectPendingCount> countPendingGroupByProject();
```

**步骤 5: 改造 PendingSqlServiceImpl 逻辑**

```java
@RequiredArgsConstructor
public class PendingSqlServiceImpl extends ServiceImpl<PendingSqlMapper, PendingSql>
        implements IPendingSqlService {

    private final PendingSqlMapper pendingSqlMapper;
    private final ProjectMapper projectMapper;
    private final IterationMapper iterationMapper;
    private final ISqlEnvConfigService sqlEnvConfigService;
    private final ISqlExecutionLogService sqlExecutionLogService;

    @Override
    public PageResult<PendingSqlRsp> listSql(PendingSqlListReq req) {
        LambdaQueryWrapper<PendingSql> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(req.getProjectId() != null, PendingSql::getProjectId, req.getProjectId())
                .eq(req.getIterationId() != null, PendingSql::getIterationId, req.getIterationId())
                .like(StrUtil.isNotBlank(req.getTitle()), PendingSql::getTitle, req.getTitle())
                .orderByAsc(PendingSql::getExecutionOrder)
                .orderByDesc(PendingSql::getCreatedAt);

        if (StrUtil.isNotBlank(req.getStatus())) {
            List<PendingSql> records = pendingSqlMapper.selectList(wrapper);
            List<PendingSqlRsp> list = buildEnvExecution(records);
            String normalized = normalizeStatus(req.getStatus());
            List<PendingSqlRsp> filtered = list.stream()
                    .filter(item -> normalized.equals(item.getStatus()))
                    .toList();
            return slicePage(filtered, req.getPageNum(), req.getPageSize());
        }

        Page<PendingSql> page = new Page<>(req.getPageNum(), req.getPageSize());
        Page<PendingSql> result = pendingSqlMapper.selectPage(page, wrapper);
        List<PendingSqlRsp> list = buildEnvExecution(result.getRecords());
        return PageResult.of(list, result.getTotal(), result.getCurrent(), result.getSize());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void executeSql(PendingSqlExecuteReq req) {
        PendingSql sql = pendingSqlMapper.selectById(req.getId());
        if (sql == null) {
            throw new BusinessException(404, "SQL不存在");
        }
        String envCode = normalizeEnv(sql.getProjectId(), req.getExecutedEnv());
        sqlExecutionLogService.createLog(sql.getId(), envCode, req.getExecutor(), req.getRemark());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void batchExecuteSql(PendingSqlBatchExecuteReq req) {
        for (Integer id : req.getIds()) {
            PendingSql sql = pendingSqlMapper.selectById(id);
            if (sql == null) {
                log.warn("[SQL管理] SQL不存在，跳过: {}", id);
                continue;
            }
            String envCode = normalizeEnv(sql.getProjectId(), req.getExecutedEnv());
            try {
                sqlExecutionLogService.createLog(sql.getId(), envCode, null, null);
            } catch (BusinessException ex) {
                log.warn("[SQL管理] SQL已执行，跳过: {}", id);
            }
        }
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void revokeExecution(SqlExecutionRevokeReq req) {
        sqlExecutionLogService.revokeLog(req.getSqlId(), req.getEnv());
    }

    @Override
    public List<PendingSqlRsp> listPendingByProject(Integer projectId) {
        LambdaQueryWrapper<PendingSql> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(PendingSql::getProjectId, projectId)
                .orderByAsc(PendingSql::getExecutionOrder);
        List<PendingSqlRsp> list = buildEnvExecution(pendingSqlMapper.selectList(wrapper));
        return list.stream()
                .filter(item -> SqlExecutionStatusEnum.PENDING.getCode().equals(item.getStatus()))
                .toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateSql(PendingSqlUpdateReq req) {
        PendingSql sql = pendingSqlMapper.selectById(req.getId());
        if (sql == null) {
            throw new BusinessException(404, "SQL不存在");
        }
        // 移除已执行不可编辑限制
        // 其余更新逻辑保持一致
    }

    private List<PendingSqlRsp> buildEnvExecution(List<PendingSql> records) {
        if (records.isEmpty()) {
            return List.of();
        }
        List<Integer> sqlIds = records.stream().map(PendingSql::getId).toList();
        Map<Integer, List<SqlExecutionLog>> logsBySql = sqlExecutionLogService.listBySqlIds(sqlIds)
                .stream()
                .collect(Collectors.groupingBy(SqlExecutionLog::getSqlId));

        List<Integer> projectIds = records.stream()
                .map(PendingSql::getProjectId)
                .distinct()
                .toList();
        Map<Integer, List<SqlEnvConfigRsp>> envByProject = sqlEnvConfigService.listByProjectIds(projectIds);

        return records.stream().map(sql -> convertToRsp(sql, envByProject, logsBySql)).toList();
    }

    private PendingSqlRsp convertToRsp(PendingSql sql,
                                      Map<Integer, List<SqlEnvConfigRsp>> envByProject,
                                      Map<Integer, List<SqlExecutionLog>> logsBySql) {
        PendingSqlRsp rsp = new PendingSqlRsp();
        BeanUtil.copyProperties(sql, rsp);
        List<SqlEnvConfigRsp> envs = envByProject.getOrDefault(sql.getProjectId(), List.of());
        Map<String, SqlExecutionLog> logByEnv = logsBySql.getOrDefault(sql.getId(), List.of()).stream()
                .collect(Collectors.toMap(SqlExecutionLog::getEnv, log -> log, (a, b) -> a));

        List<PendingSqlEnvExecutionRsp> envExecutionList = new ArrayList<>();
        int executedCount = 0;
        for (SqlEnvConfigRsp env : envs) {
            SqlExecutionLog logEntity = logByEnv.get(env.getEnvCode());
            PendingSqlEnvExecutionRsp envRsp = new PendingSqlEnvExecutionRsp();
            envRsp.setEnvCode(env.getEnvCode());
            envRsp.setEnvName(env.getEnvName());
            envRsp.setExecuted(logEntity != null);
            if (logEntity != null) {
                envRsp.setExecutedAt(logEntity.getExecutedAt());
                envRsp.setExecutor(logEntity.getExecutor());
                envRsp.setRemark(logEntity.getRemark());
                executedCount++;
            }
            envExecutionList.add(envRsp);
        }

        rsp.setEnvExecutionList(envExecutionList);
        rsp.setExecutedCount(executedCount);
        rsp.setEnvTotal(envs.size());
        SqlExecutionStatusEnum statusEnum = SqlExecutionStatusHelper.calculate(executedCount, envs.size());
        rsp.setStatus(statusEnum.getCode());
        rsp.setStatusDesc(statusEnum.getDesc());

        logsBySql.getOrDefault(sql.getId(), List.of()).stream()
                .max(Comparator.comparing(SqlExecutionLog::getExecutedAt))
                .ifPresent(latest -> {
                    rsp.setExecutedAt(latest.getExecutedAt());
                    rsp.setExecutedEnv(latest.getEnv());
                });

        return rsp;
    }

    private String normalizeStatus(String status) {
        if (SqlStatusEnum.EXECUTED.getCode().equals(status)) {
            return SqlExecutionStatusEnum.COMPLETED.getCode();
        }
        return status;
    }

    private PageResult<PendingSqlRsp> slicePage(List<PendingSqlRsp> list, Integer pageNum, Integer pageSize) {
        int current = pageNum == null || pageNum <= 0 ? 1 : pageNum;
        int size = pageSize == null || pageSize <= 0 ? 20 : pageSize;
        int fromIndex = Math.min((current - 1) * size, list.size());
        int toIndex = Math.min(fromIndex + size, list.size());
        List<PendingSqlRsp> pageList = list.subList(fromIndex, toIndex);
        return PageResult.of(pageList, list.size(), current, size);
    }

    private String normalizeEnv(Integer projectId, String envCode) {
        if (StrUtil.isBlank(envCode)) {
            throw new BusinessException(400, "执行环境不能为空");
        }
        String normalized = envCode.trim().toLowerCase();
        boolean exists = sqlEnvConfigService.listByProjectId(projectId).stream()
                .anyMatch(env -> normalized.equals(env.getEnvCode()));
        if (!exists) {
            throw new BusinessException(400, "环境不存在，请先添加环境");
        }
        return normalized;
    }
}
```

**步骤 6: 更新 IPendingSqlService 定义**

```java
public interface IPendingSqlService extends IService<PendingSql> {

    PageResult<PendingSqlRsp> listSql(PendingSqlListReq req);

    PendingSqlRsp getSqlDetail(Integer id);

    Integer addSql(PendingSqlAddReq req);

    void updateSql(PendingSqlUpdateReq req);

    void deleteSql(Integer id);

    void executeSql(PendingSqlExecuteReq req);

    void batchExecuteSql(PendingSqlBatchExecuteReq req);

    void revokeExecution(SqlExecutionRevokeReq req);

    List<PendingSqlRsp> listPendingByProject(Integer projectId);
}
```

**步骤 7: 项目新增时初始化默认环境，并更新仪表盘/统计依赖**

```java
public Integer addProject(ProjectAddReq req) {
    // ...原有校验逻辑
    projectMapper.insert(project);
    Integer userId = project.getUserId() == null ? 1 : project.getUserId();
    sqlEnvConfigService.initDefaultEnvs(project.getId(), userId);
    return project.getId();
}
```

```java
// DashboardServiceImpl 中待执行SQL统计使用新 mapper
Long pendingSqlCount = pendingSqlMapper.countPendingAll().longValue();
rsp.setPendingSqlCount(pendingSqlCount.intValue());

List<ProjectPendingCount> pendingCounts = pendingSqlMapper.countPendingGroupByProject();
Map<Integer, String> projectNames = new HashMap<>();
if (!pendingCounts.isEmpty()) {
    List<Project> projects = projectMapper.selectBatchIds(
            pendingCounts.stream().map(ProjectPendingCount::getProjectId).toList()
    );
    for (Project project : projects) {
        projectNames.put(project.getId(), project.getName());
    }
}
List<DashboardRsp.ProjectPendingSqlRsp> result = new ArrayList<>();
for (ProjectPendingCount count : pendingCounts) {
    DashboardRsp.ProjectPendingSqlRsp item = new DashboardRsp.ProjectPendingSqlRsp();
    item.setProjectId(count.getProjectId());
    item.setProjectName(projectNames.getOrDefault(count.getProjectId(), "未知项目"));
    item.setCount(count.getCount().intValue());
    result.add(item);
}
rsp.setPendingSqlByProject(result);
```

**步骤 8: 运行后端编译验证**

运行：`mvn -q -DskipTests compile`
预期：编译通过，无语法错误。

**步骤 9: 提交**

```bash
git add backend/src/main/java/com/devsync/service/ISqlEnvConfigService.java \
       backend/src/main/java/com/devsync/service/ISqlExecutionLogService.java \
       backend/src/main/java/com/devsync/service/impl/SqlEnvConfigServiceImpl.java \
       backend/src/main/java/com/devsync/service/impl/SqlExecutionLogServiceImpl.java \
       backend/src/main/java/com/devsync/service/IPendingSqlService.java \
       backend/src/main/java/com/devsync/service/impl/PendingSqlServiceImpl.java \
       backend/src/main/java/com/devsync/mapper/PendingSqlMapper.java \
       backend/src/main/java/com/devsync/service/impl/ProjectServiceImpl.java \
       backend/src/main/java/com/devsync/service/impl/DashboardServiceImpl.java

git commit -m "改造SQL执行逻辑支持多环境"
```

---

### 任务 5: 更新控制器与API文档

**文件：**
- 修改：`backend/src/main/java/com/devsync/controller/PendingSqlController.java:1`
- 修改：`docs/api.md:1`

**步骤 1: PendingSqlController 新增环境管理与撤销接口**

```java
@RequiredArgsConstructor
public class PendingSqlController {

    private final IPendingSqlService pendingSqlService;
    private final ISqlEnvConfigService sqlEnvConfigService;
}
```

```java
@PostMapping("/env/list")
@Operation(summary = "获取项目环境列表")
public Result<List<SqlEnvConfigRsp>> listEnv(@Valid @RequestBody SqlEnvListReq req) {
    return Result.success(sqlEnvConfigService.listByProjectId(req.getProjectId()));
}

@PostMapping("/env/add")
@Operation(summary = "添加项目环境")
public Result<Void> addEnv(@Valid @RequestBody SqlEnvAddReq req) {
    sqlEnvConfigService.addEnv(req.getProjectId(), req.getEnvCode(), req.getEnvName());
    return Result.success();
}

@PostMapping("/env/delete")
@Operation(summary = "删除项目环境")
public Result<Void> deleteEnv(@Valid @RequestBody SqlEnvDeleteReq req) {
    sqlEnvConfigService.deleteEnv(req.getProjectId(), req.getEnvCode());
    return Result.success();
}

@PostMapping("/revoke-execution")
@Operation(summary = "撤销SQL执行")
public Result<Void> revokeExecution(@Valid @RequestBody SqlExecutionRevokeReq req) {
    pendingSqlService.revokeExecution(req);
    return Result.success();
}
```

**步骤 2: 更新 API 文档 SQL 管理章节**

在 `docs/api.md` 补充：
- `POST /sql/env/list`
- `POST /sql/env/add`
- `POST /sql/env/delete`
- `POST /sql/revoke-execution`
- 更新 `POST /sql/execute` 请求参数（增加 remark/executor）
- 更新 SQL 列表响应：`envExecutionList`、`executedCount`、`envTotal`、`status` 可取值

**步骤 3: 运行后端编译验证**

运行：`mvn -q -DskipTests compile`
预期：编译通过，无语法错误。

**步骤 4: 提交**

```bash
git add backend/src/main/java/com/devsync/controller/PendingSqlController.java docs/api.md

git commit -m "补充SQL环境管理接口与文档"
```

---

### 任务 6: 新增前端多环境执行组件

**文件：**
- 创建：`frontend/src/components/sql/EnvExecutionButtons.tsx`
- 创建：`frontend/src/components/sql/ExecuteConfirmDialog.tsx`
- 创建：`frontend/src/components/sql/AddEnvDialog.tsx`

**步骤 1: 新增环境按钮组组件**

```tsx
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { Check, Plus } from 'lucide-react'

export interface EnvExecutionItem {
  envCode: string
  envName: string
  executed: boolean
  executedAt?: string
  executor?: string
  remark?: string
}

interface EnvExecutionButtonsProps {
  items: EnvExecutionItem[]
  executedCount: number
  envTotal: number
  onExecute: (envCode: string) => void
  onDetail: (envCode: string) => void
  onAddEnv: () => void
}

export function EnvExecutionButtons({
  items,
  executedCount,
  envTotal,
  onExecute,
  onDetail,
  onAddEnv,
}: EnvExecutionButtonsProps) {
  const formatDate = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return format(date, 'MM-dd')
  }
  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">环境执行：已完成 {executedCount}/{envTotal}</div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => {
          const isDone = item.executed
          return (
            <button
              key={item.envCode}
              type="button"
              onClick={() => (isDone ? onDetail(item.envCode) : onExecute(item.envCode))}
              className={cn(
                'flex min-w-[96px] flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs transition',
                isDone
                  ? 'border-emerald-400/60 bg-emerald-50 text-emerald-700'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
              )}
            >
              <div className="text-sm font-medium">{item.envName || item.envCode.toUpperCase()}</div>
              {isDone ? (
                <div className="flex items-center gap-1 text-[11px]">
                  <Check className="h-3 w-3" />
                  <span>{formatDate(item.executedAt) || '已执行'}</span>
                </div>
              ) : (
                <div className="text-[11px]">待执行</div>
              )}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onAddEnv}
          className="flex min-w-[96px] flex-col items-center gap-1 rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground hover:border-muted-foreground"
        >
          <Plus className="h-4 w-4" />
          添加环境
        </button>
      </div>
    </div>
  )
}
```

**步骤 2: 新增执行确认/详情对话框组件**

```tsx
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

interface ExecuteConfirmDialogProps {
  open: boolean
  mode: 'execute' | 'detail'
  envName: string
  sqlTitle: string
  executedAt?: string
  executor?: string
  remark: string
  onRemarkChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
  onRevoke?: () => void
}

export function ExecuteConfirmDialog({
  open,
  mode,
  envName,
  sqlTitle,
  executedAt,
  executor,
  remark,
  onRemarkChange,
  onClose,
  onConfirm,
  onRevoke,
}: ExecuteConfirmDialogProps) {
  const isDetail = mode === 'detail'

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isDetail ? `执行详情 - ${envName}` : `确认执行 - ${envName}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>SQL：{sqlTitle}</div>
          {isDetail && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>执行时间：{executedAt || '-'}</div>
              <div>执行人：{executor || '-'}</div>
            </div>
          )}
          <Textarea
            value={remark}
            onChange={(e) => onRemarkChange(e.target.value)}
            placeholder={isDetail ? '执行备注' : '执行备注（可选）'}
            disabled={isDetail}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          {isDetail ? (
            <Button onClick={onRevoke}>撤销执行</Button>
          ) : (
            <Button onClick={onConfirm}>确认执行</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**步骤 3: 新增添加环境对话框组件**

```tsx
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddEnvDialogProps {
  open: boolean
  envCode: string
  envName: string
  onEnvCodeChange: (value: string) => void
  onEnvNameChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function AddEnvDialog({
  open,
  envCode,
  envName,
  onEnvCodeChange,
  onEnvNameChange,
  onClose,
  onConfirm,
}: AddEnvDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加环境</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>环境代码</Label>
            <Input value={envCode} onChange={(e) => onEnvCodeChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>环境名称</Label>
            <Input value={envName} onChange={(e) => onEnvNameChange(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={onConfirm}>确认添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**步骤 4: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 5: 提交**

```bash
git add frontend/src/components/sql/EnvExecutionButtons.tsx \
       frontend/src/components/sql/ExecuteConfirmDialog.tsx \
       frontend/src/components/sql/AddEnvDialog.tsx

git commit -m "新增SQL环境按钮与弹窗组件"
```

---

### 任务 7: 前端页面集成多环境执行交互

**文件：**
- 修改：`frontend/src/pages/SqlManagement.tsx:1`

**步骤 1: 更新类型定义与查询结构**

```tsx
import { EnvExecutionButtons } from '@/components/sql/EnvExecutionButtons'
import { ExecuteConfirmDialog } from '@/components/sql/ExecuteConfirmDialog'
import { AddEnvDialog } from '@/components/sql/AddEnvDialog'

interface EnvExecution {
  envCode: string
  envName: string
  executed: boolean
  executedAt?: string
  executor?: string
  remark?: string
}

interface PendingSql {
  id: number
  projectId: number
  projectName: string
  iterationId: number
  iterationName: string
  title: string
  content: string
  executionOrder: number
  status: string
  statusDesc: string
  executedAt: string
  executedEnv: string
  remark: string
  executedCount: number
  envTotal: number
  envExecutionList: EnvExecution[]
}
```

**步骤 2: 增加执行确认与环境添加的状态管理**

```tsx
const [executeDialogOpen, setExecuteDialogOpen] = useState(false)
const [executeDialogMode, setExecuteDialogMode] = useState<'execute' | 'detail'>('execute')
const [selectedEnv, setSelectedEnv] = useState<EnvExecution | null>(null)
const [selectedSql, setSelectedSql] = useState<PendingSql | null>(null)
const [executeRemark, setExecuteRemark] = useState('')

const [addEnvOpen, setAddEnvOpen] = useState(false)
const [envCodeInput, setEnvCodeInput] = useState('')
const [envNameInput, setEnvNameInput] = useState('')
const [activeProjectId, setActiveProjectId] = useState<number | null>(null)
```

**步骤 3: 新增执行/撤销/添加环境的 mutation**

```tsx
const executeMutation = useMutation({
  mutationFn: ({ id, env, remark }: { id: number; env: string; remark: string }) =>
    api.post('/sql/execute', { id, executedEnv: env, remark }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
    setExecuteDialogOpen(false)
    setExecuteRemark('')
    setSelectedEnv(null)
    setSelectedSql(null)
  },
})

const revokeMutation = useMutation({
  mutationFn: ({ sqlId, env }: { sqlId: number; env: string }) =>
    api.post('/sql/revoke-execution', { sqlId, env }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
    setExecuteDialogOpen(false)
    setExecuteRemark('')
    setSelectedEnv(null)
    setSelectedSql(null)
  },
})

const addEnvMutation = useMutation({
  mutationFn: ({ projectId, envCode, envName }: { projectId: number; envCode: string; envName: string }) =>
    api.post('/sql/env/add', { projectId, envCode, envName }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
    setAddEnvOpen(false)
    setEnvCodeInput('')
    setEnvNameInput('')
  },
})
```

**步骤 4: 替换执行按钮区域为 EnvExecutionButtons**

```tsx
<EnvExecutionButtons
  items={sql.envExecutionList}
  executedCount={sql.executedCount}
  envTotal={sql.envTotal}
  onExecute={(envCode) => {
    const env = sql.envExecutionList.find((item) => item.envCode === envCode)
    if (!env) return
    setSelectedSql(sql)
    setSelectedEnv(env)
    setExecuteDialogMode('execute')
    setExecuteRemark('')
    setExecuteDialogOpen(true)
  }}
  onDetail={(envCode) => {
    const env = sql.envExecutionList.find((item) => item.envCode === envCode)
    if (!env) return
    setSelectedSql(sql)
    setSelectedEnv(env)
    setExecuteDialogMode('detail')
    setExecuteRemark(env.remark || '')
    setExecuteDialogOpen(true)
  }}
  onAddEnv={() => {
    setActiveProjectId(sql.projectId)
    setAddEnvOpen(true)
  }}
/>
```

**步骤 5: 取消编辑禁用并在保存时提示已执行环境**

```tsx
<Button
  variant="ghost"
  size="sm"
  className="h-9 w-9 p-0"
  onClick={() => handleStartEdit(sql)}
  aria-label="编辑 SQL"
>
  <Pencil className="h-4 w-4" />
</Button>
```

```tsx
const handleSaveEdit = () => {
  if (!editingId) return
  const editingSql = sqlList?.list.find((item) => item.id === editingId)
  if (editingSql && editingSql.executedCount > 0) {
    if (!confirm('该SQL已在部分环境执行，修改不影响已有执行记录，是否继续？')) {
      return
    }
  }
  updateMutation.mutate({
    id: editingId,
    title: editForm.title,
    content: editForm.content,
    remark: editForm.remark,
  })
}
```

**步骤 6: 更新状态筛选选项与已执行提示**

```tsx
<option value="pending">待执行</option>
<option value="partial">部分执行</option>
<option value="completed">全部完成</option>
```

```tsx
{sql.executedAt && (
  <p className="text-xs text-muted-foreground">
    最近执行时间: {sql.executedAt} | 环境: {sql.executedEnv}
  </p>
)}
```

**步骤 7: 接入执行确认与添加环境弹窗**

```tsx
<ExecuteConfirmDialog
  open={executeDialogOpen}
  mode={executeDialogMode}
  envName={selectedEnv?.envName || ''}
  sqlTitle={selectedSql?.title || ''}
  executedAt={selectedEnv?.executedAt}
  executor={selectedEnv?.executor}
  remark={executeRemark}
  onRemarkChange={setExecuteRemark}
  onClose={() => {
    setExecuteDialogOpen(false)
    setSelectedEnv(null)
    setSelectedSql(null)
    setExecuteRemark('')
  }}
  onConfirm={() => {
    if (!selectedEnv || !selectedSql) return
    executeMutation.mutate({ id: selectedSql.id, env: selectedEnv.envCode, remark: executeRemark })
  }}
  onRevoke={() => {
    if (!selectedEnv || !selectedSql) return
    revokeMutation.mutate({ sqlId: selectedSql.id, env: selectedEnv.envCode })
  }}
/>

<AddEnvDialog
  open={addEnvOpen}
  envCode={envCodeInput}
  envName={envNameInput}
  onEnvCodeChange={setEnvCodeInput}
  onEnvNameChange={setEnvNameInput}
  onClose={() => setAddEnvOpen(false)}
  onConfirm={() => {
    if (!activeProjectId) return
    const code = envCodeInput.trim().toLowerCase()
    const name = envNameInput.trim()
    if (!code || !name) return
    addEnvMutation.mutate({ projectId: activeProjectId, envCode: code, envName: name })
  }}
/>
```

**步骤 8: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 9: 提交**

```bash
git add frontend/src/pages/SqlManagement.tsx

git commit -m "SQL管理页面接入多环境执行"
```

---

### 任务 8: 端到端验证与回归检查

**文件：**
- 修改：无

**步骤 1: 后端编译检查**

运行：`mvn -q -DskipTests compile`
预期：编译通过，无语法错误。

**步骤 2: 前端构建检查**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 3: 手工验证清单**

1. 新建项目，确认自动生成 local/dev/test/prod 环境。
2. 新建 SQL 后，环境按钮显示为待执行，进度为 0/4。
3. 点击未执行环境，填写备注后确认执行，按钮变为已执行并显示日期。
4. 点击已执行环境，弹出详情并可撤销，撤销后回到待执行。
5. 对已执行 SQL 进行编辑，弹出提示后可保存，执行记录保持不变。
6. 状态筛选依次验证：待执行/部分执行/全部完成。

---

**计划完成并保存到 `docs/plans/2026-01-25-sql-multi-env-execution.md`。有两种执行选项：**

**1. 子代理驱动（本会话）** - 我为每个任务分派新的子代理，在任务之间进行审查，快速迭代

**2. 并行会话（单独）** - 打开新的会话以执行计划，批量执行并设置检查点

选择哪种方法？
