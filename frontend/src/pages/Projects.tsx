import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { PageResult } from '@/api'
import { Plus, Pencil, Trash2, GitBranch, GitCommit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Textarea } from '@/components/ui/textarea'

interface Project {
  id: number
  name: string
  description: string
  gitlabUrl: string
  gitlabProjectId: number
  gitlabBranch: string
  gitlabConfigured: boolean
  state: number
  iterationCount: number
  pendingSqlCount: number
  createdAt: string
}

interface GitCommitRecord {
  id: number
  commitId: string
  message: string
  authorName: string
  authorEmail: string
  committedAt: string
  additions: number
  deletions: number
}

export default function Projects() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isCommitsModalOpen, setIsCommitsModalOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gitlabUrl: '',
    gitlabToken: '',
    gitlabProjectId: '',
    gitlabBranch: 'main',
  })

  const { data, isLoading } = useQuery<PageResult<Project>>({
    queryKey: ['projects'],
    queryFn: () => api.post('/project/list', { pageNum: 1, pageSize: 100 }),
  })

  const { data: commitsData, isLoading: commitsLoading } = useQuery<GitCommitRecord[]>({
    queryKey: ['project-commits', selectedProject?.id],
    queryFn: () => api.get(`/project/commits/${selectedProject!.id}`),
    enabled: !!selectedProject && isCommitsModalOpen,
  })

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => api.post('/project/add', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number } & typeof formData) => api.post('/project/update', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.post(`/project/delete/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const syncMutation = useMutation({
    mutationFn: (id: number) => api.post(`/project/sync-commits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      gitlabUrl: '',
      gitlabToken: '',
      gitlabProjectId: '',
      gitlabBranch: 'main',
    })
    setEditingProject(null)
  }

  const handleEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      name: project.name,
      description: project.description || '',
      gitlabUrl: project.gitlabUrl || '',
      gitlabToken: '',
      gitlabProjectId: project.gitlabProjectId?.toString() || '',
      gitlabBranch: project.gitlabBranch || 'main',
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

  const handleViewCommits = (project: Project) => {
    setSelectedProject(project)
    setIsCommitsModalOpen(true)
  }

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      resetForm()
    }
  }

  const handleCommitsModalChange = (open: boolean) => {
    setIsCommitsModalOpen(open)
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
        {data?.list?.length ? (
          data.list.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer transition-all hover:shadow-xl"
              onClick={() => handleViewCommits(project)}
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
                    {project.iterationCount} 个迭代
                  </Badge>
                  {project.pendingSqlCount > 0 ? (
                    <Badge tone="warning" variant="soft">
                      {project.pendingSqlCount} 条 SQL 待执行
                    </Badge>
                  ) : (
                    <Badge tone="success" variant="soft">
                      SQL 清零
                    </Badge>
                  )}
                  {project.gitlabConfigured && (
                    <Badge tone="accent" variant="outline">
                      GitLab 已连接
                    </Badge>
                  )}
                </div>

                {project.gitlabConfigured && (
                  <div
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <GitBranch className="h-4 w-4" />
                      <span>{project.gitlabBranch}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => syncMutation.mutate(project.id)}
                      disabled={syncMutation.isPending}
                    >
                      {syncMutation.isPending ? '同步中...' : '同步提交'}
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
                value={formData.gitlabUrl}
                onChange={(e) => setFormData({ ...formData, gitlabUrl: e.target.value })}
                placeholder="https://gitlab.com/user/project"
              />
            </div>
            <div className="space-y-2">
              <Label>GitLab Access Token</Label>
              <Input
                type="password"
                value={formData.gitlabToken}
                onChange={(e) => setFormData({ ...formData, gitlabToken: e.target.value })}
                placeholder={editingProject ? '留空则不修改' : ''}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>项目 ID</Label>
                <Input
                  type="number"
                  value={formData.gitlabProjectId}
                  onChange={(e) => setFormData({ ...formData, gitlabProjectId: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>默认分支</Label>
                <Input
                  value={formData.gitlabBranch}
                  onChange={(e) => setFormData({ ...formData, gitlabBranch: e.target.value })}
                />
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

      <Dialog open={isCommitsModalOpen} onOpenChange={handleCommitsModalChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GitCommit className="h-5 w-5 text-[hsl(var(--accent))]" />
              {selectedProject?.name} - 提交记录
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-2">
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
                      <p className="text-sm font-medium text-foreground truncate">
                        {commit.message}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span>{commit.authorName}</span>
                        <span>{formatCommitDate(commit.committedAt)}</span>
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
                    <code className="text-xs text-muted-foreground font-mono">
                      {commit.commitId.substring(0, 8)}
                    </code>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
                暂无提交记录，请先配置 GitLab 并同步提交
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
