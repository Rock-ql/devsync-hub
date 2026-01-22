import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { PageResult } from '@/api'
import { Plus, Check, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface PendingSql {
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
  const [formData, setFormData] = useState({
    projectId: '',
    iterationId: '',
    title: '',
    content: '',
    remark: '',
  })

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

  const executeMutation = useMutation({
    mutationFn: ({ id, env }: { id: number; env: string }) =>
      api.post('/sql/execute', { id, executedEnv: env }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pending-sql'] })
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

  const handleExecute = (id: number) => {
    const env = prompt('请输入执行环境（如：local/dev/test/prod）', 'prod')
    if (env) {
      executeMutation.mutate({ id, env })
    }
  }

  const handleModalChange = (open: boolean) => {
    setIsModalOpen(open)
    if (!open) {
      resetForm()
    }
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
        <Button onClick={() => { resetForm(); setIsModalOpen(true) }}>
          <Plus className="h-4 w-4" />
          新增 SQL
        </Button>
      </div>

      <Card>
        <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <Label>项目筛选</Label>
            <Select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
            >
              <option value="">全部项目</option>
              {projects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>状态筛选</Label>
            <Select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">全部状态</option>
              <option value="pending">待执行</option>
              <option value="executed">已执行</option>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-6">
        {sqlList?.list?.length ? (
          sqlList.list.map((sql) => (
            <Card key={sql.id} className="transition hover:shadow-xl">
              <CardHeader className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <CardTitle>{sql.title}</CardTitle>
                    <Badge
                      variant="soft"
                      tone={sql.status === 'pending' ? 'warning' : 'success'}
                    >
                      {sql.statusDesc}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {sql.projectName} {sql.iterationName && `/ ${sql.iterationName}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {sql.status === 'pending' && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleExecute(sql.id)}
                    >
                      <Check className="h-4 w-4" />
                      标记已执行
                    </Button>
                  )}
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
                <pre className="rounded-xl border border-border/60 bg-muted/60 p-4 text-sm text-foreground overflow-x-auto">
                  {sql.content}
                </pre>

                {sql.status === 'executed' && (
                  <p className="text-xs text-muted-foreground">
                    执行时间: {sql.executedAt} | 环境: {sql.executedEnv}
                  </p>
                )}

                {sql.remark && (
                  <p className="text-sm text-muted-foreground">备注: {sql.remark}</p>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              暂无 SQL 数据
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={handleModalChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>新增 SQL</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>所属项目 *</Label>
                <Select
                  value={formData.projectId}
                  onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                  required
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
              <Button type="submit" disabled={addMutation.isPending}>
                {addMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
