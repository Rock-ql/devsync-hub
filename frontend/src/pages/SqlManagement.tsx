import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { PageResult } from '@/api'
import { Eye, Plus, Trash2, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'
import { EnvExecutionButtons } from '@/components/sql/EnvExecutionButtons'
import { ExecuteConfirmDialog } from '@/components/sql/ExecuteConfirmDialog'
import RequirementLinkDialog from '@/components/requirement/RequirementLinkDialog'

interface EnvExecution {
  envCode: string
  envName: string
  executed: boolean
  executedAt?: string
  executor?: string
  remark?: string
}

const FIXED_ENV_OPTIONS = [
  { envCode: 'local', envName: 'local' },
  { envCode: 'dev', envName: 'dev' },
  { envCode: 'test', envName: 'test' },
  { envCode: 'smoke', envName: 'smoke' },
  { envCode: 'prod', envName: 'prod' },
]

interface PendingSql {
  envExecutionList: EnvExecution[]
  executedCount: number
  envTotal: number
  id: number
  projectId: number
  projectName: string
  iterationId: number
  iterationName: string
  title: string
  content: string
  executionOrder: number
  status: string
  statusDesc: string
  executedAt: string
  executedEnv: string
  remark: string
  linkedRequirementName?: string
}

interface Project {
  id: number
  name: string
}

export default function SqlManagement() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState({ title: '', content: '', remark: '' })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false)
  const [executeDialogMode, setExecuteDialogMode] = useState<'execute' | 'detail'>('execute')
  const [selectedEnv, setSelectedEnv] = useState<EnvExecution | null>(null)
  const [selectedSql, setSelectedSql] = useState<PendingSql | null>(null)
  const [executeEnvCode, setExecuteEnvCode] = useState('')
  const [executeRemark, setExecuteRemark] = useState('')
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewSql, setPreviewSql] = useState<PendingSql | null>(null)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkSqlId, setLinkSqlId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    projectId: '',
    iterationId: '',
    title: '',
    content: '',
    remark: '',
  })
  const { confirmLeave } = useUnsavedWarning(hasUnsavedChanges)

  const { data: sqlList, isLoading } = useQuery<PageResult<PendingSql>>({
    queryKey: ['pending-sql', selectedStatus, selectedProjectId],
    queryFn: () => api.post('/sql/list', {
      pageNum: 1,
      pageSize: 100,
      status: selectedStatus || undefined,
      projectId: selectedProjectId ? parseInt(selectedProjectId) : undefined,
    }),
  })

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-all'],
    queryFn: () => api.get('/project/all'),
  })

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/sql/add', {
      ...data,
      projectId: parseInt(data.projectId),
      iterationId: data.iterationId ? parseInt(data.iterationId) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; content: string; remark: string }) =>
      api.post('/sql/update', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      setEditingId(null)
      setHasUnsavedChanges(false)
    },
  })

  const executeMutation = useMutation({
    mutationFn: ({ id, env, remark }: { id: number; env: string; remark: string }) =>
      api.post('/sql/execute', { id, executedEnv: env, remark }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      setExecuteDialogOpen(false)
      setExecuteRemark('')
      setSelectedEnv(null)
      setSelectedSql(null)
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({ sqlId, env }: { sqlId: number; env: string }) =>
      api.post('/sql/revoke-execution', { sqlId, env }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      setExecuteDialogOpen(false)
      setExecuteRemark('')
      setSelectedEnv(null)
      setSelectedSql(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.post(`/sql/delete/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
    },
  })

  const resetForm = () => {
    setFormData({ projectId: '', iterationId: '', title: '', content: '', remark: '' })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addMutation.mutate(formData)
  }

  const handleStartEdit = (sql: PendingSql) => {
    if (editingId && editingId !== sql.id && !confirmLeave()) {
      return
    }
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
    const editingSql = sqlList?.list.find((item) => item.id === editingId)
    const editingEnvItems = buildEnvItems(editingSql)
    if (editingEnvItems.some((item) => item.executed)) {
      if (!confirm('该SQL已在部分环境执行，修改不影响已有执行记录，是否继续？')) {
        return
      }
    }
    updateMutation.mutate({
      id: editingId,
      title: editForm.title,
      content: editForm.content,
      remark: editForm.remark,
    })
  }

  const buildEnvItems = (sql?: PendingSql | null): EnvExecution[] => {
    const map = new Map((sql?.envExecutionList || []).map((item) => [item.envCode, item]))
    return FIXED_ENV_OPTIONS.map((option) => {
      const existing = map.get(option.envCode)
      return {
        envCode: option.envCode,
        envName: option.envName,
        executed: existing?.executed ?? false,
        executedAt: existing?.executedAt,
        executor: existing?.executor,
        remark: existing?.remark,
      }
    })
  }

  const handleOpenExecute = (sql: PendingSql, envCode?: string) => {
    const envOptions = buildEnvItems(sql)
    const defaultEnvCode = envCode
      || envOptions.find((item) => !item.executed)?.envCode
      || envOptions[0]?.envCode
      || ''
    const env = envOptions.find((item) => item.envCode === defaultEnvCode) || null

    setSelectedSql(sql)
    setSelectedEnv(env)
    setExecuteEnvCode(defaultEnvCode)
    setExecuteDialogMode('execute')
    setExecuteRemark('')
    setExecuteDialogOpen(true)
  }

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      resetForm()
    }
  }

  const handlePreviewSql = (sql: PendingSql) => {
    setPreviewSql(sql)
    setPreviewDialogOpen(true)
  }

  const handleOpenLink = (sqlId: number) => {
    setLinkSqlId(sqlId)
    setLinkDialogOpen(true)
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <SectionLabel>SQL HUB</SectionLabel>
          <div>
            <h1 className="text-3xl font-display">SQL 管理</h1>
            <p className="mt-2 text-sm text-muted-foreground">集中管理待执行脚本与投放状态</p>
          </div>
        </div>
        <Button onClick={() => {
          if (editingId && hasUnsavedChanges && !confirmLeave()) {
            return
          }
          setEditingId(null)
          setHasUnsavedChanges(false)
          resetForm()
          setIsModalOpen(true)
        }}>
          <Plus className="h-4 w-4" />
          新增 SQL
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>项目筛选</Label>
            <Select value={selectedProjectId || 'all'} onValueChange={(value) => setSelectedProjectId(value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="全部项目" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部项目</SelectItem>
                {projects?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>状态筛选</Label>
            <Select value={selectedStatus || 'all'} onValueChange={(value) => setSelectedStatus(value === 'all' ? '' : value)}>
              <SelectTrigger>
                <SelectValue placeholder="全部状态" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部状态</SelectItem>
                <SelectItem value="pending">待执行</SelectItem>
                <SelectItem value="partial">部分执行</SelectItem>
                <SelectItem value="completed">全部完成</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {sqlList?.list?.length ? (
          sqlList.list.map((sql) => {
            const envItems = buildEnvItems(sql)
            const executedCount = envItems.filter((item) => item.executed).length
            const isEditing = editingId === sql.id
            return (
              <Card
                key={sql.id}
                className={cn(
                  'transition hover:shadow-xl',
                  isEditing && 'border-[hsl(var(--accent))]/50 bg-[hsl(var(--accent))]/5'
                )}
              >
                {isEditing ? (
                  <>
                    <CardHeader className="space-y-3">
                      <Input
                        value={editForm.title}
                        onChange={(e) => {
                          setEditForm({ ...editForm, title: e.target.value })
                          setHasUnsavedChanges(true)
                        }}
                        maxLength={200}
                        required
                      />
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <Badge
                          variant="soft"
                          tone={sql.status === 'completed' ? 'success' : 'warning'}
                        >
                          {sql.statusDesc}
                        </Badge>
                        <span>
                          {sql.projectName} {sql.iterationName && `/ ${sql.iterationName}`}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        value={editForm.content}
                        onChange={(e) => {
                          setEditForm({ ...editForm, content: e.target.value })
                          setHasUnsavedChanges(true)
                        }}
                        rows={12}
                        className="max-h-[520px] min-h-[320px] resize-y overflow-y-auto font-mono text-sm"
                        required
                      />
                      <Textarea
                        value={editForm.remark}
                        onChange={(e) => {
                          setEditForm({ ...editForm, remark: e.target.value })
                          setHasUnsavedChanges(true)
                        }}
                        rows={2}
                        placeholder="备注"
                      />
                      <div className="flex items-center gap-2">
                        <Button onClick={handleSaveEdit} disabled={updateMutation.isPending}>
                          {updateMutation.isPending ? '保存中...' : '保存'}
                        </Button>
                        <Button variant="secondary" onClick={handleCancelEdit}>
                          取消
                        </Button>
                      </div>
                    </CardContent>
                  </>
                ) : (
                  <>
                    <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <CardTitle>{sql.title}</CardTitle>
                          <Badge
                            variant="soft"
                            tone={sql.status === 'completed' ? 'success' : 'warning'}
                          >
                            {sql.statusDesc}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sql.projectName} {sql.iterationName && `/ ${sql.iterationName}`}
                          {sql.linkedRequirementName && (
                            <>
                              {' '}
                              <Badge variant="soft" tone="info" className="ml-1">
                                {sql.linkedRequirementName}
                              </Badge>
                            </>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => handlePreviewSql(sql)}
                          aria-label="查看 SQL 详情"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={() => handleStartEdit(sql)}
                          aria-label="编辑 SQL"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenLink(sql.id)}
                        >
                          关联需求
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenExecute(sql)}
                        >
                          执行
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => {
                            if (confirm('确定要删除此 SQL 吗？')) {
                              deleteMutation.mutate(sql.id)
                            }
                          }}
                          aria-label="删除 SQL"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <pre className="max-h-56 overflow-y-auto rounded-xl border border-border/60 bg-muted/60 p-4 text-sm text-foreground overflow-x-auto">
                        {sql.content}
                      </pre>

                      <EnvExecutionButtons
                        items={envItems}
                        executedCount={executedCount}
                        envTotal={envItems.length}
                        showAddEnv={false}
                        onExecute={(envCode) => {
                          handleOpenExecute(sql, envCode)
                        }}
                        onDetail={(envCode) => {
                          const env = sql.envExecutionList?.find((item) => item.envCode === envCode)
                          if (!env) return
                          setSelectedSql(sql)
                          setSelectedEnv(env)
                          setExecuteDialogMode('detail')
                          setExecuteRemark(env.remark || '')
                          setExecuteDialogOpen(true)
                        }}
                      />

                      {sql.executedAt && (
                        <p className="text-xs text-muted-foreground">
                          最近执行时间: {sql.executedAt} | 环境: {sql.executedEnv}
                        </p>
                      )}

                      {sql.remark && (
                        <p className="text-sm text-muted-foreground">备注: {sql.remark}</p>
                      )}
                    </CardContent>
                  </>
                )}
              </Card>
            )
          })
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              暂无 SQL 数据
            </CardContent>
          </Card>
        )}
      </div>

      <ExecuteConfirmDialog
        open={executeDialogOpen}
        mode={executeDialogMode}
        envName={selectedEnv?.envName || ''}
        sqlTitle={selectedSql?.title || ''}
        envOptions={buildEnvItems(selectedSql)}
        selectedEnvCode={executeEnvCode}
        executedAt={selectedEnv?.executedAt}
        executor={selectedEnv?.executor}
        remark={executeRemark}
        onRemarkChange={setExecuteRemark}
        onClose={() => {
          setExecuteDialogOpen(false)
          setSelectedEnv(null)
          setSelectedSql(null)
          setExecuteRemark('')
          setExecuteEnvCode('')
        }}
        onConfirm={() => {
          if (!selectedSql) return
          if (!executeEnvCode) {
            alert('请选择执行环境')
            return
          }
          executeMutation.mutate({ id: selectedSql.id, env: executeEnvCode, remark: executeRemark })
        }}
        onEnvChange={(value) => {
          setExecuteEnvCode(value)
          const env = buildEnvItems(selectedSql).find((item) => item.envCode === value) || null
          setSelectedEnv(env)
        }}
        onRevoke={() => {
          if (!selectedEnv || !selectedSql) return
          revokeMutation.mutate({ sqlId: selectedSql.id, env: selectedEnv.envCode })
        }}
      />

      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open)
        if (!open) {
          setPreviewSql(null)
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewSql?.title || 'SQL 详情'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              {previewSql?.projectName || ''}{' '}
              {previewSql?.iterationName ? `/ ${previewSql.iterationName}` : ''}
            </p>
          </div>
          <pre className="max-h-[70vh] overflow-auto rounded-xl border border-border/60 bg-muted/60 p-4 text-sm text-foreground">
            {previewSql?.content || ''}
          </pre>
        </DialogContent>
      </Dialog>

      <RequirementLinkDialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open)
          if (!open) {
            setLinkSqlId(null)
          }
        }}
        sqlId={linkSqlId || undefined}
        onLinked={() => {
          queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
        }}
      />

      <Dialog open={isModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增 SQL</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>所属项目 *</Label>
                <Select value={formData.projectId ? String(formData.projectId) : undefined} onValueChange={(value) => setFormData({ ...formData, projectId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择项目" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects?.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>关联迭代</Label>
                <Input
                  type="number"
                  value={formData.iterationId}
                  onChange={(e) => setFormData({ ...formData, iterationId: e.target.value })}
                  placeholder="迭代 ID（可选）"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>SQL 标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>SQL 内容 *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                rows={8}
                className="font-mono text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.remark}
                onChange={(e) => setFormData({ ...formData, remark: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleModalChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                {addMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
