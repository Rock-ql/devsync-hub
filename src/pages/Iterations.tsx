import { Fragment, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageResult } from '@/api'
import { iterationApi, IterationDetail } from '@/api/iteration'
import { projectApi, Project } from '@/api/project'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import RequirementList from '@/components/requirement/RequirementList'
import { toast } from '@/components/ui/toaster'

const statusStyles: Record<string, string> = {
  planning: 'bg-slate-100 text-slate-700 border-slate-200',
  developing: 'bg-sky-100 text-sky-700 border-sky-200',
  testing: 'bg-amber-100 text-amber-700 border-amber-200',
  released: 'bg-emerald-100 text-emerald-700 border-emerald-200',
}

const statusTones: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  planning: 'neutral',
  developing: 'info',
  testing: 'warning',
  released: 'success',
}

const statusLabels: Record<string, string> = {
  planning: '规划中',
  developing: '开发中',
  testing: '测试中',
  released: '已上线',
}

export default function Iterations() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIteration, setEditingIteration] = useState<IterationDetail | null>(null)
  const [expandedIterations, setExpandedIterations] = useState<number[]>([])
  const [formData, setFormData] = useState({
    project_ids: [] as number[],
    name: '',
    description: '',
    status: 'planning',
    start_date: '',
    end_date: '',
  })

  const { data: iterations, isLoading } = useQuery<PageResult<IterationDetail>>({
    queryKey: ['iterations'],
    queryFn: () => iterationApi.list({ page: 1, size: 100 }),
  })

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-all'],
    queryFn: () => projectApi.listAll(),
  })

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) => iterationApi.add(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      setIsModalOpen(false)
      resetForm()
      toast.success('迭代已创建')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`创建失败：${message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number } & typeof formData) => iterationApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      setIsModalOpen(false)
      resetForm()
      toast.success('迭代已更新')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`更新失败：${message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => iterationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      toast.success('迭代已删除')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`删除失败：${message}`)
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      iterationApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      toast.success('状态已更新')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`状态更新失败：${message}`)
    },
  })

  const resetForm = () => {
    setFormData({
      project_ids: [],
      name: '',
      description: '',
      status: 'planning',
      start_date: '',
      end_date: '',
    })
    setEditingIteration(null)
  }

  const handleEdit = (iteration: IterationDetail) => {
    setEditingIteration(iteration)
    setFormData({
      project_ids: iteration.project_ids || (iteration.project_id ? [iteration.project_id] : []),
      name: iteration.name,
      description: iteration.description || '',
      status: iteration.status,
      start_date: iteration.start_date || '',
      end_date: iteration.end_date || '',
    })
    setIsModalOpen(true)
  }

  const displayIterationProjects = (iteration: IterationDetail) => {
    const names = iteration.project_names?.length
      ? iteration.project_names
      : []

    if (!names.length) return '未关联项目'
    const visible = names.slice(0, 3)
    const extra = names.length - visible.length
    return extra > 0 ? `${visible.join(', ')} +${extra}` : visible.join(', ')
  }

  const confirmDeleteIteration = (iteration: IterationDetail) => {
    const requirementCount = iteration.requirement_count ?? 0
    const sqlCount = iteration.pending_sql_count ?? 0
    return confirm(
      `删除迭代「${iteration.name}」将级联删除 ${requirementCount} 条需求及 ${sqlCount} 条 SQL（含执行记录），是否继续？`
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      toast.error('结束日期不能早于开始日期')
      return
    }

    const payload = {
      ...formData,
      name: formData.name.trim(),
      description: formData.description.trim(),
    }

    if (!payload.name) {
      toast.error('迭代名称不能为空')
      return
    }

    if (editingIteration) {
      updateMutation.mutate({ id: editingIteration.id, ...payload })
    } else {
      addMutation.mutate(payload)
    }
  }

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      resetForm()
    }
  }

  const toggleRequirement = (iterationId: number) => {
    setExpandedIterations((prev) => (
      prev.includes(iterationId)
        ? prev.filter((id) => id !== iterationId)
        : [...prev, iterationId]
    ))
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <SectionLabel>ITERATIONS</SectionLabel>
          <div>
            <h1 className="text-3xl font-display">迭代管理</h1>
            <p className="mt-2 text-sm text-muted-foreground">统一追踪迭代状态与交付节奏</p>
          </div>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true) }}>
          <Plus className="h-4 w-4" />
          新增迭代
        </Button>
      </div>

      <Card className="hidden overflow-hidden lg:block">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/60">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-6 py-4">迭代名称</th>
                <th className="px-6 py-4">所属项目</th>
                <th className="px-6 py-4">状态</th>
                <th className="px-6 py-4">时间范围</th>
                <th className="px-6 py-4">待执行 SQL</th>
                <th className="px-6 py-4">关联需求</th>
                <th className="px-6 py-4 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {iterations?.records?.length ? (
                iterations.records.map((iteration) => {
                  const isExpanded = expandedIterations.includes(iteration.id)
                  return (
                    <Fragment key={iteration.id}>
                      <tr className="hover:bg-muted/40">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {iteration.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {displayIterationProjects(iteration)}
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={iteration.status}
                            onValueChange={(value) => statusMutation.mutate({ id: iteration.id, status: value })}
                          >
                            <SelectTrigger size="md" className={statusStyles[iteration.status]}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="planning">规划中</SelectItem>
                              <SelectItem value="developing">开发中</SelectItem>
                              <SelectItem value="testing">测试中</SelectItem>
                              <SelectItem value="released">已上线</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {iteration.start_date && iteration.end_date
                            ? `${iteration.start_date} ~ ${iteration.end_date}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {iteration.pending_sql_count > 0 ? (
                            <Badge tone="warning" variant="soft">
                              {iteration.pending_sql_count} 条
                            </Badge>
                          ) : (
                            <Badge tone="success" variant="soft">
                              0
                            </Badge>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 px-2 text-xs"
                            onClick={() => toggleRequirement(iteration.id)}
                          >
                            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {iteration.requirement_count || 0} 条
                          </Button>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0"
                            onClick={() => handleEdit(iteration)}
                            aria-label="编辑迭代"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                            onClick={() => {
                              if (confirmDeleteIteration(iteration)) {
                                deleteMutation.mutate(iteration.id)
                              }
                            }}
                            aria-label="删除迭代"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr>
                          <td colSpan={7} className="px-6 pb-6 pt-2 bg-muted/20">
                            <RequirementList
                              iterationId={iteration.id}
                              iterationName={iteration.name}
                              projects={projects || []}
                            />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-sm text-muted-foreground"
                  >
                    暂无迭代，请先新增迭代
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid gap-4 lg:hidden">
        {iterations?.records?.length ? (
          iterations.records.map((iteration) => (
            <Card key={iteration.id}>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">{iteration.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{displayIterationProjects(iteration)}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTones[iteration.status] || 'neutral'} variant="soft">
                    {statusLabels[iteration.status] || iteration.status}
                  </Badge>
                  {iteration.pending_sql_count > 0 ? (
                    <Badge tone="warning" variant="soft">
                      {iteration.pending_sql_count} 条 SQL
                    </Badge>
                  ) : (
                    <Badge tone="success" variant="soft">
                      SQL 清零
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1 px-2 text-xs"
                    onClick={() => toggleRequirement(iteration.id)}
                  >
                    {expandedIterations.includes(iteration.id)
                      ? <ChevronDown className="h-4 w-4" />
                      : <ChevronRight className="h-4 w-4" />}
                    需求 {iteration.requirement_count || 0} 条
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {iteration.start_date && iteration.end_date
                    ? `${iteration.start_date} ~ ${iteration.end_date}`
                    : '未设置时间'}
                </div>
                <div className="flex items-center justify-between">
                  <Select
                    value={iteration.status}
                    onValueChange={(value) => statusMutation.mutate({ id: iteration.id, status: value })}
                  >
                    <SelectTrigger size="md" className={statusStyles[iteration.status]}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planning">规划中</SelectItem>
                      <SelectItem value="developing">开发中</SelectItem>
                      <SelectItem value="testing">测试中</SelectItem>
                      <SelectItem value="released">已上线</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      onClick={() => handleEdit(iteration)}
                      aria-label="编辑迭代"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => {
                        if (confirmDeleteIteration(iteration)) {
                          deleteMutation.mutate(iteration.id)
                        }
                      }}
                      aria-label="删除迭代"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {expandedIterations.includes(iteration.id) ? (
                  <div className="rounded-xl border border-border/60 bg-muted/40 p-4">
                    <RequirementList
                      iterationId={iteration.id}
                      iterationName={iteration.name}
                      projects={projects || []}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              暂无迭代，请先新增迭代
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingIteration ? '编辑迭代' : '新增迭代'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>所属项目</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {projects?.length ? projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground"
                  >
                    <input
                      type="checkbox"
                      checked={formData.project_ids.includes(project.id)}
                      onChange={() => {
                        setFormData((prev) => {
                          if (prev.project_ids.includes(project.id)) {
                            return { ...prev, project_ids: prev.project_ids.filter((id) => id !== project.id) }
                          }
                          return { ...prev, project_ids: [...prev.project_ids, project.id] }
                        })
                      }}
                      className="h-4 w-4 accent-[hsl(var(--accent))]"
                    />
                    <span className="text-foreground">{project.name}</span>
                  </label>
                )) : (
                  <p className="text-sm text-muted-foreground">暂无项目可选</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>迭代名称 *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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
    </div>
  )
}
