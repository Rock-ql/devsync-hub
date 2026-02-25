# 迭代管理字段布局重构 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 将迭代管理页面的字段展示由表格重构为卡片化布局，使迭代名称、状态、时间范围、待执行 SQL 等关键信息在视觉上清晰排列，贴近设计稿。

**架构：** 新增 `IterationCard` 组件承载单个迭代的标题区、指标区与需求列表折叠区；`src/pages/Iterations.tsx` 负责数据查询和状态管理，并以响应式列表渲染 `IterationCard`，彻底移除桌面表格/移动卡片的分支逻辑。

**技术栈：** React 19、TypeScript、TailwindCSS、Radix UI Select、项目现有 UI 组件库。

---

### 任务 1: 构建迭代卡片组件骨架

**文件：**
- 创建：`src/components/iteration/IterationCard.tsx`

**步骤 1: 定义属性与辅助常量**

```tsx
export interface IterationCardProps {
  iteration: IterationDetail
  projects: Project[]
  isExpanded: boolean
  onToggleRequirements: () => void
  onStatusChange: (status: string) => void
  onEdit: () => void
  onDelete: () => void
}

const STATUS_LABEL: Record<string, string> = { planning: '规划中', ... }
```

确保导入 `RequirementList`, `Badge`, `Button`, `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`, `SelectValue`, `ChevronDown`, `ChevronRight`, `Pencil`, `Trash2` 等依赖。

**步骤 2: 布局标题区与操作**

```tsx
<Card className="rounded-2xl border border-border/60 shadow-sm">
  <div className="flex flex-col gap-4 border-b border-border/60 p-6 md:flex-row md:items-center md:justify-between">
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{iteration.code || iteration.id}</p>
      <h2 className="text-xl font-semibold">{iteration.name}</h2>
      <p className="text-sm text-muted-foreground">{formatProjects(iteration.project_names)}</p>
    </div>
    <div className="flex items-center gap-2">
      <Button ... onClick={onEdit}><Pencil /></Button>
      <Button ... onClick={onDelete}><Trash2 /></Button>
    </div>
  </div>
```

标题区右侧保留操作按钮，左侧显示迭代名称、关联项目、描述（可选）。

**步骤 3: 指标栅格和状态控件**

```tsx
<div className="grid gap-4 p-6 md:grid-cols-4">
  <div className="space-y-1">
    <span className="text-xs text-muted-foreground">状态</span>
    <Select value={iteration.status} onValueChange={onStatusChange}>
      <SelectTrigger size="lg" className="justify-between">
        <SelectValue placeholder="选择状态" />
      </SelectTrigger>
      ...
    </Select>
  </div>
  <StatBlock label="时间范围" value={formatRange(iteration.start_date, iteration.end_date)} />
  <StatBlock label="待执行 SQL" tone={iteration.pending_sql_count ? 'warning' : 'success'} value={`${iteration.pending_sql_count} 条`} />
  <div className="space-y-1">
    <span className="text-xs text-muted-foreground">关联需求</span>
    <Button variant="outline" onClick={onToggleRequirements} className="w-full justify-between">
      {iteration.requirement_count || 0} 条
      {isExpanded ? <ChevronDown /> : <ChevronRight />}
    </Button>
  </div>
</div>
```

所有标签采用统一的小标题 + 值的垂直排列，确保匹配设计稿中“时间范围 / 待执行 SQL”列的视觉节奏。

**步骤 4: 嵌入需求列表折叠区**

```tsx
{isExpanded ? (
  <div className="border-t border-border/60 bg-muted/30 p-6">
    <RequirementList iterationId={iteration.id} iterationName={iteration.name} projects={projects} />
  </div>
) : null}
```

折叠区背景变浅，和 screenshot 中下半部分区域一致。

### 任务 2: 在迭代页面接入卡片组件

**文件：**
- 修改：`src/pages/Iterations.tsx`

**步骤 1: 清理遗留布局结构**

删除桌面表格 (`<table>...</table>`) 和 `lg:hidden` 移动卡片，保留页面头部和对话框；确保 `expandedIterations`、`handleEdit`、`displayIterationProjects` 根据需要迁移/合并到组件层。

**步骤 2: 渲染 IterationCard 列表**

```tsx
import IterationCard from '@/components/iteration/IterationCard'

...
<div className="space-y-4">
  {iterations?.records?.length ? (
    iterations.records.map((iteration) => (
      <IterationCard
        key={iteration.id}
        iteration={iteration}
        projects={projects || []}
        isExpanded={expandedIterations.includes(iteration.id)}
        onToggleRequirements={() => toggleRequirement(iteration.id)}
        onStatusChange={(status) => statusMutation.mutate({ id: iteration.id, status })}
        onEdit={() => handleEdit(iteration)}
        onDelete={() => { if (confirmDeleteIteration(iteration)) deleteMutation.mutate(iteration.id) }}
      />
    ))
  ) : (
    <Card>...</Card>
  )}
</div>
```

维持 `confirmDeleteIteration` 与模态逻辑，`displayIterationProjects` 若仅供卡片使用可内联至新组件。

**步骤 3: 调整样式常量与辅助函数**

将 `statusStyles`, `statusTones`, `statusLabels` 简化为 `IterationCard` 内部使用的数据；`Iterations.tsx` 仅保留 Mutation 逻辑与 `expandedIterations` 状态，确保单一职责。

### 任务 3: 校验与手动检查

**文件：**
- `src/pages/Iterations.tsx`
- `src/components/iteration/IterationCard.tsx`

**步骤 1: 静态检查**

```bash
npm run lint -- src/pages/Iterations.tsx src/components/iteration/IterationCard.tsx
```

预期：ESLint/TS 均通过。

**步骤 2: 手动交互验证**

1. 运行 `npm run dev`，打开迭代管理页面。
2. 确认每个迭代以卡片形式呈现，状态、时间范围、SQL 统计与需求折叠按钮视觉上分列。
3. 切换状态、展开需求、执行编辑/删除确认流程，观察交互无回归。

---

计划完成并保存到 `docs/plans/2026-02-25-iteration-layout-refactor.md`。有两种执行选项：

1. 子代理驱动（本会话） — 我为每个任务分派新的子代理，在任务之间进行审查，快速迭代
2. 并行会话（单独） — 打开新的会话以执行计划，批量执行并设置检查点

选择哪种方法？
