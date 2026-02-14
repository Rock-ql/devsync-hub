[根目录](../CLAUDE.md) > **src (前端)**

# 前端模块 (src/)

## 模块职责

基于 React 19 + TypeScript 构建的桌面应用前端层，负责 UI 展示、用户交互和数据请求。通过 Tauri IPC (`invoke`) 调用后端 Rust 命令，使用 TanStack Query 管理服务端状态。

---

## 入口与启动

- **入口文件**：`src/main.tsx` -- 创建 React 根节点，配置 QueryClient、HashRouter
- **路由配置**：`src/App.tsx` -- 定义 6 个一级路由，嵌套在 Layout 组件内
- **全局布局**：`src/components/Layout.tsx` -- 侧边栏导航、暗色模式切换、SSE 事件监听（GitLab 同步进度通知）

### 路由表

| 路径 | 页面组件 | 功能 |
|------|----------|------|
| `/` | `Dashboard.tsx` | 仪表盘（项目统计、提交趋势、待办汇总） |
| `/projects` | `Projects.tsx` | 项目管理（CRUD、GitLab 配置、提交同步） |
| `/iterations` | `Iterations.tsx` | 迭代管理（关联项目、状态流转） |
| `/sql` | `SqlManagement.tsx` | SQL 变更管理（多环境执行追踪） |
| `/reports` | `Reports.tsx` | 日报/周报（AI 生成、月历视图、编辑） |
| `/settings` | `Settings.tsx` | 系统设置（API 配置、数据导入导出） |

---

## 对外接口

### API 层 (`src/api/`)

前端不使用 REST API，所有数据请求通过 Tauri IPC 完成：

| 文件 | 职责 | 主要方法 |
|------|------|----------|
| `index.ts` | 基础封装 | `invoke()`, `PageResult<T>`, `PageReq` |
| `project.ts` | 项目接口 | `list`, `listAll`, `detail`, `add`, `update`, `delete`, `syncCommits`, `getCommits`, `listBranches` |
| `iteration.ts` | 迭代接口 | `list`, `listByProject`, `detail`, `add`, `update`, `delete`, `updateStatus` |
| `requirement.ts` | 需求接口 | `list`, `listPage`, `listCommits`, `add`, `update`, `updateStatus`, `remove`, `link`, `linked` |
| `sql.ts` | SQL 管理接口 | `list`, `detail`, `add`, `update`, `delete`, `execute`, `batchExecute`, `batchDelete`, `revokeExecution` + 环境配置 CRUD |
| `report.ts` | 报告接口 | `list`, `detail`, `generate`, `update`, `delete`, `monthSummary` |
| `dashboard.ts` | 仪表盘接口 | `overview` |
| `setting.ts` | 设置接口 | `getAll`, `update`, `batchUpdate`, `createApiKey`, `listApiKeys`, `deleteApiKey`, `importData`, `exportData` |

---

## 关键依赖与配置

### 核心依赖

| 依赖 | 用途 |
|------|------|
| `@tauri-apps/api` | Tauri IPC 调用 |
| `@tanstack/react-query` | 服务端状态管理 |
| `react-router-dom` v7 | 客户端路由 (HashRouter) |
| `@radix-ui/*` | 无障碍 UI 原语 (Dialog, Select, Tabs, Toast 等) |
| `tailwindcss` + `tailwindcss-animate` | 样式方案 |
| `lucide-react` | 图标库 |
| `react-markdown` | Markdown 渲染（报告内容展示） |
| `framer-motion` | 动画 |
| `date-fns` | 日期处理 |

### 配置文件

| 文件 | 说明 |
|------|------|
| `vite.config.ts` | Vite 构建配置，开发端口 1420，路径别名 `@` -> `./src` |
| `vitest.config.ts` | 测试配置，jsdom 环境 |
| `tsconfig.json` | TypeScript 配置，ES2020 目标，严格模式 |
| `tailwind.config.js` | TailwindCSS 配置，CSS 变量主题，暗色模式 `class` 策略 |
| `postcss.config.js` | PostCSS 插件链 |

---

## 数据模型

前端 TypeScript 接口定义在各 `api/*.ts` 文件中，与后端 Rust 模型一一对应。关键类型：

- `Project` / `ProjectDetail` -- 项目（含 GitLab 配置）
- `Iteration` / `IterationDetail` -- 迭代（含关联项目和需求/SQL 统计）
- `RequirementItem` -- 需求（含关联项目、提交数、SQL 数）
- `PendingSql` / `PendingSqlDetail` -- 待执行 SQL（含环境执行状态）
- `Report` / `ReportBrief` / `MonthSummary` -- 报告
- `DashboardOverview` -- 仪表盘聚合数据
- `GitCommit` -- Git 提交记录
- `SystemSetting`, `ApiKeyItem` -- 系统配置

---

## 测试与质量

### 测试基础设施

- **框架**：Vitest + jsdom + React Testing Library + MSW (Mock Service Worker)
- **配置**：`vitest.config.ts`
- **Setup**：`src/test/setup.ts`
- **当前状态**：测试基础设施已就绪，但暂无实际测试文件（`*.test.ts` / `*.spec.tsx`）

### Lint

- ESLint (`@typescript-eslint`) 配置就绪
- 命令：`npm run lint`

---

## 常见问题 (FAQ)

**Q: 前端如何与后端通信？**
A: 通过 `@tauri-apps/api/core` 的 `invoke()` 函数，直接调用 Rust 端的 `#[tauri::command]` 函数，无需 HTTP 请求。

**Q: SSE 连接如何工作？**
A: 前端通过 `useSSE` Hook 连接 `http://127.0.0.1:3721/events`，后端 Axum 网关通过 broadcast channel 推送事件。目前用于 GitLab 同步进度通知。

**Q: 如何新增一个页面？**
A: 1) 在 `src/pages/` 创建页面组件 2) 在 `src/App.tsx` 添加 Route 3) 在 `src/components/Layout.tsx` 的 `navigation` 数组添加导航项 4) 在 `src/api/` 添加对应 API 调用。

---

## 相关文件清单

```
src/
  main.tsx                          # 应用入口
  App.tsx                           # 路由配置
  index.css                         # 全局样式（CSS 变量主题）
  lib/utils.ts                      # 工具函数（cn 类名合并）
  api/
    index.ts                        # IPC 封装 + 通用类型
    project.ts                      # 项目 API
    iteration.ts                    # 迭代 API
    requirement.ts                  # 需求 API
    sql.ts                          # SQL API
    report.ts                       # 报告 API
    dashboard.ts                    # 仪表盘 API
    setting.ts                      # 设置 API
  pages/
    Dashboard.tsx                   # 仪表盘页面
    Projects.tsx                    # 项目管理页面
    Iterations.tsx                  # 迭代管理页面
    SqlManagement.tsx               # SQL 管理页面
    Reports.tsx                     # 日报周报页面
    Settings.tsx                    # 系统设置页面
  components/
    Layout.tsx                      # 全局布局（侧边栏 + SSE 监听）
    ui/                             # 基础 UI 组件 (badge, button, card, dialog, input, label, select, sheet, tabs, textarea, toast, toaster, spinner, section-label)
    requirement/                    # 需求相关组件 (RequirementDialog, RequirementLinkDialog, RequirementList, RequirementCommitsDialog)
    sql/                            # SQL 相关组件 (AddEnvDialog, EnvExecutionButtons, ExecuteConfirmDialog, SqlEnvConfigDialog)
  hooks/
    useSSE.ts                       # SSE 事件订阅 Hook
    useUnsavedWarning.ts            # 未保存变更警告 Hook
  test/
    setup.ts                        # 测试环境初始化
```

---

## 变更记录 (Changelog)

| 时间 | 操作 | 说明 |
|------|------|------|
| 2026-02-14 15:08:46 | 首次生成 | init-architect 模块扫描 |
