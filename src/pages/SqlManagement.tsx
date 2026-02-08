import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageResult } from '@/api'
import { sqlApi, PendingSqlDetail } from '@/api/sql'
import { projectApi, Project } from '@/api/project'
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
import { EnvExecutionButtons, EnvExecutionItem } from '@/components/sql/EnvExecutionButtons'
import { ExecuteConfirmDialog } from '@/components/sql/ExecuteConfirmDialog'
import RequirementLinkDialog from '@/components/requirement/RequirementLinkDialog'

const FIXED_ENV_OPTIONS = [
  { envCode: 'local', envName: 'local' },
  { envCode: 'dev', envName: 'dev' },
  { envCode: 'test', envName: 'test' },
  { envCode: 'smoke', envName: 'smoke' },
  { envCode: 'prod', envName: 'prod' },
]

const STATUS_DESC_MAP: Record<string, string> = {
  pending: '待执行',
  partial: '部分执行',
  completed: '全部完成',
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
  const [selectedEnv, setSelectedEnv] = useState<EnvExecutionItem | null>(null)
  const [selectedSql, setSelectedSql] = useState<PendingSqlDetail | null>(null)
  const [executeEnvCode, setExecuteEnvCode] = useState('')
  const [executeRemark, setExecuteRemark] = useState('')
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [previewSql, setPreviewSql] = useState<PendingSqlDetail | null>(null)
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

  const { data: sqlList, isLoading } = useQuery<PageResult<PendingSqlDetail>>({
    queryKey: ['pending-sql', selectedStatus, selectedProjectId],
    queryFn: () => sqlApi.list({
      page: 1,
      size: 100,
      status: selectedStatus || undefined,
      project_id: selectedProjectId ? parseInt(selectedProjectId) : undefined,
    }),
  })

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-all'],
    queryFn: () => projectApi.listAll(),
  })

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => sqlApi.add({
      project_id: parseInt(data.projectId),
      iteration_id: data.iterationId ? parseInt(data.iterationId) : 0,
      title: data.title,
      content: data.content,
      remark: data.remark || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; content: string; remark: string }) =>
      sqlApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      setEditingId(null)
      setHasUnsavedChanges(false)
    },
  })

  const executeMutation = useMutation({
    mutationFn: ({ id, env, remark }: { id: number; env: string; remark: string }) =>
      sqlApi.execute({ id, env, remark }),
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
      sqlApi.revokeExecution({ sql_id: sqlId, env }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      setExecuteDialogOpen(false)
      setExecuteRemark('')
      setSelectedEnv(null)
      setSelectedSql(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sqlApi.delete(id),
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

  const handleStartEdit = (sql: PendingSqlDetail) => {
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
    const editingSql = sqlList?.records.find((item) => item.id === editingId)
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

  const buildEnvItems = (sql?: PendingSqlDetail | null): EnvExecutionItem[] => {
    const map = new Map((sql?.env_executions || []).map((item) => [item.env_code, item]))
    return FIXED_ENV_OPTIONS.map((option) => {
      const existing = map.get(option.envCode)
      return {
        envCode: option.envCode,
        envName: option.envName,
        executed: existing?.executed ?? false,
        executedAt: existing?.executed_at ?? undefined,
        executor: existing?.executor ?? undefined,
        remark: existing?.remark ?? undefined,
      }
    })
  }

  const handleOpenExecute = (sql: PendingSqlDetail, envCode?: string) => {
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

  const handlePreviewSql = (sql: PendingSqlDetail) => {
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
        {sqlList?.records?.length ? (
          sqlList.records.map((sql) => {
            const envItems = buildEnvItems(sql)
            const executedCount = envItems.filter((item) => item.executed).length
            const isEditing = editingId === sql.id
            const statusDesc = STATUS_DESC_MAP[sql.execution_status] || sql.execution_status
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
                          tone={sql.execution_status === 'completed' ? 'success' : 'warning'}
                        >
                          {statusDesc}
                        </Badge>
                        <span>
                          {sql.project_name} {sql.iteration_name && `/ ${sql.iteration_name}`}
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
                            tone={sql.execution_status === 'completed' ? 'success' : 'warning'}
                          >
                            {statusDesc}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {sql.project_name} {sql.iteration_name && `/ ${sql.iteration_name}`}
                          {sql.linked_requirement && (
                            <>
                              {' '}
                              <Badge variant="soft" tone="info" className="ml-1">
                                {sql.linked_requirement}
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
                          const envExec = sql.env_executions?.find((item) => item.env_code === envCode)
                          if (!envExec) return
                          const mapped: EnvExecutionItem = {
                            envCode: envExec.env_code,
                            envName: envExec.env_name,
                            executed: envExec.executed,
                            executedAt: envExec.executed_at ?? undefined,
                            executor: envExec.executor ?? undefined,
                            remark: envExec.remark ?? undefined,
                          }
                          setSelectedSql(sql)
                          setSelectedEnv(mapped)
                          setExecuteDialogMode('detail')
                          setExecuteRemark(envExec.remark || '')
                          setExecuteDialogOpen(true)
                        }}
                      />

                      {sql.executed_at && (
                        <p className="text-xs text-muted-foreground">
                          最近执行时间: {sql.executed_at} | 环境: {sql.executed_env}
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
              {previewSql?.project_name || ''}{' '}
              {previewSql?.iteration_name ? `/ ${previewSql.iteration_name}` : ''}
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
