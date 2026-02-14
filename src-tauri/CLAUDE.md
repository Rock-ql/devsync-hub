[根目录](../CLAUDE.md) > **src-tauri (后端)**

# 后端模块 (src-tauri/)

## 模块职责

基于 Rust 的 Tauri 2 后端进程，负责核心业务逻辑、本地 SQLite 数据库管理、外部 API 集成（GitLab/DeepSeek）和 HTTP SSE 网关。所有前端请求通过 Tauri IPC 命令处理。

---

## 入口与启动

- **主入口**：`src/main.rs` -- 调用 `devsync_hub_lib::run()`
- **应用初始化**：`src/lib.rs` -- 初始化数据库、运行迁移、注册 IPC 命令、启动 Axum 网关
- **辅助二进制**：`src/bin/report_verify.rs` -- 报告生成逻辑验证工具

### 启动流程

```
main.rs -> lib::run()
  1. env_logger::init()
  2. Database::new() -- 打开/创建 SQLite 文件
  3. db.migrate() -- 执行 schema::run_migrations()
  4. tauri::Builder -- 注册 IPC 命令 (40+ 个)
  5. setup() -- 设置窗口图标、启动 Axum 网关 (port 3721)
```

---

## 对外接口

### Tauri IPC 命令 (src/commands/)

| 模块 | 命令 |
|------|------|
| `project_cmd` | `list_projects`, `list_all_projects`, `get_project_detail`, `add_project`, `update_project`, `delete_project`, `sync_commits`, `get_commits`, `list_gitlab_branches` |
| `iteration_cmd` | `list_iterations`, `list_by_project`, `get_iteration_detail`, `add_iteration`, `update_iteration`, `delete_iteration`, `update_iteration_status` |
| `requirement_cmd` | `list_requirements`, `list_requirements_page`, `list_requirement_commits`, `add_requirement`, `update_requirement`, `update_requirement_status`, `delete_requirement`, `link_requirement`, `get_linked_requirement` |
| `sql_cmd` | `list_sql`, `get_sql_detail`, `add_sql`, `update_sql`, `delete_sql`, `execute_sql`, `batch_execute_sql`, `batch_delete_sql`, `revoke_execution`, `list_sql_env_configs`, `add_sql_env_config`, `update_sql_env_config`, `delete_sql_env_config` |
| `report_cmd` | `list_reports`, `get_report_detail`, `generate_report`, `update_report`, `delete_report`, `get_month_summary` |
| `dashboard_cmd` | `get_overview` |
| `setting_cmd` | `get_all_settings`, `update_setting`, `batch_update_settings`, `create_api_key`, `list_api_keys`, `delete_api_key` |
| `migration_cmd` | `import_data`, `export_data` |

### HTTP 网关 (src/axum_gateway/)

| 端点 | 方法 | 说明 |
|------|------|------|
| `/health` | GET | 健康检查 |
| `/events` | GET (SSE) | Server-Sent Events 推送 (heartbeat + 业务事件) |

---

## 关键依赖与配置

### Cargo 依赖

| 依赖 | 用途 |
|------|------|
| `tauri` 2.x | 桌面应用框架 |
| `rusqlite` (bundled) | SQLite 数据库驱动 |
| `axum` 0.8 | HTTP 网关框架 |
| `reqwest` | HTTP 客户端（GitLab/DeepSeek API） |
| `tokio` (full) | 异步运行时 |
| `serde` + `serde_json` | 序列化/反序列化 |
| `chrono` | 日期时间处理 |
| `thiserror` | 错误类型派生 |
| `sha2`, `base64`, `uuid` | 加密/编码/标识 |
| `tokio-stream`, `futures` | SSE 流处理 |
| `tower-http` (cors) | CORS 中间件 |

### 配置文件

| 文件 | 说明 |
|------|------|
| `Cargo.toml` | Rust 项目配置，crate 类型 staticlib + cdylib + rlib |
| `tauri.conf.json` | Tauri 应用配置：窗口尺寸 1280x800、应用标识 `com.devsync.hub` |
| `capabilities/default.json` | Tauri 权限声明 |

---

## 数据模型

### SQLite 表结构 (14 张表)

| 表名 | 说明 | 主要字段 |
|------|------|----------|
| `project` | 项目 | name, description, gitlab_url, gitlab_token, gitlab_project_id, gitlab_branch |
| `iteration` | 迭代 | project_id, name, status(planning/developing/testing/released), start_date, end_date |
| `iteration_project` | 迭代-项目关联 | iteration_id, project_id |
| `requirement` | 需求 | iteration_id, name, requirement_code, environment, link, status, branch |
| `requirement_project` | 需求-项目关联 | requirement_id, project_id |
| `pending_sql` | 待执行SQL | project_id, iteration_id, title, content, execution_order, status, executed_env |
| `sql_env_config` | SQL环境配置 | project_id, env_code, env_name, sort_order |
| `sql_execution_log` | SQL执行日志 | sql_id, env, executed_at, executor |
| `report` | 报告 | type(daily/weekly), title, content, start_date, end_date, commit_summary |
| `report_template` | 报告模板 | type, name, content, is_default |
| `git_commit` | Git提交记录 | project_id, commit_id, message, author_name, committed_at, branch |
| `system_setting` | 系统配置 | setting_key, setting_value |
| `api_key` | API 密钥 | name, key_hash, key_prefix |
| `work_item_link` | 工作项关联 | work_item_id, link_type(commit/sql), link_id |

### 全局约定

- 所有表包含：`id`, `user_id`, `state`, `created_at`, `updated_at`, `deleted_at`
- 软删除：`state = 0` + `deleted_at = datetime('now','localtime')`
- 查询条件默认：`WHERE state = 1 AND deleted_at IS NULL`

### Rust 模型 (src/models/)

| 文件 | 主要类型 |
|------|----------|
| `project.rs` | `Project`, `ProjectDetailRsp`, `ProjectAddReq`, `ProjectUpdateReq`, `ProjectListReq`, `GitLabBranchReq` |
| `iteration.rs` | `Iteration`, `IterationDetail`, `IterationAddReq`, `IterationUpdateReq`, `IterationListReq` |
| `requirement.rs` | `Requirement`, `RequirementAddReq`, `RequirementUpdateReq`, `RequirementListReq`, `RequirementItem`, `RequirementCommitItem` |
| `pending_sql.rs` | `PendingSql`, `PendingSqlDetail`, `SqlAddReq`, `SqlUpdateReq`, `SqlListReq`, `SqlEnvConfig`, `EnvExecution` |
| `report.rs` | `Report`, `ReportBrief`, `ReportGenerateReq`, `ReportUpdateReq`, `ReportListReq`, `MonthSummaryRsp` |
| `git_commit.rs` | `GitCommit` |
| `system_setting.rs` | `SystemSetting` |
| `api_key.rs` | `ApiKey`, `ApiKeyCreateResult` |
| `common.rs` | `PageResult<T>` |

---

## 业务服务 (src/services/)

| 文件 | 职责 | 关键逻辑 |
|------|------|----------|
| `project_service.rs` | 项目 CRUD + GitLab 同步 | 提交同步（分支遍历）、提交-需求自动关联（编号匹配 + 时间邻近）、GitLab Token 解密（AES-128 兼容） |
| `iteration_service.rs` | 迭代 CRUD + 状态管理 | 迭代关联项目、级联删除 |
| `requirement_service.rs` | 需求 CRUD + 关联 | 需求-项目关联、需求-SQL/提交关联 |
| `sql_service.rs` | SQL CRUD + 执行管理 | 多环境执行追踪、批量操作、执行撤回 |
| `report_service.rs` | 报告生成核心 | 日报：按需求归类 Git 提交；周报：从日报聚合；AI 润色降级为本地格式化 |
| `dashboard_service.rs` | 仪表盘聚合 | 统计项目/迭代/SQL/需求/提交数量，提交趋势，最近活动 |
| `setting_service.rs` | 系统配置管理 | 键值对 CRUD、API Key 管理（SHA-256 哈希存储） |

### 外部 API 客户端 (src/clients/)

| 文件 | 职责 |
|------|------|
| `gitlab_client.rs` | GitLab REST API v4 客户端（分支列表、提交列表），支持项目 ID 和 URL 路径两种标识方式，自动降级重试 |
| `deepseek_client.rs` | DeepSeek Chat API 客户端，包含日报/周报的 System Prompt 和 User Prompt 模板 |

---

## 测试与质量

### 单元测试

`report_service.rs` 包含 `#[cfg(test)] mod tests`：
- `strip_numbered_list_prefix_supports_multiple_digits` -- 列表前缀解析
- `extract_project_name_handles_bracket_and_markdown_titles` -- 项目名提取
- `extract_project_work_from_daily_keeps_indentation_items` -- 日报工作项提取
- `weekly_prepare_works_without_git_commits_when_daily_exists` -- 周报从日报聚合（集成测试）

### 辅助工具

`src/bin/report_verify.rs` -- 命令行工具，导入 JSON 数据到内存 SQLite，验证日报结构化输入和模板生成。

### 运行测试

```bash
cd src-tauri
cargo test
```

---

## 常见问题 (FAQ)

**Q: 如何新增一个 IPC 命令？**
A: 1) 在 `models/*.rs` 定义请求/响应类型 2) 在 `services/*.rs` 实现业务逻辑 3) 在 `commands/*_cmd.rs` 编写 `#[tauri::command]` 函数 4) 在 `lib.rs` 的 `invoke_handler` 宏中注册 5) 在 `commands/mod.rs` 中声明模块。

**Q: 数据库迁移如何管理？**
A: 使用 `CREATE TABLE IF NOT EXISTS` 模式（`db/schema.rs`），每次应用启动自动执行。无版本管理系统，新增字段需用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 模式。

**Q: GitLab Token 加密如何工作？**
A: `project_service.rs` 包含 AES-128-ECB 解密逻辑（兼容旧版 Web 端加密），新版使用明文存储。解密尝试失败后回退到明文处理。

**Q: SSE 事件如何发布？**
A: 调用 `axum_gateway::sse::publish("event_name", "json_data")`，使用全局 `broadcast::Sender` 发布，所有连接的 SSE 客户端会收到。

---

## 相关文件清单

```
src-tauri/
  Cargo.toml                        # 项目依赖配置
  tauri.conf.json                   # Tauri 应用配置
  src/
    main.rs                         # 应用入口
    lib.rs                          # 核心初始化 + IPC 命令注册
    error.rs                        # 统一错误类型 (AppError, AppResult)
    commands/
      mod.rs                        # 命令模块声明
      project_cmd.rs                # 项目相关命令
      iteration_cmd.rs              # 迭代相关命令
      requirement_cmd.rs            # 需求相关命令
      sql_cmd.rs                    # SQL 相关命令
      report_cmd.rs                 # 报告相关命令
      dashboard_cmd.rs              # 仪表盘命令
      setting_cmd.rs                # 设置 + API Key 命令
      migration_cmd.rs              # 数据导入导出命令
    services/
      mod.rs                        # 服务模块声明
      project_service.rs            # 项目服务（含 GitLab 同步、提交关联）
      iteration_service.rs          # 迭代服务
      requirement_service.rs        # 需求服务
      sql_service.rs                # SQL 服务
      report_service.rs             # 报告生成服务（含测试）
      dashboard_service.rs          # 仪表盘聚合服务
      setting_service.rs            # 设置服务
    models/
      mod.rs                        # 模型模块声明
      project.rs                    # 项目模型
      iteration.rs                  # 迭代模型
      requirement.rs                # 需求模型
      pending_sql.rs                # SQL 模型
      report.rs                     # 报告模型
      git_commit.rs                 # Git 提交模型
      system_setting.rs             # 系统设置模型
      api_key.rs                    # API Key 模型
      common.rs                     # 通用类型 (PageResult)
    db/
      mod.rs                        # 数据库初始化 (SQLite 连接 + 路径)
      schema.rs                     # 表结构定义 (14 张表 + 索引)
      migration.rs                  # JSON 数据导入/导出
    clients/
      mod.rs                        # 客户端模块声明
      gitlab_client.rs              # GitLab API 客户端
      deepseek_client.rs            # DeepSeek API 客户端
    axum_gateway/
      mod.rs                        # HTTP 网关初始化 (port 3721, CORS)
      routes.rs                     # 健康检查路由
      sse.rs                        # SSE 事件推送
    bin/
      report_verify.rs              # 报告验证命令行工具
```

---

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-14 15:08:46 | 首次生成 | init-architect 模块扫描 |
