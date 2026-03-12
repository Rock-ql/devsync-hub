import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { iterationApi, IterationDetail } from '@/api/iteration'
import { requirementApi, RequirementItem } from '@/api/requirement'
import { PageResult } from '@/api'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'

interface RequirementMigrateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentIterationId: number
  requirements: RequirementItem[]
  onMigrated?: () => void
}

export default function RequirementMigrateDialog({
  open,
  onOpenChange,
  currentIterationId,
  requirements,
  onMigrated,
}: RequirementMigrateDialogProps) {
  const queryClient = useQueryClient()
  const [targetIterationId, setTargetIterationId] = useState<string>('')

  const { data: iterationPage } = useQuery<PageResult<IterationDetail>>({
    queryKey: ['iterations', 'migrate-targets'],
    queryFn: () => iterationApi.list({ size: 200 }),
    enabled: open,
  })

  const availableIterations = useMemo(() => {
    if (!iterationPage?.records) return []
    return iterationPage.records.filter(
      (it) => it.id !== currentIterationId && it.status !== 'released',
    )
  }, [iterationPage?.records, currentIterationId])

  const migrateMutation = useMutation({
    mutationFn: () =>
      requirementApi.migrate({
        requirement_ids: requirements.map((r) => r.id),
        target_iteration_id: Number(targetIterationId),
      }),
    onSuccess: () => {
      toast.success(`${requirements.length} 个需求已迁移`)
      onOpenChange(false)
      setTargetIterationId('')
      queryClient.invalidateQueries({ queryKey: ['requirements-page'] })
      queryClient.invalidateQueries({ queryKey: ['iterations'] })
      onMigrated?.()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setTargetIterationId('') }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>迁移需求</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label>待迁移需求（{requirements.length} 个）</Label>
            <div className="max-h-32 overflow-y-auto rounded-lg border border-border/60 p-2 text-sm text-muted-foreground">
              {requirements.map((r) => (
                <div key={r.id} className="truncate py-0.5">
                  {r.requirement_code ? `[${r.requirement_code}] ` : ''}{r.name}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>目标迭代 *</Label>
            <Select value={targetIterationId} onValueChange={setTargetIterationId}>
              <SelectTrigger>
                <SelectValue placeholder="选择目标迭代" />
              </SelectTrigger>
              <SelectContent>
                {availableIterations.map((it) => (
                  <SelectItem key={it.id} value={String(it.id)}>
                    {it.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {!availableIterations.length && (
              <p className="text-xs text-muted-foreground">暂无可选迭代（已上线的迭代不可迁入）</p>
            )}
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            type="button"
            disabled={!targetIterationId || migrateMutation.isPending}
            onClick={() => migrateMutation.mutate()}
          >
            {migrateMutation.isPending ? '迁移中...' : '确认迁移'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
