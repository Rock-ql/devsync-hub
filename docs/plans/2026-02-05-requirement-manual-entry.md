# 手动需求录入与关联 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 用手动录入需求替换 PingCode 同步，支持需求与迭代/项目/SQL/提交的关联管理。

**架构：** 新增 requirement/requirement_project 表与后端 CRUD 服务，复用 work_item_link 做关联；前端在迭代页内嵌需求列表与弹窗，并在 SQL 管理页提供关联入口。

**技术栈：** Spring Boot 3 + MyBatis-Plus，React + TanStack Query，PostgreSQL。

**技能引用：** @superpowers:executing-plans

---

### 任务 1: 数据库与核心模型

**文件：**
- 修改：`backend/src/main/resources/db/init.sql`
- 修改：`backend/src/main/java/com/devsync/entity/Iteration.java`
- 创建：`backend/src/main/java/com/devsync/entity/Requirement.java`
- 创建：`backend/src/main/java/com/devsync/entity/RequirementProject.java`
- 修改：`backend/src/main/java/com/devsync/dto/rsp/IterationRsp.java`

**步骤 1: 编写失败的测试**

```java
// backend/src/test/java/com/devsync/requirement/RequirementSchemaTest.java
// 目的：确认 init.sql 中包含 requirement / requirement_project 的建表语句
// 失败点：文件不存在或缺少关键 DDL 关键字
```

**步骤 2: 运行测试以验证其失败**

运行：`mvn -q -f backend/pom.xml -Dtest=RequirementSchemaTest test`
预期：测试失败，提示缺少 requirement 相关 DDL。

**步骤 3: 编写最小实现**

1) 在 `backend/src/main/resources/db/init.sql` 中新增表，并移除 PingCode 表与字段。

```sql
-- 需求表
CREATE TABLE IF NOT EXISTS requirement (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL DEFAULT 1,
    iteration_id INTEGER NOT NULL,
    name VARCHAR(500) NOT NULL,
    link VARCHAR(1000) DEFAULT '',
    state INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP DEFAULT NULL
);

COMMENT ON TABLE requirement IS '需求表';
COMMENT ON COLUMN requirement.iteration_id IS '归属迭代ID（必填）';
COMMENT ON COLUMN requirement.name IS '需求名称';
COMMENT ON COLUMN requirement.link IS '需求链接URL';

-- 需求-项目关联表
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

-- 删除 PingCode 相关表与字段（保留 work_item_link）
-- 删除 pingcode_config / pingcode_work_item 表的建表语句
-- 删除 iteration.pingcode_sprint_id 的 ALTER
```

2) 在 `backend/src/main/java/com/devsync/entity/Iteration.java` 中删除字段 `pingcodeSprintId`。

3) 新增实体：

```java
// backend/src/main/java/com/devsync/entity/Requirement.java
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("requirement")
public class Requirement extends BaseEntity {
    private static final long serialVersionUID = 1L;
    private Integer iterationId;
    private String name;
    private String link;
}

// backend/src/main/java/com/devsync/entity/RequirementProject.java
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("requirement_project")
public class RequirementProject extends BaseEntity {
    private static final long serialVersionUID = 1L;
    private Integer requirementId;
    private Integer projectId;
}
```

4) 在 `backend/src/main/java/com/devsync/dto/rsp/IterationRsp.java` 中把 `pingcodeWorkItemCount` 改为 `requirementCount`。

**步骤 4: 运行测试以验证其通过**

运行：`mvn -q -f backend/pom.xml -Dtest=RequirementSchemaTest test`
预期：测试通过。

**步骤 5: 提交**

```bash
git add backend/src/main/resources/db/init.sql \
  backend/src/main/java/com/devsync/entity/Iteration.java \
  backend/src/main/java/com/devsync/entity/Requirement.java \
  backend/src/main/java/com/devsync/entity/RequirementProject.java \
  backend/src/main/java/com/devsync/dto/rsp/IterationRsp.java \
  backend/src/test/java/com/devsync/requirement/RequirementSchemaTest.java

git commit -m "feat: 新增需求表与核心模型"
```

---

### 任务 2: 需求 CRUD 与关联后端

**文件：**
- 创建：`backend/src/main/java/com/devsync/mapper/RequirementMapper.java`
- 创建：`backend/src/main/java/com/devsync/mapper/RequirementProjectMapper.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/RequirementAddReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/RequirementUpdateReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/RequirementListReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/RequirementDeleteReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/req/RequirementLinkReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/rsp/RequirementRsp.java`
- 创建：`backend/src/main/java/com/devsync/service/IRequirementService.java`
- 创建：`backend/src/main/java/com/devsync/service/impl/RequirementServiceImpl.java`
- 创建：`backend/src/main/java/com/devsync/controller/RequirementController.java`
- 修改：`backend/src/main/java/com/devsync/mapper/WorkItemLinkMapper.java`

**步骤 1: 编写失败的测试**

```java
// backend/src/test/java/com/devsync/requirement/RequirementServiceImplTest.java
// 目标：验证 add/update/list/delete/link 逻辑
// 失败点：RequirementServiceImpl 尚未实现
```

**步骤 2: 运行测试以验证其失败**

运行：`mvn -q -f backend/pom.xml -Dtest=RequirementServiceImplTest test`
预期：测试失败，提示类缺失或方法未实现。

**步骤 3: 编写最小实现**

1) Mapper 定义：

```java
@Mapper
public interface RequirementMapper extends BaseMapper<Requirement> {
    @Select("SELECT COUNT(*) FROM requirement WHERE iteration_id = #{iterationId} AND deleted_at IS NULL")
    Integer countByIterationId(Integer iterationId);
}

@Mapper
public interface RequirementProjectMapper extends BaseMapper<RequirementProject> {
    @Select("SELECT project_id FROM requirement_project WHERE requirement_id = #{requirementId} AND deleted_at IS NULL")
    List<Integer> selectProjectIds(Integer requirementId);
}
```

2) DTO 定义（示例）：

```java
@Data
public class RequirementAddReq {
    @NotNull
    private Integer iterationId;
    @NotBlank
    private String name;
    private String link;
    private List<Integer> projectIds;
}

@Data
public class RequirementLinkReq {
    @NotNull
    private Integer requirementId;
    @NotBlank
    private String linkType; // sql | commit
    @NotNull
    private Integer linkId;
}
```

3) Service 核心逻辑（示例）：

```java
@Service
@RequiredArgsConstructor
public class RequirementServiceImpl implements IRequirementService {

    private final RequirementMapper requirementMapper;
    private final RequirementProjectMapper requirementProjectMapper;
    private final ProjectMapper projectMapper;
    private final WorkItemLinkMapper workItemLinkMapper;

    @Override
    public List<RequirementRsp> list(RequirementListReq req) {
        LambdaQueryWrapper<Requirement> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(Requirement::getIterationId, req.getIterationId())
               .like(StrUtil.isNotBlank(req.getKeyword()), Requirement::getName, req.getKeyword())
               .orderByDesc(Requirement::getCreatedAt);
        List<Requirement> requirements = requirementMapper.selectList(wrapper);
        return requirements.stream().map(this::toRsp).toList();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Integer add(RequirementAddReq req) {
        Requirement requirement = new Requirement();
        requirement.setIterationId(req.getIterationId());
        requirement.setName(req.getName());
        requirement.setLink(StrUtil.blankToDefault(req.getLink(), ""));
        requirementMapper.insert(requirement);
        syncProjects(requirement.getId(), req.getProjectIds());
        return requirement.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void update(RequirementUpdateReq req) {
        Requirement requirement = requirementMapper.selectById(req.getId());
        if (requirement == null) {
            throw new BusinessException(404, "需求不存在");
        }
        requirement.setName(req.getName());
        requirement.setLink(StrUtil.blankToDefault(req.getLink(), ""));
        requirementMapper.updateById(requirement);
        syncProjects(req.getId(), req.getProjectIds());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void delete(RequirementDeleteReq req) {
        Requirement requirement = requirementMapper.selectById(req.getId());
        if (requirement == null) {
            throw new BusinessException(404, "需求不存在");
        }
        requirementMapper.deleteById(req.getId());
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void link(RequirementLinkReq req) {
        Requirement requirement = requirementMapper.selectById(req.getRequirementId());
        if (requirement == null) {
            throw new BusinessException(404, "需求不存在");
        }
        LambdaQueryWrapper<WorkItemLink> wrapper = new LambdaQueryWrapper<>();
        wrapper.eq(WorkItemLink::getWorkItemId, req.getRequirementId())
               .eq(WorkItemLink::getLinkType, req.getLinkType())
               .eq(WorkItemLink::getLinkId, req.getLinkId());
        if (workItemLinkMapper.selectCount(wrapper) == 0) {
            WorkItemLink link = new WorkItemLink();
            link.setWorkItemId(req.getRequirementId());
            link.setLinkType(req.getLinkType());
            link.setLinkId(req.getLinkId());
            workItemLinkMapper.insert(link);
        }
    }
}
```

4) Controller 样式与异常处理保持一致：

```java
@PostMapping("/list")
public Result<List<RequirementRsp>> list(@Valid @RequestBody RequirementListReq req) {
    try {
        return Result.success(requirementService.list(req));
    } catch (Exception e) {
        log.error("[需求管理] 列表查询失败，参数: {}", JSON.toJSONString(req), e);
        if (e instanceof BusinessException be) {
            return Result.error(be.getCode(), be.getMessage());
        }
        return Result.error("需求列表查询失败");
    }
}
```

5) `WorkItemLinkMapper` 增加统计方法：

```java
@Select("SELECT COUNT(*) FROM work_item_link WHERE work_item_id = #{requirementId} AND link_type = #{linkType} AND deleted_at IS NULL")
Integer countByRequirementAndType(Integer requirementId, String linkType);
```

**步骤 4: 运行测试以验证其通过**

运行：`mvn -q -f backend/pom.xml -Dtest=RequirementServiceImplTest test`
预期：测试通过。

**步骤 5: 提交**

```bash
git add backend/src/main/java/com/devsync/mapper/RequirementMapper.java \
  backend/src/main/java/com/devsync/mapper/RequirementProjectMapper.java \
  backend/src/main/java/com/devsync/dto/req/RequirementAddReq.java \
  backend/src/main/java/com/devsync/dto/req/RequirementUpdateReq.java \
  backend/src/main/java/com/devsync/dto/req/RequirementListReq.java \
  backend/src/main/java/com/devsync/dto/req/RequirementDeleteReq.java \
  backend/src/main/java/com/devsync/dto/req/RequirementLinkReq.java \
  backend/src/main/java/com/devsync/dto/rsp/RequirementRsp.java \
  backend/src/main/java/com/devsync/service/IRequirementService.java \
  backend/src/main/java/com/devsync/service/impl/RequirementServiceImpl.java \
  backend/src/main/java/com/devsync/controller/RequirementController.java \
  backend/src/main/java/com/devsync/mapper/WorkItemLinkMapper.java \
  backend/src/test/java/com/devsync/requirement/RequirementServiceImplTest.java

git commit -m "feat: 新增需求后端 CRUD 与关联接口"
```

---

### 任务 3: 迭代/仪表盘统计改造

**文件：**
- 修改：`backend/src/main/java/com/devsync/service/impl/IterationServiceImpl.java`
- 修改：`backend/src/main/java/com/devsync/service/impl/DashboardServiceImpl.java`
- 修改：`backend/src/main/java/com/devsync/dto/rsp/DashboardRsp.java`
- 修改：`frontend/src/pages/Dashboard.tsx`
- 修改：`frontend/src/pages/Iterations.tsx`

**步骤 1: 编写失败的测试**

```java
// backend/src/test/java/com/devsync/requirement/RequirementCountTest.java
// 目标：迭代与仪表盘使用 requirementCount 字段
// 失败点：仍使用 pingcodeWorkItemCount
```

**步骤 2: 运行测试以验证其失败**

运行：`mvn -q -f backend/pom.xml -Dtest=RequirementCountTest test`
预期：测试失败。

**步骤 3: 编写最小实现**

1) 后端替换统计来源：

```java
// IterationServiceImpl
private final RequirementMapper requirementMapper;
...
rsp.setRequirementCount(requirementMapper.countByIterationId(iteration.getId()));
```

```java
// DashboardServiceImpl
Long requirementCount = requirementMapper.selectCount(new LambdaQueryWrapper<>());
rsp.setRequirementCount(requirementCount == null ? 0 : requirementCount.intValue());
```

2) 更新 `DashboardRsp` 字段名称为 `requirementCount`，移除 `trackedWorkItemCount`，并同步前端展示文案为“需求总数”。

3) 迭代列表字段改为 `requirementCount`，并在前端显示为“关联需求”。

**步骤 4: 运行测试以验证其通过**

运行：`mvn -q -f backend/pom.xml -Dtest=RequirementCountTest test`
预期：测试通过。

**步骤 5: 提交**

```bash
git add backend/src/main/java/com/devsync/service/impl/IterationServiceImpl.java \
  backend/src/main/java/com/devsync/service/impl/DashboardServiceImpl.java \
  backend/src/main/java/com/devsync/dto/rsp/DashboardRsp.java \
  frontend/src/pages/Dashboard.tsx \
  frontend/src/pages/Iterations.tsx \
  backend/src/test/java/com/devsync/requirement/RequirementCountTest.java

git commit -m "feat: 迭代与仪表盘切换为需求统计"
```

---

### 任务 4: 迭代页需求管理 UI

**文件：**
- 创建：`frontend/src/api/requirement.ts`
- 创建：`frontend/src/components/requirement/RequirementDialog.tsx`
- 创建：`frontend/src/components/requirement/RequirementList.tsx`
- 修改：`frontend/src/pages/Iterations.tsx`
- 修改：`frontend/src/api/index.ts`

**步骤 1: 编写失败的测试**

```tsx
// frontend/src/components/requirement/__tests__/RequirementList.test.tsx
// 目标：渲染需求列表、展开/折叠、弹窗提交
// 失败点：组件不存在
```

**步骤 2: 运行测试以验证其失败**

运行：`npm --prefix frontend test`
预期：测试失败，提示找不到组件。

**步骤 3: 编写最小实现**

1) API 封装：

```ts
// frontend/src/api/requirement.ts
export const requirementApi = {
  list: (iterationId: number, keyword?: string) =>
    api.post('/requirement/list', { iterationId, keyword }),
  add: (payload: RequirementAddPayload) => api.post('/requirement/add', payload),
  update: (payload: RequirementUpdatePayload) => api.post('/requirement/update', payload),
  remove: (id: number) => api.post('/requirement/delete', { id }),
}
```

2) 需求弹窗与列表组件：

```tsx
// RequirementDialog：包含名称、链接、关联项目多选
// RequirementList：展开后渲染需求列表 + “添加需求”按钮
```

3) 在 `Iterations.tsx` 中加入展开/折叠逻辑，并把 `requirementCount` 显示在“关联需求”列。

**步骤 4: 运行测试以验证其通过**

运行：`npm --prefix frontend test`
预期：测试通过。

**步骤 5: 提交**

```bash
git add frontend/src/api/requirement.ts \
  frontend/src/components/requirement/RequirementDialog.tsx \
  frontend/src/components/requirement/RequirementList.tsx \
  frontend/src/pages/Iterations.tsx \
  frontend/src/api/index.ts \
  frontend/src/components/requirement/__tests__/RequirementList.test.tsx

git commit -m "feat: 迭代页需求列表与弹窗"
```

---

### 任务 5: SQL 管理页关联需求

**文件：**
- 修改：`frontend/src/pages/SqlManagement.tsx`
- 创建：`frontend/src/components/requirement/RequirementLinkDialog.tsx`
- 修改：`backend/src/main/java/com/devsync/service/impl/RequirementServiceImpl.java`

**步骤 1: 编写失败的测试**

```tsx
// frontend/src/components/requirement/__tests__/RequirementLinkDialog.test.tsx
// 目标：选择需求并调用 /requirement/link
```

**步骤 2: 运行测试以验证其失败**

运行：`npm --prefix frontend test`
预期：测试失败。

**步骤 3: 编写最小实现**

1) 在 SQL 列表每行新增“关联需求”按钮，打开 `RequirementLinkDialog`。

2) `RequirementLinkDialog` 通过 `/iteration/list` 与 `/requirement/list` 组合加载需求，并按迭代名称分组展示。

3) 提交时调用 `/requirement/link`，请求体示例：

```ts
{ requirementId: 12, linkType: 'sql', linkId: 123 }
```

4) 后端在 `RequirementServiceImpl` 中复用 `WorkItemLinkMapper`，并在需求列表响应中补齐 `linkedSqlCount` / `linkedCommitCount`。

**步骤 4: 运行测试以验证其通过**

运行：`npm --prefix frontend test`
预期：测试通过。

**步骤 5: 提交**

```bash
git add frontend/src/pages/SqlManagement.tsx \
  frontend/src/components/requirement/RequirementLinkDialog.tsx \
  frontend/src/components/requirement/__tests__/RequirementLinkDialog.test.tsx \
  backend/src/main/java/com/devsync/service/impl/RequirementServiceImpl.java

git commit -m "feat: SQL 管理页关联需求"
```

---

### 任务 6: 清理 PingCode 代码与路由

**文件：**
- 删除：`backend/src/main/java/com/devsync/client/PingCodeClient.java`
- 删除：`backend/src/main/java/com/devsync/client/PingCodeRequestHelper.java`
- 删除：`backend/src/main/java/com/devsync/common/enums/PingCodeErrorCodeEnum.java`
- 删除：`backend/src/main/java/com/devsync/controller/PingCodeController.java`
- 删除：`backend/src/main/java/com/devsync/service/IPingCodeService.java`
- 删除：`backend/src/main/java/com/devsync/service/impl/PingCodeServiceImpl.java`
- 删除：`backend/src/main/java/com/devsync/entity/PingCodeConfig.java`
- 删除：`backend/src/main/java/com/devsync/entity/PingCodeWorkItem.java`
- 删除：`backend/src/main/java/com/devsync/mapper/PingCodeConfigMapper.java`
- 删除：`backend/src/main/java/com/devsync/mapper/PingCodeWorkItemMapper.java`
- 删除：`backend/src/main/java/com/devsync/dto/req/PingCode*.java`
- 删除：`backend/src/main/java/com/devsync/dto/rsp/PingCode*.java`
- 删除：`frontend/src/pages/PingCode.tsx`
- 删除：`frontend/src/components/pingcode/*`
- 删除：`frontend/src/api/pingcode.ts`
- 修改：`frontend/src/App.tsx`
- 修改：`frontend/src/components/Layout.tsx`
- 修改：`frontend/src/pages/Settings.tsx`

**步骤 1: 编写失败的测试**

```bash
# 使用编译检查替代：清理前应仍能编译
```

**步骤 2: 运行测试以验证其失败**

运行：`mvn -q -f backend/pom.xml -DskipTests compile`
预期：编译失败，仍引用 PingCode 类型。

**步骤 3: 编写最小实现**

1) 删除 PingCode 相关类与 DTO。
2) 替换引用为 Requirement 或移除引用。
3) 移除前端 /pingcode 路由与导航入口。

**步骤 4: 运行测试以验证其通过**

运行：`mvn -q -f backend/pom.xml -DskipTests compile`
预期：编译通过。

**步骤 5: 提交**

```bash
git add backend/src/main/java/com/devsync \
  frontend/src/pages/PingCode.tsx \
  frontend/src/components/pingcode \
  frontend/src/api/pingcode.ts \
  frontend/src/App.tsx \
  frontend/src/components/Layout.tsx \
  frontend/src/pages/Settings.tsx

git commit -m "chore: 移除 PingCode 相关功能"
```

---

## 验证清单

1. 迭代页：展开/折叠需求列表，新增/编辑/删除正常。
2. 需求链接：有链接时可在新标签页打开。
3. SQL 管理页：关联需求成功，需求列表能显示 SQL/提交关联数量。
4. 仪表盘：需求统计与迭代统计显示正确。
5. PingCode 路由与菜单已移除。

---

计划完成并保存到 `docs/plans/2026-02-05-requirement-manual-entry.md`。有两种执行选项：

1. 子代理驱动（本会话） - 我为每个任务分派新的子代理，在任务之间进行审查，快速迭代
2. 并行会话（单独） - 打开新的会话以执行计划，批量执行并设置检查点

选择哪种方法？
