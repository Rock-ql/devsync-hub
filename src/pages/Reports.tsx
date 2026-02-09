import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportApi, ReportBrief } from '@/api/report'
import { settingApi } from '@/api/setting'
import {
  addDays,
  addMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isValid,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Copy, Pencil, Sparkles, Trash2 } from 'lucide-react'
import ReactMarkdown, { type Components } from 'react-markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'
import { toast } from '@/components/ui/toaster'

interface WeekRow {
  weekNumber: number
  weekStart: Date
  weekEnd: Date
}

type PanelState =
  | { mode: 'daily'; date: Date }
  | { mode: 'weekly'; week: WeekRow }

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日']

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node, className, ...props }) => (
    <h1 className={cn('mt-8 text-3xl font-display text-foreground', className)} {...props} />
  ),
  h2: ({ node, className, ...props }) => (
    <h2 className={cn('mt-7 text-2xl font-display text-foreground', className)} {...props} />
  ),
  h3: ({ node, className, ...props }) => (
    <h3 className={cn('mt-6 text-xl font-display text-foreground', className)} {...props} />
  ),
  p: ({ node, className, ...props }) => (
    <p className={cn('my-3 leading-7 text-muted-foreground', className)} {...props} />
  ),
  ol: ({ node, className, ...props }) => (
    <ol className={cn('my-3 list-decimal space-y-2 pl-6 text-muted-foreground', className)} {...props} />
  ),
  ul: ({ node, className, ...props }) => (
    <ul className={cn('my-3 list-disc space-y-2 pl-6 text-muted-foreground', className)} {...props} />
  ),
  li: ({ node, className, ...props }) => (
    <li className={cn('leading-7', className)} {...props} />
  ),
  blockquote: ({ node, className, ...props }) => (
    <blockquote
      className={cn('my-4 border-l-2 border-[hsl(var(--accent))]/40 pl-4 text-muted-foreground', className)}
      {...props}
    />
  ),
  pre: ({ node, className, ...props }) => (
    <pre
      className={cn('my-4 overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-sm text-foreground', className)}
      {...props}
    />
  ),
  code: ({ node, className, ...props }) => (
    <code className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground', className)} {...props} />
  ),
}

function normalizeReportMarkdown(content: string): string {
  if (!content) {
    return ''
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const normalizedLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      normalizedLines.push('')
      continue
    }

    const parentMatch = trimmed.match(/^(\d+)\.\s*(.+)$/)
    const hasInlineChildren = /\b\d+\.\d+\s+/.test(trimmed)
    if (!parentMatch || !hasInlineChildren) {
      // 处理独立的 X.Y 格式子项行（如 "1.1 添加订单查询接口" 或 "1.1. 添加订单查询接口"）
      // 这种格式不是合法 Markdown 列表语法，会导致渲染时挤压成一段
      const standaloneChildMatch = trimmed.match(/^\d+\.\d+\.?\s+(.+)$/)
      if (standaloneChildMatch) {
        const itemText = standaloneChildMatch[1].trim()
        if (itemText) {
          normalizedLines.push(`   1. ${itemText}`)
          continue
        }
      }
      normalizedLines.push(line)
      continue
    }

    const parentIndex = parentMatch[1]
    const parentPayload = parentMatch[2]
    const childIndex = parentPayload.search(/\b\d+\.\d+\s+/)
    if (childIndex <= 0) {
      normalizedLines.push(line)
      continue
    }

    const parentTitle = parentPayload.slice(0, childIndex).trim()
    const childPayload = parentPayload.slice(childIndex).trim()
    const childSegments = childPayload.split(/(?=\d+\.\d+\s+)/).map((segment) => segment.trim())

    if (!parentTitle || childSegments.length === 0) {
      normalizedLines.push(line)
      continue
    }

    normalizedLines.push(`${parentIndex}. ${parentTitle}`)
    for (const segment of childSegments) {
      const item = segment.replace(/^\d+\.\d+\s+/, '').trim()
      if (item) {
        normalizedLines.push(`   1. ${item}`)
      }
    }
  }

  return normalizedLines.join('\n')
}

function toValidDate(value: Date, fallback: Date): Date {
  return isValid(value) ? value : fallback
}

function formatSafeDate(value: Date, pattern: string, fallbackText: string): string {
  return isValid(value) ? format(value, pattern) : fallbackText
}

export default function Reports() {
  const queryClient = useQueryClient()
  const [safeToday] = useState(() => new Date())
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(safeToday))
  const [panelState, setPanelState] = useState<PanelState>(() => ({ mode: 'daily', date: safeToday }))
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    type: 'daily',
    startDate: formatSafeDate(safeToday, 'yyyy-MM-dd', ''),
    endDate: formatSafeDate(safeToday, 'yyyy-MM-dd', ''),
    authorEmail: '',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', content: '' })
  const [copySuccess, setCopySuccess] = useState(false)
  const { confirmLeave } = useUnsavedWarning(hasUnsavedChanges)

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: () => settingApi.getAll(),
  })
  const settings = useMemo(() => {
    const map: Record<string, string> = {}
    settingsData?.forEach((s) => { map[s.setting_key] = s.setting_value })
    return map
  }, [settingsData])

  const safeSelectedMonth = useMemo(() => toValidDate(selectedMonth, startOfMonth(safeToday)), [selectedMonth, safeToday])

  const monthStart = useMemo(() => startOfMonth(safeSelectedMonth), [safeSelectedMonth])
  const monthEnd = useMemo(() => endOfMonth(safeSelectedMonth), [safeSelectedMonth])
  const calendarStart = useMemo(() => startOfWeek(monthStart, { weekStartsOn: 1 }), [monthStart])
  const calendarEnd = useMemo(() => endOfWeek(monthEnd, { weekStartsOn: 1 }), [monthEnd])

  const weekRows = useMemo<WeekRow[]>(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const ws = addDays(calendarStart, index * 7)
      return { weekNumber: index + 1, weekStart: ws, weekEnd: addDays(ws, 6) }
    })
  }, [calendarStart])

  const calendarDays = useMemo(() => {
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(calendarStart, index)
      return {
        date,
        dateKey: format(date, 'yyyy-MM-dd'),
        isCurrentMonth: isSameMonth(date, safeSelectedMonth),
      }
    })
  }, [calendarStart, safeSelectedMonth])


  const { data: monthSummary, isLoading: isMonthLoading } = useQuery({
    queryKey: ['report-month-summary', format(safeSelectedMonth, 'yyyy-MM')],
    queryFn: () => reportApi.monthSummary(safeSelectedMonth.getFullYear(), safeSelectedMonth.getMonth() + 1),
  })

  const dailyMap = useMemo(() => {
    return new Map(monthSummary?.daily_reports.map((item) => [item.start_date, item]) ?? [])
  }, [monthSummary])

  const weeklyMap = useMemo(() => {
    if (!monthSummary) return new Map<number, ReportBrief>()
    const map = new Map<number, ReportBrief>()
    for (const item of monthSummary.weekly_reports) {
      const startDate = parseISO(item.start_date)
      if (!isValid(startDate)) {
        continue
      }
      const wn = resolveWeekNumber(startDate, monthStart)
      map.set(wn, item)
    }
    return map
  }, [monthSummary, monthStart])

  const selectedReportId = useMemo(() => {
    if (!monthSummary) return null
    if (panelState.mode === 'daily') {
      const key = formatSafeDate(panelState.date, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
      return dailyMap.get(key)?.id ?? null
    }
    return weeklyMap.get(panelState.week.weekNumber)?.id ?? null
  }, [dailyMap, monthSummary, panelState, safeToday, weeklyMap])

  const { data: selectedReport, isLoading: isReportLoading } = useQuery({
    queryKey: ['report-detail', selectedReportId],
    queryFn: () => reportApi.detail(selectedReportId!),
    enabled: selectedReportId !== null,
  })

  const normalizedReportContent = useMemo(
    () => normalizeReportMarkdown(selectedReport?.content ?? ''),
    [selectedReport?.content],
  )

  const generateMutation = useMutation({
    mutationFn: (data: typeof generateForm) => reportApi.generate({
      type: data.type,
      start_date: data.startDate,
      end_date: data.endDate,
      author_email: data.authorEmail || undefined,
    }),
    onSuccess: async (report) => {
      setIsGenerateModalOpen(false)
      const parsedStart = parseISO(report.start_date)
      const sd = toValidDate(parsedStart, safeToday)
      if (!isValid(parsedStart)) {
        toast.error('报告日期格式异常，已按当前日期展示')
      }
      const nextMonth = startOfMonth(sd)
      setSelectedMonth(nextMonth)
      if (report.type === 'weekly') {
        const weekNumber = resolveWeekNumber(sd, nextMonth)
        const ws = addDays(startOfWeek(nextMonth, { weekStartsOn: 1 }), (weekNumber - 1) * 7)
        setPanelState({ mode: 'weekly', week: { weekNumber, weekStart: ws, weekEnd: addDays(ws, 6) } })
      } else {
        setPanelState({ mode: 'daily', date: sd })
      }
      const monthKey = format(nextMonth, 'yyyy-MM')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['report-month-summary', monthKey] }),
        queryClient.invalidateQueries({ queryKey: ['report-detail', report.id] }),
      ])
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => reportApi.delete(id),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: ['report-detail', id], exact: true })
      const monthKey = format(safeSelectedMonth, 'yyyy-MM')
      await queryClient.invalidateQueries({ queryKey: ['report-month-summary', monthKey] })
      toast.success('删除成功')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`删除失败：${message}`)
    },
  })

  const handleDeleteReport = () => {
    if (!selectedReport || deleteMutation.isPending) return

    const reportId = Number(selectedReport.id)
    if (!Number.isFinite(reportId) || reportId <= 0) {
      toast.error('报告ID无效，无法删除')
      return
    }

    toast.success(`正在删除报告 #${reportId}`)
    deleteMutation.mutate(reportId)
  }

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; content: string }) =>
      reportApi.update(data),
    onSuccess: () => {
      const monthKey = format(safeSelectedMonth, 'yyyy-MM')
      queryClient.invalidateQueries({ queryKey: ['report-month-summary', monthKey] })
      queryClient.invalidateQueries({ queryKey: ['report-detail', selectedReportId] })
      setIsEditing(false)
      setHasUnsavedChanges(false)
      toast.success('保存成功')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`保存失败：${message}`)
    },
  })

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    generateMutation.mutate(generateForm)
  }

  const handleStartEdit = () => {
    if (!selectedReport) return
    setEditForm({ title: selectedReport.title, content: selectedReport.content })
    setHasUnsavedChanges(false)
    setIsEditing(true)
  }

  const handleCancelEdit = () => {
    if (hasUnsavedChanges && !confirmLeave()) return
    setIsEditing(false)
    setHasUnsavedChanges(false)
  }

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedReport) return
    updateMutation.mutate({ id: selectedReport.id, title: editForm.title, content: editForm.content })
  }

  const handleCopy = async () => {
    if (!selectedReport) return
    try {
      await navigator.clipboard.writeText(selectedReport.content)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = selectedReport.content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    }
  }

  const handleSelectDate = (date: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return
    if (isEditing && !confirmLeave()) return
    setIsEditing(false)
    setHasUnsavedChanges(false)
    setPanelState({ mode: 'daily', date })
  }

  const handleSelectWeek = (week: WeekRow) => {
    if (isEditing && !confirmLeave()) return
    setIsEditing(false)
    setHasUnsavedChanges(false)
    setPanelState({ mode: 'weekly', week })
  }

  const handleMonthChange = (offset: number) => {
    if (isEditing && !confirmLeave()) return
    const next = addMonths(safeSelectedMonth, offset)
    setSelectedMonth(next)
    setIsEditing(false)
    setHasUnsavedChanges(false)
    setPanelState({ mode: 'daily', date: startOfMonth(next) })
  }

  const openGenerateWithPanel = () => {
    const savedEmail = settings?.['git.author.email'] || ''
    if (panelState.mode === 'daily') {
      const dateValue = formatSafeDate(panelState.date, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
      setGenerateForm({ type: 'daily', startDate: dateValue, endDate: dateValue, authorEmail: savedEmail })
    } else {
      const startValue = formatSafeDate(panelState.week.weekStart, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
      const endValue = formatSafeDate(panelState.week.weekEnd, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
      setGenerateForm({ type: 'weekly', startDate: startValue, endDate: endValue, authorEmail: savedEmail })
    }
    setIsGenerateModalOpen(true)
  }

  const dailyCompleted = monthSummary?.daily_reports.length ?? 0
  const weeklyCompleted = monthSummary?.weekly_reports.length ?? 0
  const dailyTotal = getDaysInMonth(safeSelectedMonth)
  const weeklyTotal =
    differenceInCalendarWeeks(calendarEnd, calendarStart, { weekStartsOn: 1 }) + 1

  const emptyStateTitle =
    panelState.mode === 'daily'
      ? `${formatSafeDate(panelState.date, 'yyyy年M月d日', formatSafeDate(safeToday, 'yyyy年M月d日', ''))} 暂无日报`
      : `第${panelState.week.weekNumber}周 周报 (${formatSafeDate(panelState.week.weekStart, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))} ~ ${formatSafeDate(panelState.week.weekEnd, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))})`

  const emptyStateButton = panelState.mode === 'daily' ? '生成日报' : '生成周报'

  const reportDateText = selectedReport
    ? selectedReport.start_date === selectedReport.end_date
      ? selectedReport.start_date
      : `${selectedReport.start_date} ~ ${selectedReport.end_date}`
    : ''

  const reportTypeLabel = selectedReport?.type === 'daily' ? '日报' : '周报'

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-4">
          <SectionLabel>REPORTS</SectionLabel>
          <div>
            <h1 className="text-3xl font-display">日报周报</h1>
            <p className="mt-2 text-sm text-muted-foreground">AI 自动生成高质量工作报告</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full bg-muted px-4 py-2 text-xs text-muted-foreground">
            本月统计: 日报 {dailyCompleted}/{dailyTotal} 周报 {weeklyCompleted}/{weeklyTotal}
          </div>
          <Button onClick={() => {
            const savedEmail = settings?.['git.author.email'] || ''
            setGenerateForm((prev) => ({ ...prev, authorEmail: savedEmail }))
            setIsGenerateModalOpen(true)
          }}>
            <Sparkles className="h-4 w-4" />
            生成报告
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <Card className="h-full">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => handleMonthChange(-1)} aria-label="上个月">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>{format(safeSelectedMonth, 'yyyy年M月')}</CardTitle>
              <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={() => handleMonthChange(1)} aria-label="下个月">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            {isMonthLoading && (
              <p className="mt-2 text-center text-xs text-muted-foreground">正在加载本月数据...</p>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
              {WEEK_DAYS.map((day) => (
                <span key={day} className="py-1">{day}</span>
              ))}
            </div>
            <div className="space-y-3">
              {weekRows.map((week, weekIndex) => {
                const weekDays = calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7)
                const weeklyReport = weeklyMap.get(week.weekNumber)
                const isWeeklySelected =
                  panelState.mode === 'weekly' && panelState.week.weekNumber === week.weekNumber
                return (
                  <div key={week.weekNumber} className="space-y-2">
                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((day) => {
                        const dailyReport = dailyMap.get(day.dateKey)
                        const isSelected =
                          panelState.mode === 'daily' && isSameDay(panelState.date, day.date)
                        return (
                          <button
                            key={day.dateKey}
                            type="button"
                            disabled={!day.isCurrentMonth}
                            onClick={() => handleSelectDate(day.date, day.isCurrentMonth)}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-sm transition',
                              day.isCurrentMonth
                                ? 'border-transparent hover:bg-muted/60'
                                : 'cursor-not-allowed border-transparent text-muted-foreground',
                              dailyReport && day.isCurrentMonth && 'bg-emerald-50/60',
                              isSelected && 'border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10'
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-full',
                                isToday(day.date) && day.isCurrentMonth
                                  ? 'bg-primary text-primary-foreground'
                                  : 'text-foreground'
                              )}
                            >
                              {format(day.date, 'd')}
                            </span>
                            {day.isCurrentMonth && (
                              <span
                                className={cn(
                                  'h-2 w-2 rounded-full',
                                  dailyReport ? 'bg-emerald-500' : 'border border-muted-foreground'
                                )}
                              />
                            )}
                          </button>
                        )
                      })}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectWeek(week)}
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-xs transition',
                        isWeeklySelected
                          ? 'border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10'
                          : 'border-dashed border-border hover:bg-muted/40'
                      )}
                    >
                      <span className="text-muted-foreground">周报 W{week.weekNumber}</span>
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          weeklyReport ? 'bg-emerald-500' : 'border border-muted-foreground'
                        )}
                      />
                    </button>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardHeader>
            <CardTitle>报告详情</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {isMonthLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                加载中...
              </div>
            ) : isReportLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                报告加载中...
              </div>
            ) : selectedReport ? (
              <div className="space-y-6">
                {isEditing ? (
                  <form onSubmit={handleSaveEdit} className="space-y-6">
                    <div className="space-y-3">
                      <Input
                        value={editForm.title}
                        onChange={(e) => {
                          setEditForm({ ...editForm, title: e.target.value })
                          setHasUnsavedChanges(true)
                        }}
                        maxLength={200}
                        required
                      />
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="soft" tone={selectedReport.type === 'daily' ? 'info' : 'accent'}>
                          {reportTypeLabel}
                        </Badge>
                        <span>{reportDateText}</span>
                        <span>{selectedReport.created_at?.split('T')[0]}</span>
                      </div>
                    </div>
                    <Textarea
                      value={editForm.content}
                      onChange={(e) => {
                        setEditForm({ ...editForm, content: e.target.value })
                        setHasUnsavedChanges(true)
                      }}
                      rows={15}
                      className="font-mono text-sm"
                      required
                    />
                    <div className="flex items-center gap-2">
                      <Button type="submit" disabled={updateMutation.isPending}>
                        {updateMutation.isPending ? '保存中...' : '保存'}
                      </Button>
                      <Button type="button" variant="secondary" onClick={handleCancelEdit}>
                        取消
                      </Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <h2 className="text-2xl font-semibold text-foreground">
                          {selectedReport.title}
                        </h2>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="soft" tone={selectedReport.type === 'daily' ? 'info' : 'accent'}>
                            {reportTypeLabel}
                          </Badge>
                          <span>{reportDateText}</span>
                          <span>{selectedReport.created_at?.split('T')[0]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleCopy} aria-label="复制报告内容">
                          {copySuccess ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={handleStartEdit} aria-label="编辑报告">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                          onClick={handleDeleteReport}
                          disabled={deleteMutation.isPending}
                          aria-label="删除报告"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="markdown text-sm text-foreground">
                      <ReactMarkdown components={MARKDOWN_COMPONENTS}>{normalizedReportContent}</ReactMarkdown>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex h-64 flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
                <div className="text-center">
                  <div className="text-base text-foreground">{emptyStateTitle}</div>
                  <div className="mt-2">暂无报告，请点击生成。</div>
                </div>
                <Button onClick={openGenerateWithPanel}>{emptyStateButton}</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>生成报告</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label>报告类型</Label>
              <Select value={generateForm.type} onValueChange={(value) => setGenerateForm({ ...generateForm, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">日报</SelectItem>
                  <SelectItem value="weekly">周报</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input
                  type="date"
                  value={generateForm.startDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <Input
                  type="date"
                  value={generateForm.endDate}
                  onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>作者邮箱（可选）</Label>
              <Input
                type="email"
                value={generateForm.authorEmail}
                onChange={(e) => setGenerateForm({ ...generateForm, authorEmail: e.target.value })}
                placeholder="留空则使用全局设置"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsGenerateModalOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={generateMutation.isPending}>
                {generateMutation.isPending ? '生成中...' : '生成'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function resolveWeekNumber(date: Date, monthStart: Date): number {
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const diff = Math.floor((date.getTime() - calStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, diff + 1)
}
