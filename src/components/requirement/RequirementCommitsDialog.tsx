import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { GitBranch } from 'lucide-react'
import { PageResult } from '@/api'
import { requirementApi, RequirementCommitItem, RequirementItem } from '@/api/requirement'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { toast } from '@/components/ui/toaster'

interface RequirementCommitsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  requirement?: RequirementItem | null
}

const PAGE_SIZE = 10

export default function RequirementCommitsDialog({ open, onOpenChange, requirement }: RequirementCommitsDialogProps) {
  const requirementId = requirement?.id

  const [page, setPage] = useState(1)

  const [draftStartDate, setDraftStartDate] = useState('')
  const [draftEndDate, setDraftEndDate] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  useEffect(() => {
    if (!open) {
      return
    }
    setPage(1)
    setDraftStartDate('')
    setDraftEndDate('')
    setStartDate('')
    setEndDate('')
  }, [open, requirementId])

  const canQuery = open && !!requirementId

  const { data, isLoading, isFetching, refetch } = useQuery<PageResult<RequirementCommitItem>>({
    queryKey: ['requirement-commits', requirementId, page, startDate, endDate],
    queryFn: () =>
      requirementApi.listCommits({
        requirement_id: requirementId as number,
        page,
        size: PAGE_SIZE,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      }),
    enabled: canQuery,
  })

  const records = useMemo(() => data?.records || [], [data?.records])
  const total = data?.total || 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const formatCommitDate = (dateStr: string) => {
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

  const shortenCommitId = (commitId: string) => {
    const normalized = commitId?.trim() || ''
    if (normalized.length <= 10) return normalized
    return normalized.slice(0, 10)
  }

  const handleApplyFilter = () => {
    if (draftStartDate && draftEndDate && draftEndDate < draftStartDate) {
      toast.error('结束日期不能早于开始日期')
      return
    }
    setStartDate(draftStartDate)
    setEndDate(draftEndDate)
    setPage(1)
  }

  const handleClearFilter = () => {
    setDraftStartDate('')
    setDraftEndDate('')
    setStartDate('')
    setEndDate('')
    setPage(1)
  }

  const titleParts = [requirement?.requirement_code, requirement?.name].filter(Boolean)
  const dialogTitle = titleParts.length ? `关联提交 - ${titleParts.join(' ')}` : '关联提交'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label>开始日期</Label>
              <Input type="date" value={draftStartDate} onChange={(e) => setDraftStartDate(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>结束日期</Label>
              <Input type="date" value={draftEndDate} onChange={(e) => setDraftEndDate(e.target.value)} />
            </div>
            <div className="flex items-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={handleApplyFilter} disabled={!canQuery}>
                查询
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={handleClearFilter} disabled={!canQuery}>
                清空
              </Button>
              <Button variant="ghost" size="sm" type="button" onClick={() => refetch()} disabled={!canQuery || isFetching}>
                刷新
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner />
              加载提交中...
            </div>
          ) : records.length ? (
            <div className="space-y-3">
              {records.map((commit) => (
                <div
                  key={commit.id}
                  className="rounded-xl border border-border bg-background/60 p-4 transition hover:bg-muted/60"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p
                        className="whitespace-pre-wrap break-words text-sm font-medium text-foreground"
                        title={commit.message}
                      >
                        {commit.message}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <Badge variant="soft" tone="info" className="text-xs">
                          {commit.project_name}
                        </Badge>
                        <span>{commit.author_name}</span>
                        <span>{formatCommitDate(commit.committed_at)}</span>
                        {commit.branch ? (
                          <Badge variant="soft" tone="accent" className="text-xs">
                            <GitBranch className="mr-1 h-3 w-3" />
                            {commit.branch}
                          </Badge>
                        ) : null}
                        {commit.additions > 0 || commit.deletions > 0 ? (
                          <span>
                            <span className="text-emerald-600">+{commit.additions}</span>
                            {' / '}
                            <span className="text-red-600">-{commit.deletions}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <code
                      className="break-all text-right font-mono text-xs text-muted-foreground"
                      title={commit.commit_id}
                    >
                      {shortenCommitId(commit.commit_id)}
                    </code>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
              暂无关联提交，请先到项目管理中同步提交
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
                disabled={page <= 1 || isFetching || !canQuery}
              >
                上一页
              </Button>
              <Button
                variant="secondary"
                size="sm"
                type="button"
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={page >= totalPages || isFetching || !canQuery}
              >
                下一页
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
