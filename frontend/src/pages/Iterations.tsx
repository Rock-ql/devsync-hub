import { Fragment, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { PageResult } from '@/api'
import { ChevronDown, ChevronRight, Plus, Pencil, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import RequirementList from '@/components/requirement/RequirementList'

interface Iteration {
  id: number
  projectId: number
  projectName: string
  name: string
  description: string
  status: string
  statusDesc: string
  startDate: string
  endDate: string
  pendingSqlCount: number
  requirementCount: number
}

interface Project {
  id: number
  name: string
}

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

export default function Iterations() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIteration, setEditingIteration] = useState<Iteration | null>(null)
  const [expandedIterations, setExpandedIterations] = useState<number[]>([])
  const [formData, setFormData] = useState({
    projectId: '',
    name: '',
    description: '',
    status: 'planning',
    startDate: '',
    endDate: '',
  })

  const { data: iterations, isLoading } = useQuery<PageResult<Iteration>>({
    queryKey: ['iterations'],
    queryFn: () => api.post('/iteration/list', { pageNum: 1, pageSize: 100 }),
  })

  const { data: projects } = useQuery<Project[]>({
    queryKey: ['projects-all'],
    queryFn: () => api.get('/project/all'),
  })

  const addMutation = useMutation({
    mutationFn: (data: typeof formData) =>
      api.post('/iteration/add', { ...data, projectId: parseInt(data.projectId) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number } & typeof formData) => api.post('/iteration/update', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      setIsModalOpen(false)
      resetForm()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.post(`/iteration/delete/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
    },
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.post(`/iteration/status/${id}/${status}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
    },
  })

  const resetForm = () => {
    setFormData({
      projectId: '',
      name: '',
      description: '',
      status: 'planning',
      startDate: '',
      endDate: '',
    })
    setEditingIteration(null)
  }

  const handleEdit = (iteration: Iteration) => {
    setEditingIteration(iteration)
    setFormData({
      projectId: iteration.projectId.toString(),
      name: iteration.name,
      description: iteration.description || '',
      status: iteration.status,
      startDate: iteration.startDate || '',
      endDate: iteration.endDate || '',
    })
    setIsModalOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editingIteration) {
      updateMutation.mutate({ id: editingIteration.id, ...formData })
    } else {
      addMutation.mutate(formData)
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
              {iterations?.list?.length ? (
                iterations.list.map((iteration) => {
                  const isExpanded = expandedIterations.includes(iteration.id)
                  return (
                    <Fragment key={iteration.id}>
                      <tr className="hover:bg-muted/40">
                        <td className="px-6 py-4 text-sm font-medium text-foreground">
                          {iteration.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {iteration.projectName}
                        </td>
                        <td className="px-6 py-4">
                          <Select
                            value={iteration.status}
                            onChange={(e) => statusMutation.mutate({ id: iteration.id, status: e.target.value })}
                            className={`h-10 text-xs ${statusStyles[iteration.status]}`}
                          >
                            <option value="planning">规划中</option>
                            <option value="developing">开发中</option>
                            <option value="testing">测试中</option>
                            <option value="released">已上线</option>
                          </Select>
                        </td>
                        <td className="px-6 py-4 text-sm text-muted-foreground">
                          {iteration.startDate && iteration.endDate
                            ? `${iteration.startDate} ~ ${iteration.endDate}`
                            : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm">
                          {iteration.pendingSqlCount > 0 ? (
                            <Badge tone="warning" variant="soft">
                              {iteration.pendingSqlCount} 条
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
                            {iteration.requirementCount || 0} 条
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
                              if (confirm('确定要删除此迭代吗？')) {
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
        {iterations?.list?.length ? (
          iterations.list.map((iteration) => (
            <Card key={iteration.id}>
              <CardHeader className="space-y-2">
                <CardTitle className="text-base">{iteration.name}</CardTitle>
                <p className="text-sm text-muted-foreground">{iteration.projectName}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTones[iteration.status] || 'neutral'} variant="soft">
                    {iteration.statusDesc}
                  </Badge>
                  {iteration.pendingSqlCount > 0 ? (
                    <Badge tone="warning" variant="soft">
                      {iteration.pendingSqlCount} 条 SQL
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
                    需求 {iteration.requirementCount || 0} 条
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">
                  {iteration.startDate && iteration.endDate
                    ? `${iteration.startDate} ~ ${iteration.endDate}`
                    : '未设置时间'}
                </div>
                <div className="flex items-center justify-between">
                  <Select
                    value={iteration.status}
                    onChange={(e) => statusMutation.mutate({ id: iteration.id, status: e.target.value })}
                    className={`h-10 text-xs ${statusStyles[iteration.status]}`}
                  >
                    <option value="planning">规划中</option>
                    <option value="developing">开发中</option>
                    <option value="testing">测试中</option>
                    <option value="released">已上线</option>
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
                        if (confirm('确定要删除此迭代吗？')) {
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
              <Label>所属项目 *</Label>
              <Select
                value={formData.projectId}
                onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                required
                disabled={!!editingIteration}
              >
                <option value="">请选择项目</option>
                {projects?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
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
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
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
