# DevSync Hub

> 专为开发团队打造的跨平台项目进度管理桌面客户端，基于 Tauri 2 构建。数据本地存储，无需服务器，开箱即用。

**当前版本：v2.0.13** | macOS · Windows · Linux

---

## 核心功能

### 仪表盘
打开应用即可看到全局概览：活跃项目数、进行中迭代、待执行 SQL、近期提交趋势，以及各项目的最新状态汇总。

### 项目管理
- 创建项目并关联 GitLab 仓库（支持多分支）
- 一键同步 GitLab 提交记录，自动按作者邮箱过滤
- 项目详情侧边栏：查看关联迭代、待执行 SQL、提交历史

### 迭代管理
- 创建迭代周期，关联一个或多个项目
- 四阶段状态流转：**规划中 → 开发中 → 测试中 → 已上线**
- 迭代详情展示关联需求数、SQL 数、提交数

### 需求管理
- 录入需求并关联迭代和项目
- 支持需求编号（如 `ABC-123`），提交同步时自动匹配关联
- 30 分钟内无编号提交按时间邻近自动关联
- 查看每条需求下的关联提交和 SQL 变更

### SQL 变更管理
- 登记待执行 SQL，关联项目和迭代
- 自定义多环境配置（如：开发、测试、预发、生产）
- 按环境标记执行状态，支持批量操作和执行撤回
- 执行日志记录操作人和时间

### AI 日报 / 周报
- 选择日期范围，自动汇总该时段的 GitLab 提交
- 按需求维度归类提交，生成结构化工作内容
- 接入 DeepSeek API 进行 AI 润色，生成专业报告
- 月历视图浏览历史报告，支持编辑和 Markdown 渲染
- 支持自定义报告模板

### 系统设置
- 配置 DeepSeek API Key 和服务地址
- 配置全局 GitLab Token（项目级 Token 可覆盖）
- 设置 Git 作者邮箱过滤提交
- 数据导入导出（JSON 格式备份）
- 应用更新检查

---

## 快速上手

### 第一步：下载安装

从 [GitHub Releases](https://github.com/Rock-ql/devsync-hub/releases/latest) 下载对应平台的安装包：

| 平台 | 安装包格式 |
|------|-----------|
| macOS | `.dmg` |
| Windows | `.msi` / `.exe` |
| Linux | `.AppImage` / `.deb` |

### 第二步：初始配置

首次启动后进入**设置**页面完成基础配置：

| 配置项 | 说明 | 是否必填 |
|--------|------|---------|
| Git 作者邮箱 | 过滤 GitLab 提交，只显示自己的提交 | 推荐填写 |
| 全局 GitLab Token | 访问 GitLab 仓库，需 `read_api` 权限 | 使用 GitLab 功能时必填 |
| DeepSeek API Key | AI 日报/周报生成 | 使用 AI 功能时必填 |
| DeepSeek API URL | 默认 `https://api.deepseek.com` | 可选 |

### 第三步：创建第一个项目

1. 进入**项目管理**，点击右上角「新增项目」
2. 填写项目名称，配置 GitLab 信息：
   - GitLab 仓库地址（如 `https://gitlab.com`）
   - Access Token（项目级或全局均可）
   - GitLab 项目 ID
   - 默认同步分支
3. 保存后点击「同步提交」，拉取历史提交记录

### 第四步：创建迭代

1. 进入**迭代管理**，点击「新增迭代」
2. 填写迭代名称、时间范围，选择关联项目
3. 根据进度点击状态按钮推进迭代阶段

### 第五步：生成日报

1. 进入**日报周报**，点击「生成报告」
2. 选择「日报」类型和日期
3. 系统自动汇总当日 GitLab 提交，按需求归类
4. 点击「AI 润色」调用 DeepSeek 生成专业报告
5. 支持手动编辑后保存

---

## 使用流程详解

### SQL 变更追踪

```
新增 SQL → 选择项目/迭代 → 填写标题和 SQL 内容
         → 配置环境（开发/测试/预发/生产）
         → 执行后点击对应环境标记已执行
         → 查看执行日志
```

### 需求与提交自动关联

提交信息中包含需求编号时自动关联：

```
git commit -m "feat: 用户登录优化 [ABC-123]"
           ↓ 同步后自动关联到需求 ABC-123
```

无编号提交按时间邻近（30 分钟内）自动匹配最近的需求。

### 周报生成逻辑

- 优先从当周已有日报聚合内容
- 无日报时回退到直接汇总 Git 提交
- 支持手动编辑调整

---

## 数据存储

所有数据存储在本地 SQLite 数据库，无需网络连接（GitLab 同步和 AI 生成除外）：

| 平台 | 数据库路径 |
|------|-----------|
| macOS | `~/Library/Application Support/devsync-hub/devsync.db` |
| Windows | `%APPDATA%/devsync-hub/devsync.db` |
| Linux | `~/.local/share/devsync-hub/devsync.db` |

### 数据备份与迁移

**导出备份**：设置 → 数据管理 → 导出数据，生成 JSON 文件

**导入恢复**：设置 → 数据管理 → 选择 JSON 文件导入

**从 Web 版迁移**（PostgreSQL → 桌面版）：

```bash
# 1. 安装依赖
npm install pg

# 2. 从 PostgreSQL 导出
node scripts/export-pg-data.js \
  --host=localhost --port=5432 \
  --db=devsync --user=postgres --password=your_password

# 3. 在客户端导入：设置 → 数据管理 → 选择导出的 JSON 文件
```

---

## 自动更新

- 应用启动时自动静默检查更新
- 也可在**设置 → 基础设置 → 应用更新**手动检查
- 下载安装后重启应用生效

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 桌面框架 | Tauri 2 |
| 后端 | Rust (rusqlite + reqwest + axum) |
| 前端 | React 19 + TypeScript + TailwindCSS |
| 状态管理 | TanStack Query v5 |
| 数据库 | SQLite (本地存储) |
| AI 集成 | DeepSeek API |

---

## 本地开发

### 环境要求

- [Node.js](https://nodejs.org/) >= 18
- [Rust](https://www.rust-lang.org/tools/install) >= 1.75
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/) 2.x

```bash
# 安装依赖
npm install

# 开发模式（前后端同时启动，支持热更新）
cargo tauri dev

# 生产构建（产物在 src-tauri/target/release/bundle/）
cargo tauri build

# 运行测试
npm run test
cd src-tauri && cargo test
```

---

## License

MIT
