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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from '@/components/ui/toaster'

type DetailTab = 'overview' | 'commits' | 'iterations' | 'sql'

const iterationStatusTone: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  planning: 'neutral',
  developing: 'info',
  testing: 'warning',
  released: 'success',
}

const iterationStatusLabel: Record<string, string> = {
  planning: '规划中',
  developing: '开发中',
  testing: '测试中',
  released: '已发布',
}

const sqlStatusLabel: Record<string, string> = {
  pending: '待执行',
  partial: '部分执行',
  executed: '已执行',
}

export default function Projects() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<DetailTab>('overview')
  const [selectedProject, setSelectedProject] = useState<ProjectDetail | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [syncingProjectId, setSyncingProjectId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gitlab_url: '',
    gitlab_token: '',
    gitlab_project_id: '',
    gitlab_branch: '',
  })

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
    queryFn: () => iterationApi.list({
      page: 1,
      size: 100,
      project_id: selectedProject?.id,
    }),
    enabled: !!selectedProject && isDetailOpen && activeTab === 'iterations',
  })

  const { data: sqlData, isLoading: sqlLoading } = useQuery<PageResult<PendingSqlDetail>>({
    queryKey: ['project-sql', selectedProject?.id],
    queryFn: () => sqlApi.list({
      page: 1,
      size: 100,
      project_id: selectedProject?.id,
    }),
    enabled: !!selectedProject && isDetailOpen && activeTab === 'sql',
  })

  // 仅需填写 URL：后端会按“项目 Token > 全局 Token”回退解析
  const canFetchBranches = Boolean(formData.gitlab_url)

  // 防抖：延迟触发分支查询，避免每次按键都请求
  const [debouncedBranchParams, setDebouncedBranchParams] = useState({
    gitlab_url: '',
    gitlab_token: '',
    gitlab_project_id: '',
    project_id: undefined as number | undefined,
  })
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedBranchParams({
        gitlab_url: formData.gitlab_url,
        gitlab_token: formData.gitlab_token,
        gitlab_project_id: formData.gitlab_project_id,
        project_id: editingProject?.id,
      })
    }, 500)
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [formData.gitlab_url, formData.gitlab_token, formData.gitlab_project_id, editingProject?.id])

  const canFetchDebouncedBranches = Boolean(debouncedBranchParams.gitlab_url)

  const branchQuery = useQuery<string[]>({
    queryKey: ['gitlab-branches', debouncedBranchParams.gitlab_url, debouncedBranchParams.gitlab_token, debouncedBranchParams.gitlab_project_id, debouncedBranchParams.project_id],
    queryFn: () => {
      const projectId = debouncedBranchParams.gitlab_project_id?.toString().trim()
      const numericProjectId = projectId ? Number(projectId) : Number.NaN
      const safeProjectId = Number.isFinite(numericProjectId) && numericProjectId > 0
        ? numericProjectId
        : undefined
      return projectApi.listBranches({
        gitlab_url: debouncedBranchParams.gitlab_url,
        gitlab_token: debouncedBranchParams.gitlab_token || undefined,
        gitlab_project_id: safeProjectId,
        project_id: debouncedBranchParams.project_id,
      })
    },
    enabled: canFetchDebouncedBranches,
  })

  // 当分支列表加载完成后，自动选中默认分支
  useEffect(() => {
    const branches = branchQuery.data
    if (!branches || branches.length === 0) {
      return
    }
    const currentBranch = formData.gitlab_branch
    // 如果当前值为空，或当前值不在远程分支列表中，自动选中第一个分支
    if (!currentBranch || !branches.includes(currentBranch)) {
      setFormData((prev) => ({ ...prev, gitlab_branch: branches[0] }))
    }
  }, [branchQuery.data])

  const branchOptions = useMemo(() => {
    const options: string[] = []
    const pushUnique = (value?: string) => {
      if (!value) {
        return
      }
      const normalized = value.trim()
      if (!normalized || options.includes(normalized)) {
        return
      }
      options.push(normalized)
    }

    if (canFetchBranches) {
      branchQuery.data?.forEach((name) => pushUnique(name))
    }
    // 保留当前已选中的值
    pushUnique(formData.gitlab_branch)
    return options
  }, [branchQuery.data, formData.gitlab_branch, canFetchBranches])

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => projectApi.add({
      ...data,
      gitlab_project_id: data.gitlab_project_id ? Number(data.gitlab_project_id) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number } & typeof formData) => projectApi.update({
      ...data,
      gitlab_project_id: data.gitlab_project_id ? Number(data.gitlab_project_id) : undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setIsModalOpen(false)
      resetForm()
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
    onMutate: (id: number) => {
      setSyncingProjectId(id)
    },
    onSuccess: (addedCount, id) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['project-commits', id] })
      if (addedCount > 0) {
        toast.success(`同步成功，新增 ${addedCount} 条提交`)
      } else {
        toast.success('同步完成，暂无新增提交')
      }
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`同步失败：${message}`)
    },
    onSettled: () => {
      setSyncingProjectId(null)
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      gitlab_url: '',
      gitlab_token: '',
      gitlab_project_id: '',
      gitlab_branch: '',
    })
    setEditingProject(null)
  }

  const handleEdit = (project: Project | ProjectDetail) => {
    setEditingProject(project)
    setFormData({
      name: project.name,
      description: project.description || '',
      gitlab_url: project.gitlab_url || '',
      gitlab_token: '',
      gitlab_project_id: project.gitlab_project_id?.toString() || '',
      gitlab_branch: project.gitlab_branch || '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingProject) {
      updateMutation.mutate({ id: editingProject.id, ...formData })
    } else {
      addMutation.mutate(formData)
    }
  }

  const handleViewDetail = (project: ProjectDetail) => {
    setSelectedProject(project)
    setActiveTab('overview')
    setIsDetailOpen(true)
  }

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      resetForm()
    }
  }

  const handleDetailChange = (open: boolean) => {
    setIsDetailOpen(open)
    if (!open) {
      setSelectedProject(null)
    }
  }

  const formatCommitDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatDateTime = (dateStr?: string | null) => {
    if (!dateStr) {
      return '-'
    }
    const date = new Date(dateStr)
    if (Number.isNaN(date.getTime())) {
      return dateStr
    }
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
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
        <Button onClick={() => { resetForm(); setIsModalOpen(true) }}>
          <Plus className="h-4 w-4" />
          新增项目
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {data?.records?.length ? (
          data.records.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-all hover:shadow-xl"
              onClick={() => handleViewDetail(project)}
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0"
                    onClick={() => handleEdit(project)}
                    aria-label="编辑项目"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => {
                      if (confirm('确定要删除此项目吗？')) {
                        deleteMutation.mutate(project.id)
                      }
                    }}
                    aria-label="删除项目"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="info" variant="soft">
                    {project.iteration_count ?? 0} 个迭代
                  </Badge>
                  {(project.pending_sql_count ?? 0) > 0 ? (
                    <Badge tone="warning" variant="soft">
                      {project.pending_sql_count ?? 0} 条 SQL 待执行
                    </Badge>
                  ) : (
                    <Badge tone="success" variant="soft">
                      SQL 清零
                    </Badge>
                  )}
                  {Boolean(project.gitlab_url?.trim()) && (
                    <Badge tone="accent" variant="outline">
                      GitLab 已连接
                    </Badge>
                  )}
                </div>

                {Boolean(project.gitlab_url?.trim()) && (
                  <div
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      <span>{project.gitlab_branch}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncMutation.mutate(project.id)}
                      disabled={syncingProjectId === project.id}
                    >
                      {syncingProjectId === project.id ? '同步中...' : '同步提交'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card className="md:col-span-2 xl:col-span-3">
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
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>项目描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>GitLab 仓库地址</Label>
              <Input
                value={formData.gitlab_url}
                onChange={(e) => setFormData({ ...formData, gitlab_url: e.target.value })}
                placeholder="https://gitlab.com/user/project"
              />
            </div>
            <div className="space-y-2">
              <Label>GitLab Access Token</Label>
              <Input
                type="password"
                value={formData.gitlab_token}
                onChange={(e) => setFormData({ ...formData, gitlab_token: e.target.value })}
                placeholder={editingProject ? '留空则不修改（可使用全局 Token）' : '留空则使用全局 Token'}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>项目 ID</Label>
                <Input
                  type="number"
                  value={formData.gitlab_project_id}
                  onChange={(e) => setFormData({ ...formData, gitlab_project_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>默认分支</Label>
                <Select value={formData.gitlab_branch || undefined} onValueChange={(value) => setFormData({ ...formData, gitlab_branch: value })}>
                  <SelectTrigger disabled={branchQuery.isFetching}>
                    <SelectValue placeholder="请选择分支" />
                  </SelectTrigger>
                  <SelectContent>
                    {branchOptions.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {branchQuery.isFetching && (
                  <p className="text-xs text-muted-foreground">正在拉取分支列表...</p>
                )}
                {!canFetchBranches && (
                  <p className="text-xs text-muted-foreground">
                    填写 GitLab 地址后可动态获取分支（优先项目 Token，其次全局 Token）
                  </p>
                )}
                {branchQuery.isError && (
                  <p className="text-xs text-red-600">
                    分支获取失败：{(branchQuery.error as Error).message}
                  </p>
                )}
              </div>
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

      <Sheet open={isDetailOpen} onOpenChange={handleDetailChange}>
        <SheetContent className="flex h-full flex-col">
          <SheetHeader className="flex flex-row items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              onClick={() => setIsDetailOpen(false)}
              aria-label="返回"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <SheetTitle className="min-w-0 flex-1 truncate">
              {selectedProject?.name || '项目详情'}
            </SheetTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => selectedProject && handleEdit(selectedProject)}
                aria-label="编辑项目"
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                onClick={() => {
                  if (selectedProject && confirm('确定要删除此项目吗？')) {
                    deleteMutation.mutate(selectedProject.id, {
                      onSuccess: () => {
                        setIsDetailOpen(false)
                        setSelectedProject(null)
                      },
                    })
                  }
                }}
                aria-label="删除项目"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </SheetHeader>
          <p className="mt-2 text-sm text-muted-foreground">
            {selectedProject?.description || '暂无描述'}
          </p>
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as DetailTab)}
            className="mt-6 flex min-h-0 flex-1 flex-col"
          >
            <TabsList className="self-start">
              <TabsTrigger value="overview">概览</TabsTrigger>
              <TabsTrigger value="commits">Git记录</TabsTrigger>
              <TabsTrigger value="iterations">迭代</TabsTrigger>
              <TabsTrigger value="sql">SQL</TabsTrigger>
            </TabsList>
            <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
              <TabsContent value="overview" className="mt-0 space-y-4">
                {selectedProject ? (
                  <>
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">基本信息</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">创建时间</span>
                          <span>{formatDateTime(selectedProject.created_at)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">迭代数量</span>
                          <span>{selectedProject.iteration_count} 个</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">待执行 SQL</span>
                          <span>{selectedProject.pending_sql_count} 条</span>
                        </div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-3">
                        <CardTitle className="text-base">GitLab 配置</CardTitle>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => selectedProject && syncMutation.mutate(selectedProject.id)}
                          disabled={!selectedProject?.gitlab_url?.trim() || syncingProjectId === selectedProject?.id}
                        >
                          {syncingProjectId === selectedProject?.id ? '同步中...' : '同步提交'}
                        </Button>
                      </CardHeader>
                      <CardContent className="space-y-3 text-sm">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-muted-foreground">仓库地址</span>
                          <span className="max-w-[320px] truncate text-right">
                            {selectedProject.gitlab_url || '-'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">项目 ID</span>
                          <span>{selectedProject.gitlab_project_id || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">默认分支</span>
                          <span>{selectedProject.gitlab_branch || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">连接状态</span>
                          {selectedProject.has_gitlab_config ? (
                            <Badge tone="success" variant="soft">
                              已连接
                            </Badge>
                          ) : (
                            <Badge tone="neutral" variant="soft">
                              未连接
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </>
                ) : (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    暂无项目信息
                  </div>
                )}
              </TabsContent>

              <TabsContent value="commits" className="mt-0 space-y-3">
                {commitsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">加载中...</div>
                ) : commitsData && commitsData.length > 0 ? (
                  commitsData.map((commit) => (
                    <div
                      key={commit.id}
                      className="rounded-xl border border-border bg-background/60 p-4 transition hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p
                            className="text-sm font-medium text-foreground whitespace-pre-wrap break-words"
                            title={commit.message}
                          >
                            {commit.message}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                            <span>{commit.author_name}</span>
                            <span>{formatCommitDate(commit.committed_at)}</span>
                            {commit.branch && (
                              <Badge variant="soft" tone="accent" className="text-xs">
                                <GitBranch className="mr-1 h-3 w-3" />
                                {commit.branch}
                              </Badge>
                            )}
                            {(commit.additions > 0 || commit.deletions > 0) && (
                              <span>
                                <span className="text-emerald-600">
                                  +{commit.additions}
                                </span>
                                {' / '}
                                <span className="text-red-600">
                                  -{commit.deletions}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                        <code
                          className="text-xs text-muted-foreground font-mono break-all text-right"
                          title={commit.commit_id}
                        >
                          {commit.commit_id}
                        </code>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    暂无提交记录，请先配置 GitLab 并同步提交
                  </div>
                )}
              </TabsContent>

              <TabsContent value="iterations" className="mt-0 space-y-3">
                {iterationsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">加载中...</div>
                ) : iterationData && iterationData.records.length > 0 ? (
                  iterationData.records.map((iteration) => (
                    <div
                      key={iteration.id}
                      className="rounded-xl border border-border bg-background/60 p-4 transition hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {iteration.name}
                          </p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {iteration.start_date && iteration.end_date
                              ? `${iteration.start_date} ~ ${iteration.end_date}`
                              : '时间范围未设置'}
                          </div>
                        </div>
                        <Badge
                          variant="soft"
                          tone={iterationStatusTone[iteration.status] || 'neutral'}
                        >
                          {iterationStatusLabel[iteration.status] || iteration.status}
                        </Badge>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        待执行 SQL：{iteration.pending_sql_count ?? 0} 条
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    暂无迭代数据
                  </div>
                )}
              </TabsContent>

              <TabsContent value="sql" className="mt-0 space-y-3">
                {sqlLoading ? (
                  <div className="text-center py-8 text-muted-foreground">加载中...</div>
                ) : sqlData && sqlData.records.length > 0 ? (
                  sqlData.records.map((sql) => (
                    <div
                      key={sql.id}
                      className="rounded-xl border border-border bg-background/60 p-4 transition hover:bg-muted/60"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground truncate">
                            {sql.title}
                          </p>
                          <div className="mt-2 text-xs text-muted-foreground">
                            {sql.iteration_name ? `迭代：${sql.iteration_name}` : '未关联迭代'}
                          </div>
                          {sql.status === 'executed' && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              执行时间: {formatDateTime(sql.executed_at)} | 环境: {sql.executed_env || '-'}
                            </div>
                          )}
                        </div>
                        <Badge
                          variant="soft"
                          tone={sql.status === 'pending' ? 'warning' : 'success'}
                        >
                          {sqlStatusLabel[sql.status] || sql.status}
                        </Badge>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                    暂无 SQL 数据
                  </div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  )
}
