# GitLab 默认分支动态下拉实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 新增/编辑项目时，根据 GitLab Token + 仓库地址动态拉取分支列表，并以下拉形式选择默认分支。

**架构：** 后端新增分支列表查询接口，封装 GitLab API 调用并转换为轻量响应；前端表单根据输入触发分支拉取并展示下拉列表、加载与错误提示，保证可用性与一致性。

**技术栈：** Spring Boot、OkHttp、MyBatis-Plus；React、TypeScript、Vite、Tailwind、TanStack Query。

---

**说明：**
- 当前项目暂无自动化测试框架，验证以接口手测 + 前端表单手工验证为准。
- 不自动提交，计划中的提交命令由执行者手动运行。
- 技能引用：@writing-plans

### 任务 1: 新增 GitLab 分支查询 DTO 与客户端方法

**文件：**
- 创建：`backend/src/main/java/com/devsync/dto/req/GitLabBranchReq.java`
- 创建：`backend/src/main/java/com/devsync/dto/rsp/GitLabBranchRsp.java`
- 修改：`backend/src/main/java/com/devsync/client/GitLabClient.java`

**步骤 1: 新增请求/响应 DTO**

```java
@Data
@Schema(description = "GitLab 分支查询请求")
public class GitLabBranchReq {
    @NotBlank(message = "GitLab 地址不能为空")
    private String gitlabUrl;
    @NotBlank(message = "GitLab Token不能为空")
    private String gitlabToken;
    private Integer gitlabProjectId;
}

@Data
@Schema(description = "GitLab 分支响应")
public class GitLabBranchRsp {
    @Schema(description = "分支名称")
    private String name;
}
```

**步骤 2: GitLabClient 增加分支列表查询**

```java
public List<String> listBranches(String gitlabUrl, String token, Integer projectId) {
    String apiBaseUrl = parseApiBaseUrl(gitlabUrl);
    String projectIdentifier = resolveProjectIdentifier(gitlabUrl, projectId);
    String apiUrl = String.format("%s/api/v4/projects/%s/repository/branches?per_page=100",
            apiBaseUrl, projectIdentifier);
    // 发送请求并解析 JSON，返回分支 name 列表
}

private String resolveProjectIdentifier(String gitlabUrl, Integer projectId) {
    if (projectId != null) {
        return projectId.toString();
    }
    String projectPath = parseProjectPath(gitlabUrl);
    return URLEncoder.encode(projectPath, StandardCharsets.UTF_8);
}
```

**步骤 3: 编译校验**

运行：`mvn -q -pl backend -am test`
预期：编译通过（无测试则跳过）。

### 任务 2: 项目服务与控制器新增分支查询接口

**文件：**
- 修改：`backend/src/main/java/com/devsync/service/IProjectService.java`
- 修改：`backend/src/main/java/com/devsync/service/impl/ProjectServiceImpl.java`
- 修改：`backend/src/main/java/com/devsync/controller/ProjectController.java`

**步骤 1: 新增服务接口**

```java
List<GitLabBranchRsp> listGitlabBranches(GitLabBranchReq req);
```

**步骤 2: 实现服务逻辑并记录异常参数**

```java
public List<GitLabBranchRsp> listGitlabBranches(GitLabBranchReq req) {
    String token = encryptUtil.decrypt(req.getGitlabToken());
    List<String> branches = gitLabClient.listBranches(req.getGitlabUrl(), token, req.getGitlabProjectId());
    return branches.stream().map(name -> {
        GitLabBranchRsp rsp = new GitLabBranchRsp();
        rsp.setName(name);
        return rsp;
    }).collect(Collectors.toList());
}
```

**步骤 3: 新增控制器接口**

```java
@PostMapping("/branches")
public Result<List<GitLabBranchRsp>> listBranches(@Valid @RequestBody GitLabBranchReq req) {
    return Result.success(projectService.listGitlabBranches(req));
}
```

**步骤 4: 接口手工验证**

运行：
```bash
curl -X POST http://localhost:8080/api/project/branches \
  -H 'Content-Type: application/json' \
  -d '{"gitlabUrl":"","gitlabToken":""}'
```
预期：返回 400 参数校验错误。

### 任务 3: 前端项目表单接入分支下拉

**文件：**
- 修改：`frontend/src/pages/Projects.tsx`

**步骤 1: 增加分支查询与状态**

```ts
const branchQuery = useQuery({
  queryKey: ['gitlab-branches', formData.gitlabUrl, formData.gitlabToken, formData.gitlabProjectId],
  queryFn: () => api.post('/project/branches', {
    gitlabUrl: formData.gitlabUrl,
    gitlabToken: formData.gitlabToken,
    gitlabProjectId: formData.gitlabProjectId ? Number(formData.gitlabProjectId) : undefined,
  }),
  enabled: !!formData.gitlabUrl && !!formData.gitlabToken,
})
```

**步骤 2: 默认分支改为 Select**

```tsx
<Select value={formData.gitlabBranch} onChange={(e) => setFormData({ ...formData, gitlabBranch: e.target.value })}>
  {branchQuery.data?.length ? branchQuery.data.map((item) => (
    <option key={item.name} value={item.name}>{item.name}</option>
  )) : <option value="main">main</option>}
</Select>
```

**步骤 3: 手工 UI 验证**

检查：填写 GitLab 地址 + Token 后，下拉分支可加载；未填写时提示/回退为 `main`。

### 任务 4: 总体验证与提交准备

**文件：**
- 修改：`README.md`（若需补充接口说明，按需添加）

**步骤 1: 前后端联调验证**

运行：`npm --prefix frontend run build`
预期：前端构建通过，项目表单可正常保存与选择分支。

**步骤 2: 手动提交（可选）**

```bash
git add backend/src/main/java/com/devsync/client/GitLabClient.java \
  backend/src/main/java/com/devsync/controller/ProjectController.java \
  backend/src/main/java/com/devsync/dto/req/GitLabBranchReq.java \
  backend/src/main/java/com/devsync/dto/rsp/GitLabBranchRsp.java \
  backend/src/main/java/com/devsync/service/IProjectService.java \
  backend/src/main/java/com/devsync/service/impl/ProjectServiceImpl.java \
  frontend/src/pages/Projects.tsx \
  docs/plans/2026-01-22-gitlab-branch-dropdown.md
git commit -m "feat: gitlab 分支下拉查询"
```
