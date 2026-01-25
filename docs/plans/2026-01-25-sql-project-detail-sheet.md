# SQL编辑 + 项目详情页 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 在 SQL 管理中增加可编辑能力（已执行禁用），并将项目详情展示改为右侧 Sheet + Tabs。

**架构：** 复用 Radix Dialog 封装新 Sheet 组件，Projects 通过 Sheet + Tabs 展示概览/提交/迭代/SQL 四个面板；SQL 管理新增编辑态与 /sql/update 提交逻辑并复用现有表单。

**技术栈：** React + React Query + Tailwind + Radix UI。

---

相关技能：@writing-plans

### 任务 1: 新建 Sheet 侧边抽屉组件

**文件：**
- 创建：`frontend/src/components/ui/sheet.tsx`

**步骤 1: 添加 Sheet 组件代码（基于 Dialog）**

```tsx
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetPortal = DialogPrimitive.Portal
const SheetClose = DialogPrimitive.Close

const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName

const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed right-0 top-0 z-50 h-full w-full max-w-[600px] border-l border-border bg-card p-6 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-right data-[state=closed]:slide-out-to-right',
        className
      )}
      {...props}
    >
      {children}
      <SheetClose className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background">
        <X className="h-4 w-4" />
        <span className="sr-only">关闭</span>
      </SheetClose>
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = DialogPrimitive.Content.displayName

const SheetHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-2', className)} {...props} />
)
SheetHeader.displayName = 'SheetHeader'

const SheetFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
)
SheetFooter.displayName = 'SheetFooter'

const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
))
SheetTitle.displayName = DialogPrimitive.Title.displayName

const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
))
SheetDescription.displayName = DialogPrimitive.Description.displayName

export {
  Sheet,
  SheetTrigger,
  SheetPortal,
  SheetClose,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
```

**步骤 2: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 3: 提交**

```bash
git add frontend/src/components/ui/sheet.tsx

git commit -m "feat: add sheet ui component"
```

---

### 任务 2: SQL 管理增加编辑能力

**文件：**
- 修改：`frontend/src/pages/SqlManagement.tsx:1`

**步骤 1: 增加编辑态与更新接口**

```tsx
import { Plus, Check, Trash2, Pencil } from 'lucide-react'

const [editingSql, setEditingSql] = useState<PendingSql | null>(null)

const updateMutation = useMutation({
  mutationFn: (data: { id: number } & typeof formData) =>
    api.post('/sql/update', {
      id: data.id,
      iterationId: data.iterationId ? parseInt(data.iterationId) : undefined,
      title: data.title,
      content: data.content,
      remark: data.remark,
    }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
    setIsModalOpen(false)
    resetForm()
  },
})
```

**步骤 2: 填充编辑表单与提交逻辑**

```tsx
const resetForm = () => {
  setFormData({ projectId: '', iterationId: '', title: '', content: '', remark: '' })
  setEditingSql(null)
}

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault()
  if (editingSql) {
    updateMutation.mutate({ id: editingSql.id, ...formData })
  } else {
    addMutation.mutate(formData)
  }
}

const handleEdit = (sql: PendingSql) => {
  setEditingSql(sql)
  setFormData({
    projectId: sql.projectId.toString(),
    iterationId: sql.iterationId ? sql.iterationId.toString() : '',
    title: sql.title,
    content: sql.content,
    remark: sql.remark || '',
  })
  setIsModalOpen(true)
}
```

**步骤 3: 卡片操作区新增编辑按钮 + Modal 标题/项目选择禁用**

```tsx
<div className="flex items-center gap-2">
  <Button
    variant="ghost"
    size="sm"
    className="h-9 w-9 p-0"
    onClick={() => handleEdit(sql)}
    disabled={sql.status === 'executed'}
    aria-label="编辑 SQL"
  >
    <Pencil className={cn('h-4 w-4', sql.status === 'executed' && 'text-muted-foreground')} />
  </Button>
  {sql.status === 'pending' && (
    <Button variant="secondary" size="sm" onClick={() => handleExecute(sql.id)}>
      <Check className="h-4 w-4" />
      标记已执行
    </Button>
  )}
  ...
</div>

<DialogTitle>{editingSql ? '编辑 SQL' : '新增 SQL'}</DialogTitle>

<Select
  value={formData.projectId}
  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
  required
  disabled={!!editingSql}
>
```

**步骤 4: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 5: 提交**

```bash
git add frontend/src/pages/SqlManagement.tsx

git commit -m "feat: allow editing pending sql"
```

---

### 任务 3: 项目详情改造为 Sheet + Tabs

**文件：**
- 修改：`frontend/src/pages/Projects.tsx:1`

**步骤 1: 引入 Sheet 与 Tabs 组件并新增状态**

```tsx
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArrowLeft } from 'lucide-react'

const [isDetailOpen, setIsDetailOpen] = useState(false)
const [activeTab, setActiveTab] = useState<'overview' | 'commits' | 'iterations' | 'sql'>('overview')
```

**步骤 2: 调整详情查询（提交/迭代/SQL）**

```tsx
const { data: commitsData, isLoading: commitsLoading } = useQuery<GitCommitRecord[]>({
  queryKey: ['project-commits', selectedProject?.id],
  queryFn: () => api.get(`/project/commits/${selectedProject!.id}`),
  enabled: !!selectedProject && isDetailOpen && activeTab === 'commits',
})

const { data: iterationData, isLoading: iterationsLoading } = useQuery<PageResult<Iteration>>({
  queryKey: ['project-iterations', selectedProject?.id],
  queryFn: () => api.post('/iteration/list', {
    pageNum: 1,
    pageSize: 100,
    projectId: selectedProject?.id,
  }),
  enabled: !!selectedProject && isDetailOpen && activeTab === 'iterations',
})

const { data: sqlData, isLoading: sqlLoading } = useQuery<PageResult<PendingSql>>({
  queryKey: ['project-sql', selectedProject?.id],
  queryFn: () => api.post('/sql/list', {
    pageNum: 1,
    pageSize: 100,
    projectId: selectedProject?.id,
  }),
  enabled: !!selectedProject && isDetailOpen && activeTab === 'sql',
})
```

**步骤 3: 卡片点击打开 Sheet 并重置 Tab**

```tsx
const handleViewDetail = (project: Project) => {
  setSelectedProject(project)
  setActiveTab('overview')
  setIsDetailOpen(true)
}
```

**步骤 4: 替换 Dialog 为 Sheet + Tabs 结构**

```tsx
<Sheet open={isDetailOpen} onOpenChange={(open) => {
  setIsDetailOpen(open)
  if (!open) {
    setSelectedProject(null)
  }
}}>
  <SheetContent className="flex h-full flex-col">
    <SheetHeader className="flex flex-row items-center justify-between gap-3">
      <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => setIsDetailOpen(false)}>
        <ArrowLeft className="h-4 w-4" />
      </Button>
      <SheetTitle className="flex-1 truncate">{selectedProject?.name}</SheetTitle>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => selectedProject && handleEdit(selectedProject)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600" onClick={() => selectedProject && deleteMutation.mutate(selectedProject.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </SheetHeader>

    <p className="mt-2 text-sm text-muted-foreground">{selectedProject?.description || '暂无描述'}</p>

    <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as typeof activeTab)} className="mt-6 flex-1">
      <TabsList>
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="commits">Git记录</TabsTrigger>
        <TabsTrigger value="iterations">迭代</TabsTrigger>
        <TabsTrigger value="sql">SQL</TabsTrigger>
      </TabsList>

      <div className="mt-4 max-h-[70vh] overflow-y-auto pr-2">
        <TabsContent value="overview">
          <!-- 基本信息卡片 + GitLab 配置卡片 -->
        </TabsContent>
        <TabsContent value="commits">
          <!-- 复用原提交列表渲染 -->
        </TabsContent>
        <TabsContent value="iterations">
          <!-- 迭代列表（iterationData） -->
        </TabsContent>
        <TabsContent value="sql">
          <!-- SQL 列表（sqlData） -->
        </TabsContent>
      </div>
    </Tabs>
  </SheetContent>
</Sheet>
```

**步骤 5: 概览/列表内容细化**

- 概览：使用 Card 显示创建时间、迭代数、待执行 SQL 数；GitLab 配置展示仓库地址、项目 ID、默认分支、连接状态，并保留“同步提交”按钮。
- Git记录：复用现有提交列表 UI（`commitsData`）。
- 迭代：简单列表展示迭代名称、状态、时间范围、待执行 SQL 数量。
- SQL：简单列表展示 SQL 标题、状态、执行环境/时间（如有）。

**步骤 6: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 7: 提交**

```bash
git add frontend/src/pages/Projects.tsx

git commit -m "feat: project detail sheet with tabs"
```

---

### 任务 4: 手动验证

**文件：**
- 参考：`frontend/src/pages/SqlManagement.tsx`
- 参考：`frontend/src/pages/Projects.tsx`

**步骤 1: SQL 编辑验证**
- 打开 SQL 管理页面，确认待执行 SQL 出现编辑按钮。
- 点击编辑按钮，弹窗标题为“编辑 SQL”，表单正确回填。
- 确认“所属项目”下拉框禁用。
- 保存后列表刷新。
- 已执行 SQL 的编辑按钮不可点击且为灰色态。

**步骤 2: 项目详情 Sheet 验证**
- 点击项目卡片，Sheet 从右侧滑入并默认“概览” Tab。
- 切换 Git记录/迭代/SQL Tab，数据可正常加载。
- 点击遮罩或 ESC 关闭 Sheet。

**步骤 3: 构建验证**

运行：`npm run build`
预期：构建通过。
