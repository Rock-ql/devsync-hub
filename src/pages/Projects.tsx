import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageResult } from '@/api'
import { projectApi, Project, ProjectDetail, GitCommit } from '@/api/project'
import { iterationApi, IterationDetail } from '@/api/iteration'
import { sqlApi, PendingSqlDetail } from '@/api/sql'
import { Plus, Pencil, Trash2, GitBranch, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toaster'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useProjectStore, DetailTab } from '@/stores/useProjectStore'
import { ITER_STATUS_LABEL, ITER_STATUS_TONE, SQL_STATUS_LABEL } from '@/constants/status'

export default function Projects() {
  const queryClient = useQueryClient()
  const store = useProjectStore
  const { dialogState, openConfirm, closeConfirm, handleConfirm } = useConfirmDialog()

  // --- Zustand store (selector 精确订阅) ---
  const isModalOpen = useProjectStore((s) => s.isModalOpen)
  const isDetailOpen = useProjectStore((s) => s.isDetailOpen)
  const activeTab = useProjectStore((s) => s.activeTab)
  const selectedProject = useProjectStore((s) => s.selectedProject)
  const editingProject = useProjectStore((s) => s.editingProject)
  const syncingProjectId = useProjectStore((s) => s.syncingProjectId)
  const formData = useProjectStore((s) => s.formData)

  // --- 防抖分支查询（保留局部 state，因为是临时的防抖值） ---
  const [debouncedBranchParams, setDebouncedBranchParams] = useState({
    gitlab_url: '',
    gitlab_token: '',
    gitlab_project_id: '',
    project_id: undefined as number | undefined,
  })
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedBranchParams({
        gitlab_url: formData.gitlab_url,
        gitlab_token: formData.gitlab_token,
        gitlab_project_id: formData.gitlab_project_id,
        project_id: editingProject?.id,
      })
    }, 500)
    return () => { if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current) }
  }, [formData.gitlab_url, formData.gitlab_token, formData.gitlab_project_id, editingProject?.id])

  // --- React Query ---
  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.list({ page: 1, size: 100 }),
  })

  const { data: commitsData, isLoading: commitsLoading } = useQuery<GitCommit[]>({
    queryKey: ['project-commits', selectedProject?.id],
    queryFn: () => projectApi.getCommits(selectedProject!.id),
    enabled: !!selectedProject && isDetailOpen && activeTab === 'commits',
  })

  const { data: iterationData, isLoading: iterationsLoading } = useQuery<PageResult<IterationDetail>>({
    queryKey: ['project-iterations', selectedProject?.id],
    queryFn: () => iterationApi.list({ page: 1, size: 100, project_id: selectedProject?.id }),
    enabled: !!selectedProject && isDetailOpen && activeTab === 'iterations',
  })

  const { data: sqlData, isLoading: sqlLoading } = useQuery<PageResult<PendingSqlDetail>>({
    queryKey: ['project-sql', selectedProject?.id],
    queryFn: () => sqlApi.list({ page: 1, size: 100, project_id: selectedProject?.id }),
    enabled: !!selectedProject && isDetailOpen && activeTab === 'sql',
  })

  const canFetchBranches = Boolean(formData.gitlab_url)
  const canFetchDebouncedBranches = Boolean(debouncedBranchParams.gitlab_url)

  const branchQuery = useQuery<string[]>({
    queryKey: ['gitlab-branches', debouncedBranchParams.gitlab_url, debouncedBranchParams.gitlab_token, debouncedBranchParams.gitlab_project_id, debouncedBranchParams.project_id],
    queryFn: () => {
      const projectId = debouncedBranchParams.gitlab_project_id?.toString().trim()
      const numericProjectId = projectId ? Number(projectId) : Number.NaN
      const safeProjectId = Number.isFinite(numericProjectId) && numericProjectId > 0 ? numericProjectId : undefined
      return projectApi.listBranches({
        gitlab_url: debouncedBranchParams.gitlab_url,
        gitlab_token: debouncedBranchParams.gitlab_token || undefined,
        gitlab_project_id: safeProjectId,
        project_id: debouncedBranchParams.project_id,
      })
    },
    enabled: canFetchDebouncedBranches,
  })

  useEffect(() => {
    const branches = branchQuery.data
    if (!branches || branches.length === 0) return
    const currentBranch = formData.gitlab_branch
    if (!currentBranch || !branches.includes(currentBranch)) {
      store.getState().setFormData({ gitlab_branch: branches[0] })
    }
  }, [branchQuery.data])

  const branchOptions = useMemo(() => {
    const options: string[] = []
    const pushUnique = (value?: string) => {
      if (!value) return
      const normalized = value.trim()
      if (!normalized || options.includes(normalized)) return
      options.push(normalized)
    }
    if (canFetchBranches) branchQuery.data?.forEach((name) => pushUnique(name))
    pushUnique(formData.gitlab_branch)
    return options
  }, [branchQuery.data, formData.gitlab_branch, canFetchBranches])

  // --- Mutations ---
  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => projectApi.add({
      ...data,
      gitlab_project_id: data.gitlab_project_id ? Number(data.gitlab_project_id) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      store.getState().closeModal()
      store.getState().resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number } & typeof formData) => projectApi.update({
      ...data,
      gitlab_project_id: data.gitlab_project_id ? Number(data.gitlab_project_id) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      store.getState().closeModal()
      store.getState().resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: (id: number) => projectApi.syncCommits(id),
    onMutate: (id: number) => { store.getState().setSyncingProjectId(id) },
    onSuccess: (addedCount, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project-commits', id] })
      toast.success(addedCount > 0 ? `同步成功，新增 ${addedCount} 条提交` : '同步完成，暂无新增提交')
    },
    onError: (error: unknown) => {
      toast.error(`同步失败：${error instanceof Error ? error.message : String(error)}`)
    },
    onSettled: () => { store.getState().setSyncingProjectId(null) },
  })

  // --- Handlers ---
  const handleEdit = (project: Project | ProjectDetail) => {
    store.getState().openEditModal(project as Project)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, ...formData })
    } else {
      addMutation.mutate(formData)
    }
  }

  const handleModalChange = (open: boolean) => {
    if (open) store.getState().openAddModal()
    else { store.getState().closeModal(); store.getState().resetForm() }
  }

  const handleDetailChange = (open: boolean) => {
    if (!open) store.getState().closeDetail()
  }

  const requestDeleteProject = (project: Project) => {
    openConfirm(
      {
        title: '删除项目？',
        description: `确认删除项目「${project.name}」吗？该操作不可撤销。`,
        confirmText: '删除',
      },
      () => deleteMutation.mutate(project.id),
    )
  }

  const formatCommitDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) return '-'
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) return dateStr
    return date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <SectionLabel>PROJECTS</SectionLabel>
          <div>
            <h1 className="text-3xl font-display">项目管理</h1>
            <p className="mt-2 text-sm text-muted-foreground">管理您的所有项目与协作资产</p>
          </div>
        </div>
        <Button onClick={() => store.getState().openAddModal()}>
          <Plus className="h-4 w-4" />
          新增项目
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
        {data?.records?.length ? (
          data.records.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-all hover:shadow-xl"
              onClick={() => {
                projectApi.detail(project.id).then((detail) => {
                  store.getState().openDetail(detail)
                })
              }}
            >
              <CardHeader className="relative space-y-0">
                <div className="min-w-0 space-y-2 pr-28">
                  <CardTitle className="truncate" title={project.name}>
                    {project.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || '暂无描述'}
                  </p>
                </div>
                <div
                  className="absolute right-6 top-6 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => handleEdit(project)} aria-label="编辑项目">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => requestDeleteProject(project)}
                    aria-label="删除项目"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info" variant="soft">{project.iteration_count ?? 0} 个迭代</Badge>
                  {(project.pending_sql_count ?? 0) > 0 ? (
                    <Badge tone="warning" variant="soft">{project.pending_sql_count ?? 0} 条执行事项待处理</Badge>
                  ) : (
                    <Badge tone="success" variant="soft">执行事项已清零</Badge>
                  )}
                  {Boolean(project.gitlab_url?.trim()) && (
                    <Badge tone="accent" variant="outline">GitLab 已连接</Badge>
                  )}
                </div>
                {Boolean(project.gitlab_url?.trim()) && (
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      <span>{project.gitlab_branch}</span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => syncMutation.mutate(project.id)} disabled={syncingProjectId === project.id}>
                      {syncingProjectId === project.id ? '同步中...' : '同步提交'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2 2xl:col-span-3">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              暂无项目，请先新增项目
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProject ? '编辑项目' : '新增项目'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>项目名称 *</Label>
              <Input value={formData.name} onChange={(e) => store.getState().setFormData({ name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>项目描述</Label>
              <Textarea value={formData.description} onChange={(e) => store.getState().setFormData({ description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label>GitLab 仓库地址</Label>
              <Input value={formData.gitlab_url} onChange={(e) => store.getState().setFormData({ gitlab_url: e.target.value })} placeholder="https://gitlab.com/user/project" />
            </div>
            <div className="space-y-2">
              <Label>GitLab Access Token</Label>
              <Input type="password" value={formData.gitlab_token} onChange={(e) => store.getState().setFormData({ gitlab_token: e.target.value })} placeholder={editingProject ? '留空则不修改（可使用全局 Token）' : '留空则使用全局 Token'} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>项目 ID</Label>
                <Input type="number" value={formData.gitlab_project_id} onChange={(e) => store.getState().setFormData({ gitlab_project_id: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>默认分支</Label>
                <Select value={formData.gitlab_branch || undefined} onValueChange={(value) => store.getState().setFormData({ gitlab_branch: value })}>
                  <SelectTrigger disabled={branchQuery.isFetching}>
                    <SelectValue placeholder="请选择分支" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>{branch}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {branchQuery.isFetching && <p className="text-xs text-muted-foreground">正在拉取分支列表...</p>}
                {!canFetchBranches && <p className="text-xs text-muted-foreground">填写 GitLab 地址后可动态获取分支（优先项目 Token，其次全局 Token）</p>}
                {branchQuery.isError && <p className="text-xs text-red-600">分支获取失败：{(branchQuery.error as Error).message}</p>}
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="secondary" onClick={() => handleModalChange(false)}>取消</Button>
              <Button type="submit" disabled={addMutation.isPending || updateMutation.isPending}>
                {addMutation.isPending || updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Sheet open={isDetailOpen} onOpenChange={handleDetailChange}>
        <SheetContent className="flex h-full flex-col">
          <SheetHeader className="flex flex-row items-center justify-between gap-3">
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => store.getState().closeDetail()}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="flex-1 truncate">{selectedProject?.name || '项目详情'}</SheetTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => { if (selectedProject) handleEdit(selectedProject) }} aria-label="编辑项目">
                <Pencil className="h-4 w-4" />
              </Button>
              {Boolean(selectedProject?.gitlab_url?.trim()) && (
                <Button variant="secondary" size="sm" onClick={() => { if (selectedProject) syncMutation.mutate(selectedProject.id) }} disabled={syncingProjectId === selectedProject?.id}>
                  {syncingProjectId === selectedProject?.id ? '同步中...' : '同步提交'}
                </Button>
              )}
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={(v) => store.getState().switchTab(v as DetailTab)} className="mt-4 flex flex-1 flex-col overflow-hidden">
            <TabsList className="w-full justify-start">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="commits">Git 记录</TabsTrigger>
              <TabsTrigger value="iterations">迭代</TabsTrigger>
              <TabsTrigger value="sql">执行事项</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="flex-1 overflow-y-auto space-y-6 pt-4">
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">基本信息</h3>
                <div className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-2 text-sm">
                  <p><span className="text-muted-foreground">描述：</span>{selectedProject?.description || '暂无描述'}</p>
                  {selectedProject?.gitlab_url && <p><span className="text-muted-foreground">GitLab：</span>{selectedProject.gitlab_url}</p>}
                  {selectedProject?.gitlab_branch && <p><span className="text-muted-foreground">分支：</span>{selectedProject.gitlab_branch}</p>}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">统计</h3>
                <div className="grid grid-cols-3 gap-4">
                  <Card><CardContent className="py-4 text-center"><p className="text-2xl font-semibold">{selectedProject?.iteration_count ?? 0}</p><p className="text-xs text-muted-foreground">迭代</p></CardContent></Card>
                  <Card><CardContent className="py-4 text-center"><p className="text-2xl font-semibold">-</p><p className="text-xs text-muted-foreground">提交</p></CardContent></Card>
                  <Card><CardContent className="py-4 text-center"><p className="text-2xl font-semibold">{selectedProject?.pending_sql_count ?? 0}</p><p className="text-xs text-muted-foreground">待执行事项</p></CardContent></Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="commits" className="flex-1 overflow-y-auto space-y-4 pt-4">
              {commitsLoading ? (
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : commitsData?.length ? (
                <div className="space-y-3">
                  {commitsData.map((commit) => (
                    <div key={commit.commit_id} className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-1">
                      <p className="text-sm font-medium">{commit.message}</p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{commit.author_name}</span>
                        <span>{formatCommitDate(commit.committed_at)}</span>
                        <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{commit.commit_id.slice(0, 8)}</code>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无提交记录</p>
              )}
            </TabsContent>

            <TabsContent value="iterations" className="flex-1 overflow-y-auto space-y-4 pt-4">
              {iterationsLoading ? (
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : iterationData?.records?.length ? (
                <div className="space-y-3">
                  {iterationData.records.map((iter) => (
                    <div key={iter.id} className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{iter.name}</p>
                        <Badge variant="soft" tone={ITER_STATUS_TONE[iter.status] || 'neutral'}>
                          {ITER_STATUS_LABEL[iter.status] || iter.status}
                        </Badge>
                      </div>
                      {iter.description && <p className="text-xs text-muted-foreground">{iter.description}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无迭代</p>
              )}
            </TabsContent>

            <TabsContent value="sql" className="flex-1 overflow-y-auto space-y-4 pt-4">
              {sqlLoading ? (
                <p className="text-sm text-muted-foreground">加载中...</p>
              ) : sqlData?.records?.length ? (
                <div className="space-y-3">
                  {sqlData.records.map((sql) => (
                    <div key={sql.id} className="rounded-xl border border-border/60 bg-muted/40 p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{sql.title}</p>
                        <Badge variant="soft" tone={sql.execution_status === 'completed' ? 'success' : 'warning'}>
                          {SQL_STATUS_LABEL[sql.execution_status] || sql.execution_status}
                        </Badge>
                      </div>
                      {sql.executed_at && <p className="text-xs text-muted-foreground">执行时间: {formatDateTime(sql.executed_at)}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">暂无执行事项</p>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

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
