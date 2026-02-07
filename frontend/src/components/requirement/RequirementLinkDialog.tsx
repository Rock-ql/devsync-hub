import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import api, { PageResult } from '@/api'
import { requirementApi, RequirementItem } from '@/api/requirement'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'

interface IterationItem {
  id: number
  name: string
}

interface RequirementGroup {
  iteration: IterationItem
  items: RequirementItem[]
}

interface RequirementLinkDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sqlId?: number
  onLinked?: () => void
}

export default function RequirementLinkDialog({
  open,
  onOpenChange,
  sqlId,
  onLinked,
}: RequirementLinkDialogProps) {
  const [selectedRequirementId, setSelectedRequirementId] = useState('')
  const [groups, setGroups] = useState<RequirementGroup[]>([])
  const [isLoadingRequirements, setIsLoadingRequirements] = useState(false)

  const { data: iterationPage } = useQuery<PageResult<IterationItem>>({
    queryKey: ['iterations-all'],
    queryFn: () => api.post('/iteration/list', { pageNum: 1, pageSize: 200 }),
    enabled: open,
  })

  useEffect(() => {
    if (!open) {
      setSelectedRequirementId('')
      setGroups([])
      setIsLoadingRequirements(false)
      return
    }

    const iterations = iterationPage?.list || []
    if (!iterations.length) {
      setGroups([])
      return
    }

    let cancelled = false
    setIsLoadingRequirements(true)

    // 并行加载需求列表和已关联需求
    const loadRequirements = Promise.all(iterations.map((iteration) => requirementApi.list(iteration.id)))
    const loadLinked = sqlId
      ? requirementApi.linked({ linkType: 'sql', linkId: sqlId })
      : Promise.resolve(null)

    Promise.all([loadRequirements, loadLinked])
      .then(([results, linkedRequirement]) => {
        if (cancelled) return
        const nextGroups = iterations.map((iteration, index) => ({
          iteration,
          items: results[index] || [],
        })).filter((group) => group.items.length > 0)
        setGroups(nextGroups)

        // 回显已关联的需求
        if (linkedRequirement?.id) {
          setSelectedRequirementId(String(linkedRequirement.id))
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          toast.error(error.message)
          setGroups([])
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRequirements(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [open, iterationPage, sqlId])

  const linkMutation = useMutation({
    mutationFn: () => requirementApi.link({
      requirementId: Number(selectedRequirementId),
      linkType: 'sql',
      linkId: sqlId || 0,
    }),
    onSuccess: () => {
      toast.success('关联成功')
      onOpenChange(false)
      onLinked?.()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const canSubmit = !!sqlId && !!selectedRequirementId && !linkMutation.isPending

  const groupedOptions = useMemo(() => groups || [], [groups])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>关联需求</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {isLoadingRequirements ? (
            <p className="text-sm text-muted-foreground">正在加载需求...</p>
          ) : groupedOptions.length ? (
            <Select value={selectedRequirementId || undefined} onValueChange={setSelectedRequirementId}>
              <SelectTrigger>
                <SelectValue placeholder="请选择需求" />
              </SelectTrigger>
              <SelectContent>
                {groupedOptions.map((group) => (
                  <SelectGroup key={group.iteration.id}>
                    <SelectLabel>{group.iteration.name}</SelectLabel>
                    {group.items.map((item) => (
                      <SelectItem key={item.id} value={String(item.id)}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-muted-foreground">暂无需求可关联</p>
          )}
        </div>
        <DialogFooter className="pt-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={!canSubmit} onClick={() => linkMutation.mutate()}>
            {linkMutation.isPending ? '关联中...' : '确认关联'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
