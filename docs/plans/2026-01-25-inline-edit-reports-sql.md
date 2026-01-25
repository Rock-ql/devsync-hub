# 日报与SQL管理行内编辑 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 将日报详情与 SQL 管理的编辑由弹窗改为行内编辑，并加入未保存提醒。

**架构：** 新增 `useUnsavedWarning` Hook 统一处理页面离开与切换目标时的未保存确认；Reports 详情区通过 `isEditing` 切换查看/编辑 UI；SQL 卡片通过 `editingId` 控制行内表单，仅保留新增 SQL 的 Dialog。

**技术栈：** React + React Query + Tailwind。

---

相关技能：@writing-plans

### 任务 1: 新增未保存提醒 Hook

**文件：**
- 创建：`frontend/src/hooks/useUnsavedWarning.ts`
- 修改：无

**步骤 1: 新建 Hook 文件**

```ts
import { useCallback, useEffect } from 'react'

export function useUnsavedWarning(
  hasUnsavedChanges: boolean,
  message = '有未保存的修改，确定要离开吗？'
) {
  useEffect(() => {
    if (!hasUnsavedChanges) {
      return
    }
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  const confirmLeave = useCallback(() => {
    if (!hasUnsavedChanges) {
      return true
    }
    return window.confirm(message)
  }, [hasUnsavedChanges, message])

  return { confirmLeave }
}
```

**步骤 2: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 3: 提交**

```bash
git add frontend/src/hooks/useUnsavedWarning.ts

git commit -m "feat: add unsaved changes warning hook"
```

---

### 任务 2: Reports 详情区行内编辑

**文件：**
- 修改：`frontend/src/pages/Reports.tsx:1`

**步骤 1: 移除编辑 Dialog 状态并引入 Hook**

```tsx
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'

const [isEditing, setIsEditing] = useState(false)
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
const [editForm, setEditForm] = useState({ title: '', content: '' })

const { confirmLeave } = useUnsavedWarning(hasUnsavedChanges)
```

**步骤 2: 编辑/保存/取消逻辑**

```tsx
const handleStartEdit = () => {
  if (!selectedReport) return
  setEditForm({ title: selectedReport.title, content: selectedReport.content })
  setHasUnsavedChanges(false)
  setIsEditing(true)
}

const handleCancelEdit = () => {
  if (hasUnsavedChanges && !confirmLeave()) return
  setIsEditing(false)
  setHasUnsavedChanges(false)
}

const handleSaveEdit = (e: React.FormEvent) => {
  e.preventDefault()
  if (!selectedReport) return
  updateMutation.mutate({ id: selectedReport.id, title: editForm.title, content: editForm.content })
}
```

**步骤 3: 切换日期/周报时确认未保存**

```tsx
const handleSelectDate = (date: Date, isCurrentMonth: boolean) => {
  if (!isCurrentMonth) return
  if (isEditing && !confirmLeave()) return
  setIsEditing(false)
  setHasUnsavedChanges(false)
  setPanelState({ mode: 'daily', date })
}

const handleSelectWeek = (week: WeekRow) => {
  if (isEditing && !confirmLeave()) return
  setIsEditing(false)
  setHasUnsavedChanges(false)
  setPanelState({ mode: 'weekly', week })
}

const handleMonthChange = (offset: number) => {
  if (isEditing && !confirmLeave()) return
  const nextMonth = addMonths(selectedMonth, offset)
  setSelectedMonth(nextMonth)
  setIsEditing(false)
  setHasUnsavedChanges(false)
  setPanelState({ mode: 'daily', date: startOfMonth(nextMonth) })
}
```

**步骤 4: 详情区渲染查看/编辑模式**

```tsx
{selectedReport ? (
  isEditing ? (
    <form onSubmit={handleSaveEdit} className="space-y-6">
      <Input
        value={editForm.title}
        onChange={(e) => {
          setEditForm({ ...editForm, title: e.target.value })
          setHasUnsavedChanges(true)
        }}
        maxLength={200}
        required
      />
      <Textarea
        value={editForm.content}
        onChange={(e) => {
          setEditForm({ ...editForm, content: e.target.value })
          setHasUnsavedChanges(true)
        }}
        rows={15}
        className="font-mono text-sm"
        required
      />
      <div className="flex items-center gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? '保存中...' : '保存'}
        </Button>
        <Button type="button" variant="secondary" onClick={handleCancelEdit}>
          取消
        </Button>
      </div>
    </form>
  ) : (
    <>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleCopy}>
          ...
        </Button>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleStartEdit}>
          ...
        </Button>
        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={...}>
          ...
        </Button>
      </div>
      <ReactMarkdown>{selectedReport.content}</ReactMarkdown>
    </>
  )
) : ...}
```

**步骤 5: 删除编辑 Dialog 相关代码**

- 删除 `isEditModalOpen` 状态、`editForm` 弹窗逻辑与 `<Dialog>` 编辑弹窗。

**步骤 6: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 7: 提交**

```bash
git add frontend/src/pages/Reports.tsx

git commit -m "refactor: inline edit for reports"
```

---

### 任务 3: SQL 管理卡片行内编辑

**文件：**
- 修改：`frontend/src/pages/SqlManagement.tsx:1`

**步骤 1: 替换编辑状态为 editingId + 表单**

```tsx
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'

const [editingId, setEditingId] = useState<number | null>(null)
const [editForm, setEditForm] = useState({ title: '', content: '', remark: '' })
const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

const { confirmLeave } = useUnsavedWarning(hasUnsavedChanges)
```

**步骤 2: 编辑进入/保存/取消逻辑**

```tsx
const handleStartEdit = (sql: PendingSql) => {
  if (editingId && editingId !== sql.id && !confirmLeave()) return
  setEditingId(sql.id)
  setEditForm({
    title: sql.title,
    content: sql.content,
    remark: sql.remark || '',
  })
  setHasUnsavedChanges(false)
}

const handleCancelEdit = () => {
  if (hasUnsavedChanges && !confirmLeave()) return
  setEditingId(null)
  setHasUnsavedChanges(false)
}

const handleSaveEdit = () => {
  if (!editingId) return
  updateMutation.mutate({
    id: editingId,
    projectId: '',
    iterationId: '',
    title: editForm.title,
    content: editForm.content,
    remark: editForm.remark,
  })
}
```

**步骤 3: 卡片内渲染编辑/查看模式**

```tsx
<Card
  className={cn(
    'transition hover:shadow-xl',
    editingId === sql.id && 'border-[hsl(var(--accent))]/50 bg-[hsl(var(--accent))]/5'
  )}
>
  {editingId === sql.id ? (
    <CardContent className="space-y-4">
      <Input
        value={editForm.title}
        onChange={(e) => {
          setEditForm({ ...editForm, title: e.target.value })
          setHasUnsavedChanges(true)
        }}
      />
      <Textarea
        value={editForm.content}
        onChange={(e) => {
          setEditForm({ ...editForm, content: e.target.value })
          setHasUnsavedChanges(true)
        }}
        rows={8}
        className="font-mono text-sm"
      />
      <Textarea
        value={editForm.remark}
        onChange={(e) => {
          setEditForm({ ...editForm, remark: e.target.value })
          setHasUnsavedChanges(true)
        }}
        rows={2}
      />
      <div className="flex items-center gap-2">
        <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? '保存中...' : '保存'}
        </Button>
        <Button variant="secondary" onClick={handleCancelEdit}>取消</Button>
      </div>
    </CardContent>
  ) : (
    // 保留原有查看模式
  )}
</Card>
```

**步骤 4: 保留新增 SQL Dialog，移除编辑 Dialog**

- 新增 SQL 弹窗继续使用 `isModalOpen`。
- 删除旧的编辑弹窗逻辑与 `editingSql` 相关状态。

**步骤 5: 运行前端构建验证**

运行：`npm run build`
预期：构建通过，无类型错误。

**步骤 6: 提交**

```bash
git add frontend/src/pages/SqlManagement.tsx

git commit -m "refactor: inline edit sql cards"
```

---

### 任务 4: 手动验证

**文件：**
- 参考：`frontend/src/pages/Reports.tsx`
- 参考：`frontend/src/pages/SqlManagement.tsx`

**步骤 1: 日报行内编辑**
- 点击编辑按钮，详情区切换到 Input/Textarea。
- 修改后点击保存，恢复查看模式。
- 点击取消恢复查看模式。

**步骤 2: SQL 行内编辑**
- 点击某条 SQL 的编辑按钮，卡片高亮并展示编辑表单。
- 保存后回到查看模式并刷新列表。
- 同时只能编辑一条 SQL。

**步骤 3: 未保存提醒**
- 编辑中切换日期/周报或切换编辑 SQL，弹出确认提示。
- 刷新/关闭页面触发浏览器未保存提醒。

**步骤 4: 构建验证**

运行：`npm run build`
预期：构建通过。
