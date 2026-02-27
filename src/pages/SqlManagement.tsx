import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { PageResult } from '@/api'
import { sqlApi, PendingSqlDetail } from '@/api/sql'
import { projectApi, Project } from '@/api/project'
import { iterationApi } from '@/api/iteration'
import { requirementApi, RequirementItem } from '@/api/requirement'
import { buildSettingMap, settingApi } from '@/api/setting'
import { Eye, Plus, Trash2, Pencil } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'
import { EnvExecutionButtons, EnvExecutionItem } from '@/components/sql/EnvExecutionButtons'
import { ExecuteConfirmDialog } from '@/components/sql/ExecuteConfirmDialog'
import RequirementLinkDialog from '@/components/requirement/RequirementLinkDialog'
import { useSqlStore } from '@/stores/useSqlStore'
import { SQL_STATUS_LABEL } from '@/constants/status'
import { ENVIRONMENT_OPTIONS_SETTING_KEY, parseEnvironmentOptions } from '@/lib/environmentOptions'

interface RequirementGroup {
  iterationId: number
  iterationName: string
  items: RequirementItem[]
}

export default function SqlManagement() {
  const queryClient = useQueryClient()

  // --- Zustand store (selector 精确订阅) ---
  const isModalOpen = useSqlStore((s) => s.isModalOpen)
  const selectedStatus = useSqlStore((s) => s.selectedStatus)
  const selectedProjectId = useSqlStore((s) => s.selectedProjectId)
  const editingId = useSqlStore((s) => s.editingId)
  const editForm = useSqlStore((s) => s.editForm)
  const hasUnsavedChanges = useSqlStore((s) => s.hasUnsavedChanges)
  const executeDialogOpen = useSqlStore((s) => s.executeDialogOpen)
  const executeDialogMode = useSqlStore((s) => s.executeDialogMode)
  const selectedEnv = useSqlStore((s) => s.selectedEnv)
  const selectedSql = useSqlStore((s) => s.selectedSql)
  const executeEnvCode = useSqlStore((s) => s.executeEnvCode)
  const executeRemark = useSqlStore((s) => s.executeRemark)
  const previewDialogOpen = useSqlStore((s) => s.previewDialogOpen)
  const previewSql = useSqlStore((s) => s.previewSql)
  const linkDialogOpen = useSqlStore((s) => s.linkDialogOpen)
  const linkSqlId = useSqlStore((s) => s.linkSqlId)
  const formData = useSqlStore((s) => s.formData)

  const store = useSqlStore
  const { dialogState, openConfirm, closeConfirm, handleConfirm } = useConfirmDialog()

  useUnsavedWarning(hasUnsavedChanges)

  // --- 需求分组（新增弹窗用）---
  const [requirementGroups, setRequirementGroups] = useState<RequirementGroup[]>([])
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false)

  const { data: iterationPage } = useQuery<PageResult<{ id: number; name: string }>>({
    queryKey: ['iterations-all'],
    queryFn: () => iterationApi.list({ page: 1, size: 200 }),
    enabled: isModalOpen,
  })

  useEffect(() => {
    if (!isModalOpen) {
      setRequirementGroups([])
      setIsLoadingRequirements(false)
      return
    }
    const iterations = iterationPage?.records || []
    if (!iterations.length) {
      setRequirementGroups([])
      return
    }
    let cancelled = false
    setIsLoadingRequirements(true)
    Promise.all(iterations.map((it) => requirementApi.list(it.id)))
      .then((results) => {
        if (cancelled) return
        const groups = iterations
          .map((it, idx) => ({
            iterationId: it.id,
            iterationName: it.name,
            items: results[idx] || [],
          }))
          .filter((g) => g.items.length > 0)
        setRequirementGroups(groups)
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRequirements(false)
      })
    return () => { cancelled = true }
  }, [isModalOpen, iterationPage])

  // --- React Query (服务端状态) ---
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
  const { data: settingsMap } = useQuery({
    queryKey: ['settings', 'map'],
    queryFn: () => settingApi.getAll(),
    select: buildSettingMap,
  })
  const configuredEnvOptions = useMemo(
    () => parseEnvironmentOptions(settingsMap?.[ENVIRONMENT_OPTIONS_SETTING_KEY]),
    [settingsMap],
  )

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => sqlApi.add({
      project_id: parseInt(data.projectId),
      iteration_id: data.iterationId ? parseInt(data.iterationId) : 0,
      title: data.title,
      content: data.content,
      remark: data.remark || undefined,
      requirement_id: data.requirementId ? parseInt(data.requirementId) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      queryClient.invalidateQueries({ queryKey: ['requirements-page'] })
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      store.getState().closeAddModal()
      store.getState().resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; content: string; remark: string }) =>
      sqlApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      store.getState().clearEdit()
    },
  })

  const executeMutation = useMutation({
    mutationFn: ({ id, env, remark }: { id: number; env: string; remark: string }) =>
      sqlApi.execute({ id, env, remark }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      store.getState().closeExecuteDialog()
    },
  })

  const revokeMutation = useMutation({
    mutationFn: ({ sqlId, env }: { sqlId: number; env: string }) =>
      sqlApi.revokeExecution({ sql_id: sqlId, env }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
      store.getState().closeExecuteDialog()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sqlApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
    },
  })

  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    addMutation.mutate(formData)
  }

  const runWithUnsavedGuard = (action: () => void) => {
    if (!(editingId && hasUnsavedChanges)) {
      action()
      return
    }
    openConfirm(
      {
        title: '放弃未保存修改？',
        description: '当前编辑内容尚未保存，继续操作会丢失修改。',
        confirmText: '放弃修改',
        cancelText: '继续编辑',
      },
      action,
    )
  }

  const handleStartEdit = (sql: PendingSqlDetail) => {
    if (editingId && editingId !== sql.id) {
      runWithUnsavedGuard(() => store.getState().startEdit(sql))
      return
    }
    store.getState().startEdit(sql)
  }

  const handleCancelEdit = () => {
    runWithUnsavedGuard(() => store.getState().cancelEdit())
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const submitEdit = () => {
      updateMutation.mutate({
        id: editingId,
        title: editForm.title,
        content: editForm.content,
        remark: editForm.remark,
      })
    }
    const editingSql = sqlList?.records.find((item) => item.id === editingId)
    const editingEnvItems = buildEnvItems(editingSql)
    if (editingEnvItems.some((item) => item.executed)) {
      openConfirm(
        {
          title: '确认更新事项？',
          description: '该事项已在部分环境执行，修改仅影响后续执行记录。',
          confirmText: '继续更新',
        },
        submitEdit,
      )
      return
    }
    submitEdit()
  }

  const buildEnvItems = (sql?: PendingSqlDetail | null): EnvExecutionItem[] => {
    const map = new Map((sql?.env_executions || []).map((item) => [item.env_code, item]))
    const items = configuredEnvOptions.map((option) => {
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

    for (const existing of sql?.env_executions || []) {
      if (items.some((item) => item.envCode === existing.env_code)) {
        continue
      }
      items.push({
        envCode: existing.env_code,
        envName: existing.env_name || existing.env_code,
        executed: existing.executed,
        executedAt: existing.executed_at ?? undefined,
        executor: existing.executor ?? undefined,
        remark: existing.remark ?? undefined,
      })
    }

    return items
  }

  const handleOpenExecute = (sql: PendingSqlDetail, envCode?: string) => {
    const envOptions = buildEnvItems(sql)
    const defaultEnvCode = envCode
      || envOptions.find((item) => !item.executed)?.envCode
      || envOptions[0]?.envCode
      || ''
    const env = envOptions.find((item) => item.envCode === defaultEnvCode) || null
    if (env) {
      store.getState().openExecuteDialog(sql, env, 'execute')
    }
  }

  const handleModalChange = (open: boolean) => {
    if (open) {
      store.getState().openAddModal()
    } else {
      store.getState().closeAddModal()
      store.getState().resetForm()
    }
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <SectionLabel>TASK HUB</SectionLabel>
          <div>
            <h1 className="text-3xl font-display">执行事项</h1>
            <p className="mt-2 text-sm text-muted-foreground">集中管理待执行脚本与投放状态</p>
          </div>
        </div>
        <Button onClick={() => {
          runWithUnsavedGuard(() => {
            store.getState().clearEdit()
            store.getState().resetForm()
            store.getState().openAddModal()
          })
        }}>
          <Plus className="h-4 w-4" />
          新增事项
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>项目筛选</Label>
            <Select value={selectedProjectId || 'all'} onValueChange={(value) => store.getState().setSelectedProjectId(value === 'all' ? '' : value)}>
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
            <Select value={selectedStatus || 'all'} onValueChange={(value) => store.getState().setSelectedStatus(value === 'all' ? '' : value)}>
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
            const statusDesc = SQL_STATUS_LABEL[sql.execution_status] || sql.execution_status
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
                        onChange={(e) => store.getState().setEditForm({ title: e.target.value })}
                        maxLength={200}
                        required
                      />
                      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                        <Badge variant="soft" tone={sql.execution_status === 'completed' ? 'success' : 'warning'}>
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
                        onChange={(e) => store.getState().setEditForm({ content: e.target.value })}
                        rows={12}
                        className="max-h-[520px] min-h-[320px] resize-y overflow-y-auto font-mono text-sm"
                        required
                      />
                      <Textarea
                        value={editForm.remark}
                        onChange={(e) => store.getState().setEditForm({ remark: e.target.value })}
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
                          <Badge variant="soft" tone={sql.execution_status === 'completed' ? 'success' : 'warning'}>
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
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => store.getState().openPreview(sql)} aria-label="查看详情">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => handleStartEdit(sql)} aria-label="编辑事项">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => store.getState().openLinkDialog(sql.id)}>
                          关联需求
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => handleOpenExecute(sql)}>
                          执行
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => {
                            openConfirm(
                              {
                                title: '删除执行事项？',
                                description: `确定删除「${sql.title}」吗？`,
                                confirmText: '删除',
                              },
                              () => deleteMutation.mutate(sql.id),
                            )
                          }}
                          aria-label="删除事项"
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
                        onExecute={(envCode) => handleOpenExecute(sql, envCode)}
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
                          store.getState().openExecuteDialog(sql, mapped, 'detail')
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
              暂无执行事项
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
        onRemarkChange={(v) => store.getState().setExecuteRemark(v)}
        onClose={() => store.getState().closeExecuteDialog()}
        onConfirm={() => {
          if (!selectedSql) return
          if (!executeEnvCode) { alert('请选择执行环境'); return }
          executeMutation.mutate({ id: selectedSql.id, env: executeEnvCode, remark: executeRemark })
        }}
        onEnvChange={(value) => {
          store.getState().setExecuteEnvCode(value)
          const env = buildEnvItems(selectedSql).find((item) => item.envCode === value) || null
          if (env) {
            store.getState().openExecuteDialog(selectedSql!, env, executeDialogMode)
          }
        }}
        onRevoke={() => {
          if (!selectedEnv || !selectedSql) return
          revokeMutation.mutate({ sqlId: selectedSql.id, env: selectedEnv.envCode })
        }}
      />

      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        if (!open) store.getState().closePreview()
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{previewSql?.title || '事项详情'}</DialogTitle>
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
          if (!open) store.getState().closeLinkDialog()
        }}
        sqlId={linkSqlId || undefined}
        onLinked={() => {
          queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
          queryClient.invalidateQueries({ queryKey: ['requirements-page'] })
          queryClient.invalidateQueries({ queryKey: ['iterations'] })
        }}
      />

      <Dialog open={isModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增执行事项</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>所属项目 *</Label>
                <Select value={formData.projectId ? String(formData.projectId) : undefined} onValueChange={(value) => store.getState().setFormData({ projectId: value })}>
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
                  onChange={(e) => store.getState().setFormData({ iterationId: e.target.value })}
                  placeholder="迭代 ID（可选）"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>关联需求</Label>
              {isLoadingRequirements ? (
                <p className="text-sm text-muted-foreground py-2">正在加载需求...</p>
              ) : requirementGroups.length ? (
                <Select value={formData.requirementId || undefined} onValueChange={(value) => store.getState().setFormData({ requirementId: value === '__none__' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择需求（可选）" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">不关联需求</SelectItem>
                    {requirementGroups.map((group) => (
                      <SelectGroup key={group.iterationId}>
                        <SelectLabel>{group.iterationName}</SelectLabel>
                        {group.items.map((item) => (
                          <SelectItem key={item.id} value={String(item.id)}>
                            {item.requirement_code ? `${item.requirement_code} - ${item.name}` : item.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground py-2">暂无可关联需求</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>事项标题 *</Label>
              <Input
                value={formData.title}
                onChange={(e) => store.getState().setFormData({ title: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>事项内容 *</Label>
              <Textarea
                value={formData.content}
                onChange={(e) => store.getState().setFormData({ content: e.target.value })}
                rows={8}
                className="font-mono text-sm"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>备注</Label>
              <Textarea
                value={formData.remark}
                onChange={(e) => store.getState().setFormData({ remark: e.target.value })}
                rows={2}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="secondary" onClick={() => handleModalChange(false)}>
                取消
              </Button>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                {addMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) closeConfirm()
        }}
        title={dialogState.title}
        description={dialogState.description}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
