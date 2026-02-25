import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PageResult } from '@/api'
import { iterationApi, IterationDetail } from '@/api/iteration'
import { projectApi, Project } from '@/api/project'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Textarea } from '@/components/ui/textarea'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import IterationCard from '@/components/iteration/IterationCard'
import { toast } from '@/components/ui/toaster'

export default function Iterations() {
  const queryClient = useQueryClient()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingIteration, setEditingIteration] = useState<IterationDetail | null>(null)
  const [expandedIterations, setExpandedIterations] = useState<number[]>([])
  const { dialogState, openConfirm, closeConfirm, handleConfirm } = useConfirmDialog()
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

  const requestDeleteIteration = (iteration: IterationDetail) => {
    const requirementCount = iteration.requirement_count ?? 0
    const sqlCount = iteration.pending_sql_count ?? 0
    openConfirm(
      {
        title: '删除迭代？',
        description: `删除「${iteration.name}」将级联删除 ${requirementCount} 条需求及 ${sqlCount} 条 SQL（含执行记录）。`,
        confirmText: '删除',
      },
      () => deleteMutation.mutate(iteration.id),
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
    return <div className="py-12 text-center text-muted-foreground">加载中...</div>
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

      <div className="space-y-4">
        {iterations?.records?.length ? (
          iterations.records.map((iteration) => (
            <IterationCard
              key={iteration.id}
              iteration={iteration}
              projects={projects || []}
              isExpanded={expandedIterations.includes(iteration.id)}
              onToggleRequirements={() => toggleRequirement(iteration.id)}
              onStatusChange={(status) => statusMutation.mutate({ id: iteration.id, status })}
              onEdit={() => handleEdit(iteration)}
              onDelete={() => requestDeleteIteration(iteration)}
            />
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
