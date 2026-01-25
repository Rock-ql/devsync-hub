# DevSync Hub API 接入文档

> 版本: 1.0 | 更新时间: 2026-01-22

---

## 概述

DevSync Hub 提供 RESTful API 接口，支持 AI 编程助手和其他工具集成。所有接口使用 JSON 格式进行数据交换。

## 基础信息

- **Base URL**: `http://localhost/api` (或您部署的域名)
- **Content-Type**: `application/json`
- **字符编码**: UTF-8

---

## 认证

所有 API 请求需要在 Header 中携带 API Key：

```http
X-API-Key: your-api-key-here
```

### 获取 API Key

1. 登录 DevSync Hub 管理界面
2. 进入「系统设置」->「API Key 管理」
3. 点击「创建」，输入名称后获取 Key
4. **注意**：API Key 只显示一次，请妥善保存

### 认证失败响应

```json
{
  "code": 401,
  "message": "API Key 无效或已过期",
  "data": null
}
```

---

## 响应格式

### 成功响应

```json
{
  "code": 200,
  "message": "success",
  "data": { ... }
}
```

### 分页响应

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [ ... ],
    "total": 100,
    "pageNum": 1,
    "pageSize": 20,
    "pages": 5
  }
}
```

### 错误响应

```json
{
  "code": 400,
  "message": "错误描述",
  "data": null
}
```

---

## 项目管理

### 获取项目列表

```http
POST /project/list
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pageNum | int | 否 | 页码，默认 1 |
| pageSize | int | 否 | 每页数量，默认 20 |
| keyword | string | 否 | 搜索关键词 |

**请求示例**

```json
{
  "pageNum": 1,
  "pageSize": 20,
  "keyword": "商城"
}
```

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "name": "商城后端",
        "description": "电商平台后端服务",
        "gitlabUrl": "https://gitlab.com/user/mall-backend",
        "gitlabProjectId": 12345,
        "gitlabBranch": "main",
        "gitlabConfigured": true,
        "state": 1,
        "iterationCount": 3,
        "pendingSqlCount": 5,
        "createdAt": "2026-01-01T10:00:00"
      }
    ],
    "total": 1,
    "pageNum": 1,
    "pageSize": 20,
    "pages": 1
  }
}
```

### 获取所有项目（简略）

```http
GET /project/all
```

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "id": 1, "name": "商城后端" },
    { "id": 2, "name": "用户中心" }
  ]
}
```

### 获取项目详情

```http
GET /project/detail/{id}
```

### 新增项目

```http
POST /project/add
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | 项目名称 |
| description | string | 否 | 项目描述 |
| gitlabUrl | string | 否 | GitLab 仓库地址 |
| gitlabToken | string | 否 | GitLab Access Token |
| gitlabProjectId | int | 否 | GitLab 项目 ID |
| gitlabBranch | string | 否 | 默认分支，默认 main |

**请求示例**

```json
{
  "name": "商城后端",
  "description": "电商平台后端服务",
  "gitlabUrl": "https://gitlab.com/user/mall-backend",
  "gitlabToken": "glpat-xxxxxxxxxxxx",
  "gitlabProjectId": 12345,
  "gitlabBranch": "main"
}
```

### 更新项目

```http
POST /project/update
```

**请求参数**

同新增，额外包含 `id` 字段。`gitlabToken` 留空表示不修改。

### 删除项目

```http
POST /project/delete/{id}
```

### 同步提交记录

```http
POST /project/sync-commits/{id}
```

从 GitLab 拉取最近 30 天的提交记录。

---

## 迭代管理

### 获取迭代列表

```http
POST /iteration/list
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pageNum | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |
| projectId | int | 否 | 筛选项目 |
| status | string | 否 | 筛选状态 |

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "projectId": 1,
        "projectName": "商城后端",
        "name": "v1.0.0",
        "description": "首个正式版本",
        "status": "developing",
        "statusDesc": "开发中",
        "startDate": "2026-01-01",
        "endDate": "2026-01-31",
        "pendingSqlCount": 3
      }
    ],
    "total": 1,
    "pageNum": 1,
    "pageSize": 20,
    "pages": 1
  }
}
```

### 新增迭代

```http
POST /iteration/add
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | int | 是 | 所属项目 ID |
| name | string | 是 | 迭代名称 |
| description | string | 否 | 描述 |
| status | string | 否 | 状态，默认 planning |
| startDate | string | 否 | 开始日期 YYYY-MM-DD |
| endDate | string | 否 | 结束日期 YYYY-MM-DD |

**状态值**

| 值 | 说明 |
|------|------|
| planning | 规划中 |
| developing | 开发中 |
| testing | 测试中 |
| released | 已上线 |

### 更新迭代

```http
POST /iteration/update
```

### 删除迭代

```http
POST /iteration/delete/{id}
```

### 更新迭代状态

```http
POST /iteration/status/{id}/{status}
```

---

## SQL 管理

### 获取 SQL 列表

```http
POST /sql/list
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pageNum | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |
| projectId | int | 否 | 筛选项目 |
| iterationId | int | 否 | 筛选迭代 |
| status | string | 否 | pending/partial/completed |

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "list": [
      {
        "id": 1,
        "projectId": 1,
        "projectName": "商城后端",
        "iterationId": 1,
        "iterationName": "v1.0.0",
        "title": "添加用户表索引",
        "content": "CREATE INDEX idx_user_phone ON user(phone);",
        "executionOrder": 1,
        "status": "partial",
        "statusDesc": "部分执行",
        "executedAt": "2026-01-20T10:00:00",
        "executedEnv": "dev",
        "executedCount": 2,
        "envTotal": 5,
        "envExecutionList": [
          {
            "envCode": "local",
            "envName": "local",
            "executed": true,
            "executedAt": "2026-01-19T10:00:00",
            "executor": "",
            "remark": ""
          },
          {
            "envCode": "dev",
            "envName": "dev",
            "executed": true,
            "executedAt": "2026-01-20T10:00:00",
            "executor": "",
            "remark": ""
          },
          {
            "envCode": "test",
            "envName": "test",
            "executed": false,
            "executedAt": null,
            "executor": "",
            "remark": ""
          },
          {
            "envCode": "smoke",
            "envName": "smoke",
            "executed": false,
            "executedAt": null,
            "executor": "",
            "remark": ""
          },
          {
            "envCode": "prod",
            "envName": "prod",
            "executed": false,
            "executedAt": null,
            "executor": "",
            "remark": ""
          }
        ],
        "createdAt": "2026-01-15T10:00:00"
      }
    ],
    "total": 1,
    "pageNum": 1,
    "pageSize": 20,
    "pages": 1
  }
}
```

### 新增 SQL

```http
POST /sql/add
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | int | 是 | 所属项目 ID |
| iterationId | int | 是 | 所属迭代 ID |
| title | string | 是 | SQL 标题 |
| content | string | 是 | SQL 内容 |
| executionOrder | int | 否 | 执行顺序 |

**请求示例**

```json
{
  "projectId": 1,
  "iterationId": 1,
  "title": "添加用户表索引",
  "content": "CREATE INDEX idx_user_phone ON user(phone);",
  "executionOrder": 1
}
```

### 更新 SQL

```http
POST /sql/update
```

### 删除 SQL

```http
POST /sql/delete/{id}
```

### 标记已执行

```http
POST /sql/execute
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int | 是 | SQL ID |
| executedEnv | string | 是 | 执行环境，如 local/dev/test/smoke/prod |
| remark | string | 否 | 执行备注 |
| executor | string | 否 | 执行人 |

**请求示例**

```json
{
  "id": 1,
  "executedEnv": "prod",
  "remark": "上线变更",
  "executor": "admin"
}
```

### 批量标记已执行

```http
POST /sql/batch-execute
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| ids | int[] | 是 | SQL ID 列表 |
| executedEnv | string | 是 | 执行环境，如 local/dev/test/smoke/prod |

**请求示例**

```json
{
  "ids": [1, 2, 3],
  "executedEnv": "prod"
}
```

### 撤销执行记录

```http
POST /sql/revoke-execution
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| sqlId | int | 是 | SQL ID |
| env | string | 是 | 环境代码 |

**请求示例**

```json
{
  "sqlId": 1,
  "env": "smoke"
}
```

### 获取项目环境列表

```http
POST /sql/env/list
```

**说明**

环境固定为 local/dev/test/smoke/prod，不支持自定义。

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| projectId | int | 是 | 项目ID |

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "id": 1, "projectId": 1, "envCode": "local", "envName": "local", "sortOrder": 1 },
    { "id": 2, "projectId": 1, "envCode": "dev", "envName": "dev", "sortOrder": 2 },
    { "id": 3, "projectId": 1, "envCode": "test", "envName": "test", "sortOrder": 3 },
    { "id": 4, "projectId": 1, "envCode": "smoke", "envName": "smoke", "sortOrder": 4 },
    { "id": 5, "projectId": 1, "envCode": "prod", "envName": "prod", "sortOrder": 5 }
  ]
}
```


---

## 日报周报

### 生成报告

```http
POST /report/generate
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| type | string | 是 | daily/weekly |
| startDate | string | 是 | 开始日期 YYYY-MM-DD |
| endDate | string | 是 | 结束日期 YYYY-MM-DD |

**请求示例**

```json
{
  "type": "daily",
  "startDate": "2026-01-22",
  "endDate": "2026-01-22"
}
```

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "type": "daily",
    "typeDesc": "日报",
    "title": "2026-01-22 日报",
    "content": "## 今日工作\n\n### 商城后端\n- feat: 添加用户注册接口\n- fix: 修复订单状态更新问题\n\n...",
    "startDate": "2026-01-22",
    "endDate": "2026-01-22",
    "createdAt": "2026-01-22T18:00:00"
  }
}
```

### 获取报告列表

```http
POST /report/list
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| pageNum | int | 否 | 页码 |
| pageSize | int | 否 | 每页数量 |
| type | string | 否 | daily/weekly |

### 获取报告详情

```http
GET /report/detail/{id}
```

### 更新报告

```http
POST /report/update
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | int | 是 | 报告 ID |
| title | string | 否 | 标题 |
| content | string | 否 | Markdown 内容 |

### 删除报告

```http
POST /report/delete/{id}
```

---

## 仪表盘

### 获取概览数据

```http
GET /dashboard/overview
```

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "projectCount": 5,
    "activeProjectCount": 3,
    "iterationCount": 12,
    "activeIterationCount": 4,
    "pendingSqlCount": 8,
    "todayCommitCount": 15,
    "weekCommitCount": 67,
    "recentProjects": [
      {
        "id": 1,
        "name": "商城后端",
        "iterationCount": 3,
        "pendingSqlCount": 5
      }
    ],
    "recentIterations": [
      {
        "id": 1,
        "name": "v1.0.0",
        "projectName": "商城后端",
        "status": "developing",
        "statusDesc": "开发中"
      }
    ],
    "pendingSqlByProject": [
      {
        "projectId": 1,
        "projectName": "商城后端",
        "count": 5
      }
    ]
  }
}
```

---

## 系统设置

### 获取设置

```http
GET /setting/get
```

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "deepseekApiKey": "sk-****",
    "deepseekBaseUrl": "https://api.deepseek.com",
    "dailyReportTemplate": "...",
    "weeklyReportTemplate": "..."
  }
}
```

### 更新设置

```http
POST /setting/update
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| deepseekApiKey | string | 否 | DeepSeek API Key |
| deepseekBaseUrl | string | 否 | DeepSeek API 地址 |
| dailyReportTemplate | string | 否 | 日报模板 |
| weeklyReportTemplate | string | 否 | 周报模板 |

---

## API Key 管理

### 获取 Key 列表

```http
GET /apikey/list
```

### 创建 Key

```http
POST /apikey/create
```

**请求参数**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | 是 | Key 名称 |

**响应示例**

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": 1,
    "name": "AI助手",
    "keyValue": "dsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
  }
}
```

> ⚠️ **注意**：`keyValue` 只在创建时返回一次，请妥善保存

### 删除 Key

```http
POST /apikey/delete/{id}
```

---

## 错误码

| 错误码 | 说明 |
|--------|------|
| 200 | 成功 |
| 400 | 请求参数错误 |
| 401 | 未认证或认证失败 |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 500 | 服务器内部错误 |

---

## 使用示例

### cURL

```bash
# 获取项目列表
curl -X POST http://localhost/api/project/list \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dsk_your_api_key" \
  -d '{"pageNum": 1, "pageSize": 20}'

# 新增 SQL
curl -X POST http://localhost/api/sql/add \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dsk_your_api_key" \
  -d '{
    "projectId": 1,
    "iterationId": 1,
    "title": "添加索引",
    "content": "CREATE INDEX idx_user_phone ON user(phone);"
  }'

# 生成日报
curl -X POST http://localhost/api/report/generate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: dsk_your_api_key" \
  -d '{
    "type": "daily",
    "startDate": "2026-01-22",
    "endDate": "2026-01-22"
  }'
```

### Python

```python
import requests

BASE_URL = "http://localhost/api"
API_KEY = "dsk_your_api_key"

headers = {
    "Content-Type": "application/json",
    "X-API-Key": API_KEY
}

# 新增 SQL
response = requests.post(
    f"{BASE_URL}/sql/add",
    headers=headers,
    json={
        "projectId": 1,
        "iterationId": 1,
        "title": "添加索引",
        "content": "CREATE INDEX idx_user_phone ON user(phone);"
    }
)

print(response.json())
```

### JavaScript

```javascript
const BASE_URL = 'http://localhost/api';
const API_KEY = 'dsk_your_api_key';

// 新增 SQL
fetch(`${BASE_URL}/sql/add`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': API_KEY
  },
  body: JSON.stringify({
    projectId: 1,
    iterationId: 1,
    title: '添加索引',
    content: 'CREATE INDEX idx_user_phone ON user(phone);'
  })
})
.then(res => res.json())
.then(data => console.log(data));
```

---

## 常见问题

### Q: 如何在 AI 编程助手中使用？

配置环境变量或在助手设置中添加 API Key，然后通过 HTTP 请求调用接口。例如在 Cursor 中可以创建自定义命令来调用。

### Q: GitLab Token 需要哪些权限？

需要 `read_api` 和 `read_repository` 权限，用于读取项目信息和提交记录。

### Q: 报告生成失败怎么办？

1. 检查 DeepSeek API Key 是否正确配置
2. 确保选择的日期范围内有提交记录
3. 查看后端日志获取详细错误信息

---

## 更新日志

### v1.0.0 (2026-01-22)

- 首个正式版本
- 支持项目管理、迭代管理、SQL 管理
- 支持 GitLab 集成
- 支持 AI 生成日报周报
- 支持 API Key 认证
