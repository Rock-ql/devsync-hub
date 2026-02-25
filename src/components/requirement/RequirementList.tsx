import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PageResult } from '@/api'
import { Link2, Pencil, Plus, Trash2, GitBranch } from 'lucide-react'
import { requirementApi, RequirementItem } from '@/api/requirement'
import RequirementDialog from '@/components/requirement/RequirementDialog'
import RequirementCommitsDialog from '@/components/requirement/RequirementCommitsDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from '@/components/ui/toaster'

const STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  presented: 'neutral',
  pending_dev: 'neutral',
  developing: 'info',
  integrating: 'info',
  pending_test: 'warning',
  testing: 'warning',
  pending_acceptance: 'warning',
  pending_release: 'warning',
  released: 'success',
}

interface ProjectOption {
  id: number
  name: string
}

interface RequirementListProps {
  iterationId: number
  iterationName: string
  projects: ProjectOption[]
}

const PAGE_SIZE = 10

export default function RequirementList({ iterationId, iterationName, projects }: RequirementListProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RequirementItem | null>(null)
  const [commitsDialogOpen, setCommitsDialogOpen] = useState(false)
  const [commitsRequirement, setCommitsRequirement] = useState<RequirementItem | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<RequirementItem | null>(null)
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)

  const statusOptions = [
    { code: 'presented', desc: '已宣讲' },
    { code: 'pending_dev', desc: '待研发' },
    { code: 'developing', desc: '开发中' },
    { code: 'integrating', desc: '联调中' },
    { code: 'pending_test', desc: '待测试' },
    { code: 'testing', desc: '测试中' },
    { code: 'pending_acceptance', desc: '待验收' },
    { code: 'pending_release', desc: '待上线' },
    { code: 'released', desc: '已上线' },
  ]

  const normalizedKeyword = keyword.trim()

  useEffect(() => {
    setPage(1)
  }, [iterationId, normalizedKeyword])

  const { data: requirementPage, isLoading, isFetching } = useQuery<PageResult<RequirementItem>>({
    queryKey: ['requirements-page', iterationId, page, normalizedKeyword],
    queryFn: () => requirementApi.listPage({
      iteration_id: iterationId,
      page,
      size: PAGE_SIZE,
      keyword: normalizedKeyword || undefined,
    }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => requirementApi.remove(id),
    onSuccess: () => {
      toast.success('需求已删除')
      setDeleteTarget(null)
      queryClient.invalidateQueries({ queryKey: ['requirements-page', iterationId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) => requirementApi.updateStatus({ id, status }),
    onSuccess: () => {
      toast.success('状态已更新')
      queryClient.invalidateQueries({ queryKey: ['requirements-page', iterationId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const getAdjacentStatuses = (current?: string) => {
    const normalized = current || 'presented'
    const index = statusOptions.findIndex((item) => item.code === normalized)
    if (index < 0) {
      return statusOptions.slice(0, 1)
    }
    const candidates: Array<{ code: string; desc: string }> = []
    if (index - 1 >= 0) candidates.push(statusOptions[index - 1])
    candidates.push(statusOptions[index])
    if (index + 1 < statusOptions.length) candidates.push(statusOptions[index + 1])
    return candidates
  }

  const handleOpenAdd = () => {
    setEditingItem(null)
    setDialogOpen(true)
  }

  const handleEdit = (item: RequirementItem) => {
    setEditingItem(item)
    setDialogOpen(true)
  }

  const handleOpenCommits = (item: RequirementItem) => {
    setCommitsRequirement(item)
    setCommitsDialogOpen(true)
  }

  const handleDelete = (item: RequirementItem) => {
    setDeleteTarget(item)
  }

  const confirmDelete = () => {
    if (!deleteTarget || deleteMutation.isPending) return
    deleteMutation.mutate(deleteTarget.id)
  }

  const displayProjects = (names: string[]) => {
    if (!names?.length) return '未关联项目'
    const visible = names.slice(0, 3)
    const extra = names.length - visible.length
    return extra > 0 ? `${visible.join(', ')} +${extra}` : visible.join(', ')
  }

  const listItems = useMemo(() => requirementPage?.records || [], [requirementPage?.records])
  const total = requirementPage?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <Input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索需求名称或编码"
            className="w-full sm:w-64"
          />
          {keyword ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setKeyword('')}>
              清空
            </Button>
          ) : null}
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={handleOpenAdd}>
          <Plus className="h-4 w-4" />
          添加需求
        </Button>
      </div>

      {isLoading ? (
        <div className="text-sm text-muted-foreground">加载需求中...</div>
      ) : listItems.length ? (
        <div className="space-y-3">
          {listItems.map((item) => (
            <div key={item.id} className="flex flex-col gap-2 rounded-xl border border-border/60 bg-background/60 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.link ? <Link2 className="h-4 w-4 text-[hsl(var(--accent))]" /> : null}
                    {item.requirement_code && (
                      <Badge variant="outline" tone="info">{item.requirement_code}</Badge>
                    )}
                    {item.link ? (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-foreground hover:text-[hsl(var(--accent))]"
                      >
                        {item.name}
                      </a>
                    ) : (
                      <span className="text-sm font-semibold text-foreground">{item.name}</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {displayProjects(item.project_names || [])}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(item)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="soft" tone={STATUS_TONE[item.status ?? 'presented'] || 'neutral'}>{statusOptions.find((s) => s.code === item.status)?.desc || '已宣讲'}</Badge>
                {item.environment && (
                  <Badge variant="soft" tone="warning">{item.environment}</Badge>
                )}
                {item.branch && (
                  <Badge variant="soft" tone="accent">
                    <GitBranch className="mr-1 h-3 w-3" />
                    {item.branch}
                  </Badge>
                )}
                <Badge variant="soft" tone="info">执行事项 {item.sql_count || 0}</Badge>
                <button
                  type="button"
                  className="focus:outline-none"
                  onClick={() => handleOpenCommits(item)}
                >
                  <Badge variant="soft" tone="neutral" className="cursor-pointer hover:bg-muted">
                    提交 {item.commit_count || 0}
                  </Badge>
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted-foreground">状态：</span>
                <Select
                  value={item.status || 'presented'}
                  onValueChange={(value) => statusMutation.mutate({ id: item.id, status: value })}
                >
                  <SelectTrigger size="sm" className="max-w-[180px]" disabled={statusMutation.isPending}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getAdjacentStatuses(item.status).map((status) => (
                      <SelectItem key={status.code} value={status.code}>
                        {status.desc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">
          {normalizedKeyword ? '没有匹配的需求' : '暂无需求，点击右上角添加'}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>
          共 {total} 条 · 第 {Math.min(page, totalPages)} / {totalPages} 页
          {isFetching ? ' · 刷新中...' : ''}
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isFetching}
          >
            上一页
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || isFetching}
          >
            下一页
          </Button>
        </div>
      </div>

      <RequirementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        iterationId={iterationId}
        iterationName={iterationName}
        projects={projects}
        initialData={editingItem}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['requirements-page', iterationId] })}
      />

      <RequirementCommitsDialog
        open={commitsDialogOpen}
        onOpenChange={(open) => {
          setCommitsDialogOpen(open)
          if (!open) {
            setCommitsRequirement(null)
          }
        }}
        requirement={commitsRequirement}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {deleteTarget && ((deleteTarget.sql_count || 0) + (deleteTarget.commit_count || 0)) > 0
              ? `需求「${deleteTarget.name}」已关联 ${(deleteTarget.sql_count || 0) + (deleteTarget.commit_count || 0)} 条记录，确定删除？`
              : `确定删除需求「${deleteTarget?.name}」吗？`}
          </p>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
              取消
            </Button>
            <Button
              type="button"
              variant="primary"
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? '删除中...' : '删除'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
