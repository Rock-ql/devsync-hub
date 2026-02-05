import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link2, Pencil, Plus, Trash2 } from 'lucide-react'
import { requirementApi, RequirementItem } from '@/api/requirement'
import RequirementDialog from '@/components/requirement/RequirementDialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from '@/components/ui/toaster'

interface ProjectOption {
  id: number
  name: string
}

interface RequirementListProps {
  iterationId: number
  iterationName: string
  projects: ProjectOption[]
}

export default function RequirementList({ iterationId, iterationName, projects }: RequirementListProps) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<RequirementItem | null>(null)

  const { data: requirements, isLoading } = useQuery<RequirementItem[]>({
    queryKey: ['requirements', iterationId],
    queryFn: () => requirementApi.list(iterationId),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => requirementApi.remove(id),
    onSuccess: () => {
      toast.success('需求已删除')
      queryClient.invalidateQueries({ queryKey: ['requirements', iterationId] })
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleOpenAdd = () => {
    setEditingItem(null)
    setDialogOpen(true)
  }

  const handleEdit = (item: RequirementItem) => {
    setEditingItem(item)
    setDialogOpen(true)
  }

  const handleDelete = (item: RequirementItem) => {
    const linkedTotal = (item.linkedSqlCount || 0) + (item.linkedCommitCount || 0)
    const message = linkedTotal > 0
      ? `该需求已关联 ${linkedTotal} 条记录，确定删除？`
      : '确定删除该需求吗？'
    if (!confirm(message)) return
    deleteMutation.mutate(item.id)
  }

  const displayProjects = (names: string[]) => {
    if (!names?.length) return '未关联项目'
    const visible = names.slice(0, 3)
    const extra = names.length - visible.length
    return extra > 0 ? `${visible.join(', ')} +${extra}` : visible.join(', ')
  }

  const listItems = useMemo(() => requirements || [], [requirements])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-foreground">需求列表</div>
        <Button variant="secondary" size="sm" onClick={handleOpenAdd}>
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
                    {displayProjects(item.projectNames || [])}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => handleEdit(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="soft" tone="info">SQL {item.linkedSqlCount || 0}</Badge>
                <Badge variant="soft" tone="neutral">提交 {item.linkedCommitCount || 0}</Badge>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">暂无需求，点击右上角添加</div>
      )}

      <RequirementDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        iterationId={iterationId}
        iterationName={iterationName}
        projects={projects}
        initialData={editingItem}
        onSaved={() => queryClient.invalidateQueries({ queryKey: ['requirements', iterationId] })}
      />
    </div>
  )
}
