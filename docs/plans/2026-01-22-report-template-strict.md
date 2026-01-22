# 日报模板严格遵循改造实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 日报/周报生成优先使用系统设置模板，并按模板要求决定标题、详略、序号、按项目归类等格式。

**架构：** 报告生成在后端完成模板选择与渲染；模板规则从模板文本中解析（关键词或首行标题），提交摘要按规则格式化并替换模板占位符；若未设置系统模板则沿用现有 AI 生成流程。

**技术栈：** Spring Boot、MyBatis-Plus、OkHttp；React、TypeScript、Vite。

---

**说明：**
- 当前项目暂无自动化测试框架，验证以接口手测 + 前端页面验证为准。
- 不自动提交，计划中的提交命令由执行者手动运行。
- 技能引用：@writing-plans

### 任务 1: 后端模板选择与渲染逻辑

**文件：**
- 修改：`backend/src/main/java/com/devsync/service/impl/ReportServiceImpl.java`

**步骤 1: 注入系统设置服务与模板键常量**

```java
private static final String DAILY_TEMPLATE_KEY = "report.template.daily";
private static final String WEEKLY_TEMPLATE_KEY = "report.template.weekly";
private final ISystemSettingService systemSettingService;
```

**步骤 2: 解析模板规则（标题/详略/序号/项目归类）**

```java
private TemplateRule parseTemplateRule(String template) {
    String content = template == null ? "" : template;
    boolean groupByProject = containsAny(content, "按项目", "项目归类", "项目分类", "按项目分类");
    boolean numbered = containsAny(content, "序号", "编号", "按序");
    boolean detailed = containsAny(content, "详细", "明细", "详情");
    boolean brief = containsAny(content, "简要", "概要");
    if (brief) { detailed = false; }
    return new TemplateRule(groupByProject, numbered, detailed);
}
```

**步骤 3: 按规则构建提交摘要**

```java
private String buildCommitSummary(List<GitCommit> commits, TemplateRule rule) {
    if (commits.isEmpty()) { return "暂无提交记录"; }
    Map<Integer, String> projectNames = loadProjectNames(commits);
    if (rule.groupByProject) {
        return renderGrouped(commits, projectNames, rule);
    }
    return renderFlat(commits, rule);
}
```

**步骤 4: 渲染模板并解析标题**

```java
private String renderTemplate(String template, ReportGenerateReq req, String commitsText, String defaultTitle) {
    String content = template;
    content = replaceAll(content, "{{commits}}", commitsText);
    content = replaceAll(content, "{commits}", commitsText);
    content = replaceAll(content, "{date}", req.getStartDate().toString());
    content = replaceAll(content, "{startDate}", req.getStartDate().toString());
    content = replaceAll(content, "{endDate}", req.getEndDate().toString());
    content = replaceAll(content, "{title}", defaultTitle);
    return content;
}

private String resolveTitle(String template, String defaultTitle, ReportGenerateReq req) {
    String resolved = renderTemplate(template, req, "", defaultTitle);
    String firstLine = firstNonEmptyLine(resolved);
    if (firstLine.startsWith("#")) {
        return firstLine.replaceFirst("^#+", "").trim();
    }
    if (firstLine.startsWith("标题:") || firstLine.startsWith("标题：")) {
        return firstLine.substring(3).trim();
    }
    return defaultTitle;
}
```

**步骤 5: 更新生成流程**

```java
String settingTemplate = systemSettingService.getSetting(keyByType(req.getType()));
boolean useSettingTemplate = StrUtil.isNotBlank(settingTemplate);
String templateContent = useSettingTemplate ? settingTemplate : template.getContent();

TemplateRule rule = parseTemplateRule(templateContent);
String commitsText = buildCommitSummary(allCommits, rule);
String defaultTitle = buildDefaultTitle(req);
String title = resolveTitle(templateContent, defaultTitle, req);

String content;
if (useSettingTemplate) {
    content = renderTemplate(templateContent, req, commitsText, defaultTitle);
} else {
    content = deepSeekClient.generateReport(commitsText, templateContent, req.getType());
    if (StrUtil.isBlank(content)) {
        content = renderTemplate(templateContent, req, commitsText, defaultTitle);
    }
}
```

**步骤 6: 手工验证**

运行：手动设置 `report.template.daily` 后生成日报  
预期：标题、详略、序号、项目归类按模板文本指示输出。

### 任务 2: 前端模板提示说明更新

**文件：**
- 修改：`frontend/src/pages/Settings.tsx`

**步骤 1: 更新模板说明文案**

```tsx
<p className="text-xs text-muted-foreground">
  支持变量：{'{commits}'}、{'{date}'}（日报）、{'{startDate}'}/{endDate}（周报）、{'{title}'}
 ；模板包含“按项目/序号/简要/详细”等关键词时将影响生成规则。
</p>
```

**步骤 2: 手工验证**

检查：模板提示文字与规则一致，输入模板后生成报告符合预期。

### 任务 3: 验证与提交准备

**步骤 1: 前后端构建验证（可选）**

运行：
- `npm --prefix frontend run build`
- `mvn -q -pl backend -am test`

预期：构建通过。

**步骤 2: 手动提交（可选）**

```bash
git add backend/src/main/java/com/devsync/service/impl/ReportServiceImpl.java \
  frontend/src/pages/Settings.tsx \
  docs/plans/2026-01-22-report-template-strict.md
git commit -m "feat: 日报模板严格遵循设置"
```
