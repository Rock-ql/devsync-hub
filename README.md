# DevSync Hub

跨平台项目进度管理桌面客户端，基于 Tauri 2 构建。集成 GitLab 提交同步、SQL 变更追踪、迭代管理、需求关联和 AI 日报/周报生成。

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 后端 | Rust (rusqlite + reqwest + axum) |
| 前端 | React 19 + TypeScript + TailwindCSS |
| 状态管理 | TanStack Query v5 |
| 数据库 | SQLite (本地存储) |
| AI 集成 | DeepSeek API |

## 功能模块

- **项目管理** — 关联 GitLab 仓库，同步提交记录，多分支支持
- **迭代管理** — 创建迭代周期，关联项目，状态流转
- **需求管理** — 需求录入与状态跟踪，关联 SQL 和提交
- **SQL 管理** — 待执行 SQL 登记，多环境执行状态追踪
- **日报/周报** — 基于 Git 提交自动生成，支持 DeepSeek AI 润色
- **仪表盘** — 项目概览、提交统计、待办汇总
- **数据迁移** — 支持从 Web 版 (PostgreSQL) 导入数据，支持导出备份
- **自动更新** — 启动自动检查更新，设置页支持手动检查与在线更新安装

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.75
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
cargo tauri dev
```

前端热更新在 `http://localhost:1420`，Rust 后端自动编译。

### 生产构建

```bash
cargo tauri build
```

产物位于 `src-tauri/target/release/bundle/`。

## 自动更新与发布

### 客户端更新

1. 应用启动后会自动静默检查更新。
2. 在 **设置 → 基础设置 → 应用更新** 可以手动检查并执行在线更新。
3. 更新安装完成后，需要重启应用以生效。

### 仓库 Secrets（GitHub Actions）

| Secret 名称 | 说明 |
|------|------|
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater 签名私钥 |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | 签名私钥密码 |
| `TAURI_UPDATER_PUBKEY` | 对应公钥（发布时注入到 `tauri.conf.json`） |

### 自动发布流程

1. 每次 `push main` 触发 `.github/workflows/version-bump.yml`
2. 工作流自动执行 `patch + 1`，同步版本到 `package.json`、`package-lock.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
3. 自动提交版本变更并创建 tag（`vX.Y.Z`）
4. 自动触发 `.github/workflows/release.yml` 进行多平台打包与 GitHub Release 发布

## 项目结构

```
devSync_hub/
├── src/                        # 前端源码
│   ├── api/                    # Tauri IPC API 层
│   │   ├── index.ts            # invoke 封装 + PageResult 类型
│   │   ├── project.ts          # 项目 API
│   │   ├── iteration.ts        # 迭代 API
│   │   ├── requirement.ts      # 需求 API
│   │   ├── sql.ts              # SQL API
│   │   ├── report.ts           # 报告 API
│   │   ├── dashboard.ts        # 仪表盘 API
│   │   └── setting.ts          # 设置 + 数据导入导出 API
│   ├── components/             # UI 组件
│   │   ├── ui/                 # 基础 UI 组件 (Radix UI)
│   │   ├── requirement/        # 需求相关组件
│   │   └── sql/                # SQL 相关组件
│   ├── pages/                  # 页面组件
│   │   ├── Dashboard.tsx       # 仪表盘
│   │   ├── Projects.tsx        # 项目管理
│   │   ├── Iterations.tsx      # 迭代管理
│   │   ├── SqlManagement.tsx   # SQL 管理
│   │   ├── Reports.tsx         # 日报周报
│   │   └── Settings.tsx        # 系统设置
│   ├── hooks/                  # 自定义 Hooks
│   ├── App.tsx                 # 路由配置
│   └── main.tsx                # 入口
├── src-tauri/                  # Rust 后端
│   ├── src/
│   │   ├── commands/           # Tauri IPC 命令层
│   │   ├── services/           # 业务逻辑层
│   │   ├── models/             # 数据模型
│   │   ├── db/                 # SQLite 数据库
│   │   │   ├── schema.rs       # 表结构定义 (14 张表)
│   │   │   └── migration.rs    # 数据导入导出
│   │   ├── clients/            # 外部 API 客户端
│   │   │   ├── gitlab_client.rs
│   │   │   └── deepseek_client.rs
│   │   ├── axum_gateway/       # HTTP 网关 (SSE, port 3721)
│   │   ├── error.rs            # 统一错误类型
│   │   └── lib.rs              # 应用入口
│   ├── Cargo.toml
│   └── tauri.conf.json
├── scripts/
│   ├── export-pg-data.js       # PG → JSON 数据导出脚本
│   ├── bump-version.mjs        # 自动 patch 版本递增脚本
│   └── inject-updater-pubkey.mjs # 发布时注入 updater 公钥
├── package.json
└── vite.config.ts
```

## 数据迁移 (Web 版 → 桌面版)

如果你之前使用的是 Web 版 (Spring Boot + PostgreSQL)，可以按以下步骤迁移数据。

### 1. 从 PostgreSQL 导出

```bash
# 安装 pg 驱动
npm install pg

# 执行导出（替换为你的数据库连接信息）
node scripts/export-pg-data.js \
  --host=localhost \
  --port=5432 \
  --db=devsync \
  --user=postgres \
  --password=your_password
```

也可以使用环境变量：

```bash
PG_HOST=localhost PG_PORT=5432 PG_DB=devsync PG_USER=postgres PG_PASSWORD=xxx \
  node scripts/export-pg-data.js
```

导出文件默认为 `devsync-export-YYYY-MM-DD.json`。

### 2. 在桌面客户端导入

1. 打开 DevSync Hub 桌面客户端
2. 进入 **设置 → 数据管理**
3. 点击 **选择 JSON 文件导入**
4. 选择导出的 JSON 文件
5. 导入完成后会显示各表的导入记录数

### 3. 数据备份

在 **设置 → 数据管理 → 导出数据** 可以将当前客户端数据导出为 JSON 文件，用于备份或迁移到其他设备。

## 配置说明

首次启动后，在 **设置** 页面配置：

| 配置项 | 说明 |
|--------|------|
| DeepSeek API URL | AI 服务地址，默认 `https://api.deepseek.com` |
| DeepSeek API Key | 用于 AI 日报/周报生成 |
| Git 作者邮箱 | 过滤提交记录，留空则获取所有人的提交 |
| 全局 GitLab Token | 所有项目共用，项目级 Token 可覆盖 |

## 数据存储

SQLite 数据库存储位置：

| 平台 | 路径 |
|------|------|
| macOS | `~/Library/Application Support/devsync-hub/devsync.db` |
| Windows | `%APPDATA%/devsync-hub/devsync.db` |
| Linux | `~/.local/share/devsync-hub/devsync.db` |

## 使用指南

### 创建项目

1. 进入「项目管理」页面，点击「新增项目」
2. 填写项目名称和描述
3. 配置 GitLab 信息：仓库地址、Access Token（需 `read_api` 权限）、项目 ID、默认分支
4. 点击「同步提交」拉取 GitLab 提交记录

### 创建迭代

1. 进入「迭代管理」页面，点击「新增迭代」
2. 选择关联项目，填写迭代名称和时间范围
3. 通过状态按钮切换：规划中 → 开发中 → 测试中 → 已上线

### 记录 SQL

1. 进入「SQL 管理」页面，点击「新增 SQL」
2. 选择项目和迭代，填写 SQL 标题和内容
3. 执行后标记对应环境的执行状态

### 生成日报/周报

1. 进入「日报周报」页面，点击「生成报告」
2. 选择报告类型和日期范围
3. 系统自动汇总 GitLab 提交，通过 DeepSeek AI 生成报告
4. 支持编辑和自定义模板

## 开发命令

```bash
npm run dev          # 启动前端开发服务器
npm run build        # 构建前端 (tsc + vite build)
npm run test         # 运行测试 (vitest)
cargo tauri dev      # 启动桌面应用 (开发模式)
cargo tauri build    # 构建桌面安装包
```

## License

MIT
