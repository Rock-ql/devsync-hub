# DevSync Hub

项目进度管理系统，面向开发者的迭代管理工具。

## 功能特性

- **项目管理** - 管理多个项目，支持 GitLab 仓库集成
- **迭代管理** - 跟踪迭代进度，状态流转（规划中→开发中→测试中→已上线）
- **SQL 管理** - 记录待执行 SQL，防止生产环境遗漏
- **日报周报** - 基于 GitLab 提交记录，AI 自动生成工作报告
- **API 接口** - 支持 AI 编程助手调用

## 技术栈

| 层级 | 技术 |
|------|------|
| 后端 | Spring Boot 3.2 + JDK 17 + MyBatis Plus |
| 数据库 | PostgreSQL 15 |
| 缓存 | Redis 7 |
| 前端 | React 18 + Vite + TailwindCSS |
| AI | DeepSeek API |
| 部署 | Docker Compose |

## 快速启动

### 前置条件

- Docker 20.10+
- Docker Compose 2.0+

### 1. 克隆项目

```bash
git clone <repository-url>
cd devSync_hub
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，修改以下配置：

```env
# 数据库密码（必须修改）
POSTGRES_PASSWORD=your_secure_password

# Redis 密码（必须修改）
REDIS_PASSWORD=your_redis_password

# DeepSeek API Key（可选，用于生成日报周报）
DEEPSEEK_API_KEY=sk-your-deepseek-key

# 加密密钥（必须修改，用于加密 GitLab Token）
ENCRYPT_KEY=your-32-char-encrypt-key-here!!
```

### 3. 启动服务

```bash
docker-compose up -d
```

首次启动会自动：
- 创建数据库表结构
- 初始化默认配置
- 构建前后端镜像

### 4. 访问系统

- **Web 界面**: http://localhost
- **API 文档**: http://localhost/api/doc.html

## Docker 常用命令

### 重新构建镜像并启动

```bash
# 重新构建前端
docker-compose up -d --build frontend

# 重新构建后端
docker-compose up -d --build backend

# 重新构建整个项目
docker-compose up -d --build
```

如需强制全量重建（忽略缓存）：

```bash
docker-compose build --no-cache frontend
docker-compose build --no-cache backend
docker-compose build --no-cache
```

### 查看日志

```bash
# 查看全部服务日志
docker-compose logs -f --tail=200

# 查看单个服务日志
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f nginx
docker-compose logs -f postgres
docker-compose logs -f redis
```

### 重启服务

```bash
docker-compose restart backend
docker-compose restart frontend
docker-compose restart nginx
```

## 配置说明

### 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `POSTGRES_PASSWORD` | PostgreSQL 密码 | - |
| `REDIS_PASSWORD` | Redis 密码 | - |
| `DEEPSEEK_API_KEY` | DeepSeek API Key | - |
| `DEEPSEEK_BASE_URL` | DeepSeek API 地址 | https://api.deepseek.com |
| `ENCRYPT_KEY` | 加密密钥（32字符） | - |

### 端口映射

| 服务 | 端口 | 说明 |
|------|------|------|
| Nginx | 80 | Web 入口 |
| Backend | 8080 | 后端 API（内部） |
| PostgreSQL | 5432 | 数据库（内部） |
| Redis | 6379 | 缓存（内部） |

## 使用指南

### 1. 创建项目

1. 进入「项目管理」页面
2. 点击「新增项目」
3. 填写项目名称和描述
4. （可选）配置 GitLab 信息：
   - GitLab 仓库地址
   - Access Token（需要 `read_api` 权限）
   - 项目 ID
   - 默认分支

### 2. 创建迭代

1. 进入「迭代管理」页面
2. 点击「新增迭代」
3. 选择所属项目，填写迭代名称
4. 设置计划时间范围
5. 通过下拉框切换迭代状态

### 3. 记录 SQL

1. 进入「SQL 管理」页面
2. 点击「新增 SQL」
3. 选择项目和迭代
4. 填写 SQL 标题和内容
5. 执行后点击「标记已执行」

### 4. 生成日报周报

1. 进入「日报周报」页面
2. 点击「生成报告」
3. 选择报告类型（日报/周报）
4. 选择日期范围
5. 系统自动汇总 GitLab 提交，AI 生成报告

### 5. API 调用

1. 进入「系统设置」->「API Key 管理」
2. 创建 API Key
3. 在请求头中携带 `X-API-Key`

```bash
curl -X POST http://localhost/api/sql/add \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dsk_your_api_key" \
  -d '{
    "projectId": 1,
    "iterationId": 1,
    "title": "添加索引",
    "content": "CREATE INDEX idx_user_phone ON user(phone);"
  }'
```

详细接口文档见 [docs/api.md](docs/api.md)

## 开发模式

### 后端开发

```bash
cd backend

# 本地运行（需要先启动 PostgreSQL 和 Redis）
./mvnw spring-boot:run -Dspring-boot.run.profiles=local
```

### 前端开发

```bash
cd frontend

# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

前端开发服务器会自动代理 `/api` 请求到后端。

## 常见问题

### Q: 启动失败，提示端口被占用

检查 80、5432、6379 端口是否被占用：

```bash
lsof -i :80
lsof -i :5432
lsof -i :6379
```

### Q: 数据库连接失败

1. 检查 `.env` 中的密码配置
2. 确认 PostgreSQL 容器正常运行：`docker-compose ps`
3. 查看日志：`docker-compose logs postgres`

### Q: 日报生成失败

1. 确认已配置 DeepSeek API Key
2. 检查 GitLab 配置是否正确
3. 确认选择的日期范围内有提交记录

### Q: 如何重置数据库

```bash
# 停止服务
docker-compose down

# 删除数据卷
docker volume rm devsync_hub_postgres_data

# 重新启动
docker-compose up -d
```

## 项目结构

```
devSync_hub/
├── docker-compose.yml      # Docker 编排
├── .env.example            # 环境变量模板i
├── README.md               # 项目说明
├── docs/
│   └── api.md              # API 文档
├── nginx/
│   └── nginx.conf          # Nginx 配置
├── backend/                # 后端项目
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/
└── frontend/               # 前端项目
    ├── Dockerfile
    ├── package.json
    └── src/
```

## License

MIT
