import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reportApi, ReportBrief } from '@/api/report'
import { buildSettingMap, settingApi } from '@/api/setting'
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
import MarkdownEditor from '@/components/report/MarkdownEditor'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'
import { useSSE } from '@/hooks/useSSE'
import { toast } from '@/components/ui/toaster'
import { useReportStore, type WeekRow } from '@/stores/useReportStore'

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日']

const MARKDOWN_COMPONENTS: Components = {
  h1: ({ node: _node, className, ...props }) => <h1 className={cn('mt-8 text-3xl font-display text-foreground', className)} {...props} />,
  h2: ({ node: _node, className, ...props }) => <h2 className={cn('mt-7 text-2xl font-display text-foreground', className)} {...props} />,
  h3: ({ node: _node, className, ...props }) => <h3 className={cn('mt-6 text-xl font-display text-foreground', className)} {...props} />,
  p: ({ node: _node, className, ...props }) => <p className={cn('my-3 leading-7 text-muted-foreground', className)} {...props} />,
  ol: ({ node: _node, className, ...props }) => <ol className={cn('my-3 list-decimal space-y-2 pl-6 text-muted-foreground', className)} {...props} />,
  ul: ({ node: _node, className, ...props }) => <ul className={cn('my-3 list-disc space-y-2 pl-6 text-muted-foreground', className)} {...props} />,
  li: ({ node: _node, className, ...props }) => <li className={cn('leading-7', className)} {...props} />,
  blockquote: ({ node: _node, className, ...props }) => <blockquote className={cn('my-4 border-l-2 border-[hsl(var(--accent))]/40 pl-4 text-muted-foreground', className)} {...props} />,
  pre: ({ node: _node, className, ...props }) => <pre className={cn('my-4 overflow-x-auto rounded-xl border border-border bg-muted/60 p-4 text-sm text-foreground', className)} {...props} />,
  code: ({ node: _node, className, ...props }) => <code className={cn('rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground', className)} {...props} />,
}

function normalizeReportMarkdown(content: string): string {
  if (!content) return ''
  const lines = content.replace(/\r\n/g, '\n').split('\n')
  const normalizedLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) { normalizedLines.push(''); continue }
    const parentMatch = trimmed.match(/^(\d+)\.\s*(.+)$/)
    const hasInlineChildren = /\b\d+\.\d+\s+/.test(trimmed)
    if (!parentMatch || !hasInlineChildren) {
      const standaloneChildMatch = trimmed.match(/^\d+\.\d+\.?\s+(.+)$/)
      if (standaloneChildMatch) {
        const itemText = standaloneChildMatch[1].trim()
        if (itemText) { normalizedLines.push(`   1. ${itemText}`); continue }
      }
      normalizedLines.push(line); continue
    }
    const parentIndex = parentMatch[1]
    const parentPayload = parentMatch[2]
    const childIndex = parentPayload.search(/\b\d+\.\d+\s+/)
    if (childIndex <= 0) { normalizedLines.push(line); continue }
    const parentTitle = parentPayload.slice(0, childIndex).trim()
    const childPayload = parentPayload.slice(childIndex).trim()
    const childSegments = childPayload.split(/(?=\d+\.\d+\s+)/).map((s) => s.trim())
    if (!parentTitle || childSegments.length === 0) { normalizedLines.push(line); continue }
    normalizedLines.push(`${parentIndex}. ${parentTitle}`)
    for (const segment of childSegments) {
      const item = segment.replace(/^\d+\.\d+\s+/, '').trim()
      if (item) normalizedLines.push(`   1. ${item}`)
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

function resolveWeekNumber(date: Date, monthStart: Date): number {
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const diff = Math.floor((date.getTime() - calStart.getTime()) / (7 * 24 * 60 * 60 * 1000))
  return Math.max(1, diff + 1)
}

type ReportGenerateAction = 'generate' | 'update'

interface ReportGenerateProgressState {
  mode: ReportGenerateAction
  reportType: string
  startDate: string
  endDate: string
  stage: string
  message: string
  percent: number
  status: 'running' | 'done' | 'error'
}

interface ReportGenerateProgressPayload {
  mode: string
  report_type: string
  start_date: string
  end_date: string
  stage: string
  message: string
  percent: number
  status: string
}

interface ReportGenerateRequest {
  type: string
  start_date: string
  end_date: string
  author_email?: string
  force?: boolean
  append_existing?: boolean
}

interface ReportGenerateMutationInput {
  action: ReportGenerateAction
  request: ReportGenerateRequest
}

function getErrorText(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  return '操作失败，请稍后重试'
}

export default function Reports() {
  const queryClient = useQueryClient()
  const store = useReportStore

  // --- Zustand store ---
  const safeToday = useReportStore((s) => s.safeToday)
  const selectedMonth = useReportStore((s) => s.selectedMonth)
  const panelState = useReportStore((s) => s.panelState)
  const isGenerateModalOpen = useReportStore((s) => s.isGenerateModalOpen)
  const generateForm = useReportStore((s) => s.generateForm)
  const isEditing = useReportStore((s) => s.isEditing)
  const hasUnsavedChanges = useReportStore((s) => s.hasUnsavedChanges)
  const editForm = useReportStore((s) => s.editForm)
  const copySuccess = useReportStore((s) => s.copySuccess)

  useUnsavedWarning(hasUnsavedChanges)
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const pendingDiscardActionRef = useRef<null | (() => void)>(null)
  const [reportProgress, setReportProgress] = useState<ReportGenerateProgressState | null>(null)
  const reportProgressTimerRef = useRef<number | null>(null)

  const clearReportProgressLater = (delayMs = 1800) => {
    if (reportProgressTimerRef.current) {
      window.clearTimeout(reportProgressTimerRef.current)
    }
    reportProgressTimerRef.current = window.setTimeout(() => {
      setReportProgress(null)
      reportProgressTimerRef.current = null
    }, delayMs)
  }

  // --- React Query ---
  const { data: settingsData } = useQuery({
    queryKey: ['settings', 'list'],
    queryFn: () => settingApi.getAll(),
  })
  const settings = useMemo(() => buildSettingMap(settingsData), [settingsData])

  useEffect(() => {
    return () => {
      if (reportProgressTimerRef.current) {
        window.clearTimeout(reportProgressTimerRef.current)
      }
    }
  }, [])

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
      return { date, dateKey: format(date, 'yyyy-MM-dd'), isCurrentMonth: isSameMonth(date, safeSelectedMonth) }
    })
  }, [calendarStart, safeSelectedMonth])

  const { data: monthSummary, isLoading: isMonthLoading } = useQuery({
    queryKey: ['report-month-summary', format(safeSelectedMonth, 'yyyy-MM')],
    queryFn: () => reportApi.monthSummary(safeSelectedMonth.getFullYear(), safeSelectedMonth.getMonth() + 1),
  })

  const dailyMap = useMemo(() => new Map(monthSummary?.daily_reports.map((item) => [item.start_date, item]) ?? []), [monthSummary])

  const weeklyMap = useMemo(() => {
    if (!monthSummary) return new Map<number, ReportBrief>()
    const map = new Map<number, ReportBrief>()
    for (const item of monthSummary.weekly_reports) {
      const startDate = parseISO(item.start_date)
      if (!isValid(startDate)) continue
      map.set(resolveWeekNumber(startDate, monthStart), item)
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

  // Step 6: useMemo 缓存 normalizeReportMarkdown 计算
  const normalizedReportContent = useMemo(
    () => normalizeReportMarkdown(selectedReport?.content ?? ''),
    [selectedReport?.content],
  )

  // --- Mutations ---
  const generateMutation = useMutation({
    mutationFn: (input: ReportGenerateMutationInput) => reportApi.generate(input.request),
    onMutate: ({ action, request }) => {
      if (reportProgressTimerRef.current) {
        window.clearTimeout(reportProgressTimerRef.current)
        reportProgressTimerRef.current = null
      }
      setReportProgress({
        mode: action,
        reportType: request.type,
        startDate: request.start_date,
        endDate: request.end_date,
        stage: 'start',
        message: action === 'update' ? '开始更新日报...' : '开始生成报告...',
        percent: 0,
        status: 'running',
      })
    },
    onSuccess: async (report, variables) => {
      if (variables.action === 'generate') {
        store.getState().closeGenerateModal()
      }
      const parsedStart = parseISO(report.start_date)
      const sd = toValidDate(parsedStart, safeToday)
      if (!isValid(parsedStart)) toast.error('报告日期格式异常，已按当前日期展示')
      const nextMonth = startOfMonth(sd)
      store.getState().setSelectedMonth(nextMonth)
      if (report.type === 'weekly') {
        const weekNumber = resolveWeekNumber(sd, nextMonth)
        const ws = addDays(startOfWeek(nextMonth, { weekStartsOn: 1 }), (weekNumber - 1) * 7)
        store.getState().setPanelState({ mode: 'weekly', week: { weekNumber, weekStart: ws, weekEnd: addDays(ws, 6) } })
      } else {
        store.getState().setPanelState({ mode: 'daily', date: sd })
      }
      const monthKey = format(nextMonth, 'yyyy-MM')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['report-month-summary', monthKey] }),
        queryClient.invalidateQueries({ queryKey: ['report-detail', report.id] }),
      ])
      setReportProgress((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          stage: 'done',
          message: variables.action === 'update' ? '日报更新完成' : '报告生成完成',
          percent: 100,
          status: 'done',
        }
      })
      clearReportProgressLater()
    },
    onError: (error, variables) => {
      const errorText = getErrorText(error)
      toast.error(variables.action === 'update' ? `更新日报失败：${errorText}` : `生成报告失败：${errorText}`)
      setReportProgress((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          stage: 'error',
          message: errorText,
          percent: 100,
          status: 'error',
        }
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => reportApi.delete(id),
    onSuccess: async (_, id) => {
      queryClient.removeQueries({ queryKey: ['report-detail', id], exact: true })
      await queryClient.invalidateQueries({ queryKey: ['report-month-summary', format(safeSelectedMonth, 'yyyy-MM')] })
      toast.success('删除成功')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; content: string }) => reportApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-month-summary', format(safeSelectedMonth, 'yyyy-MM')] })
      queryClient.invalidateQueries({ queryKey: ['report-detail', selectedReportId] })
      store.getState().cancelEdit()
      toast.success('保存成功')
    },
  })

  const buildProgressKey = (mode: string, reportType: string, startDate: string, endDate: string) =>
    `${mode}|${reportType}|${startDate}|${endDate}`

  useSSE({
    events: ['report_generate'],
    onMessage: (eventName, data) => {
      if (eventName !== 'report_generate') return
      let payload: ReportGenerateProgressPayload
      try {
        payload = JSON.parse(data) as ReportGenerateProgressPayload
      } catch {
        return
      }

      const status = payload.status === 'done' || payload.status === 'error' ? payload.status : 'running'
      if (payload.mode !== 'generate' && payload.mode !== 'update') return

      const nextKey = buildProgressKey(payload.mode, payload.report_type, payload.start_date, payload.end_date)
      setReportProgress((prev) => {
        if (!prev) return prev
        const currentKey = buildProgressKey(prev.mode, prev.reportType, prev.startDate, prev.endDate)
        if (currentKey !== nextKey) return prev
        return {
          ...prev,
          stage: payload.stage || prev.stage,
          message: payload.message || prev.message,
          percent: Number.isFinite(payload.percent) ? Math.max(0, Math.min(100, payload.percent)) : prev.percent,
          status,
        }
      })

      if (status === 'done' || status === 'error') {
        clearReportProgressLater(status === 'error' ? 2800 : 1800)
      }
    },
  })

  // --- Handlers ---
  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    generateMutation.mutate({
      action: 'generate',
      request: {
        type: generateForm.type,
        start_date: generateForm.startDate,
        end_date: generateForm.endDate,
        author_email: generateForm.authorEmail || undefined,
      },
    })
  }

  const handleUpdateDaily = () => {
    if (panelState.mode !== 'daily' || !selectedReport || selectedReport.type !== 'daily') return
    const dateValue = formatSafeDate(panelState.date, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
    const savedEmail = settings?.['git.author.email'] || ''
    generateMutation.mutate({
      action: 'update',
      request: {
        type: 'daily',
        start_date: dateValue,
        end_date: dateValue,
        author_email: savedEmail || undefined,
        force: true,
        append_existing: true,
      },
    })
  }

  const handleDeleteReport = () => {
    if (!selectedReport || deleteMutation.isPending) return
    const reportId = Number(selectedReport.id)
    if (!Number.isFinite(reportId) || reportId <= 0) { toast.error('报告ID无效'); return }
    toast.success(`正在删除报告 #${reportId}`)
    deleteMutation.mutate(reportId)
  }

  const handleStartEdit = () => {
    if (!selectedReport) return
    store.getState().startEdit(selectedReport.title, selectedReport.content)
  }

  const runWithDiscardConfirm = (action: () => void) => {
    if (!(isEditing && hasUnsavedChanges)) {
      action()
      return
    }
    pendingDiscardActionRef.current = action
    setIsDiscardDialogOpen(true)
  }

  const handleConfirmDiscard = () => {
    const action = pendingDiscardActionRef.current
    pendingDiscardActionRef.current = null
    setIsDiscardDialogOpen(false)
    action?.()
  }

  const handleKeepEditing = () => {
    pendingDiscardActionRef.current = null
    setIsDiscardDialogOpen(false)
  }

  const handleCancelEdit = () => {
    runWithDiscardConfirm(() => {
      store.getState().cancelEdit()
    })
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
      store.getState().setCopySuccess(true)
      setTimeout(() => store.getState().setCopySuccess(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = selectedReport.content
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      store.getState().setCopySuccess(true)
      setTimeout(() => store.getState().setCopySuccess(false), 2000)
    }
  }

  const handleSelectDate = (date: Date, isCurrentMonth: boolean) => {
    if (!isCurrentMonth) return
    const action = () => {
      store.getState().cancelEdit()
      store.getState().setPanelState({ mode: 'daily', date })
    }
    runWithDiscardConfirm(action)
  }

  const handleSelectWeek = (week: WeekRow) => {
    const action = () => {
      store.getState().cancelEdit()
      store.getState().setPanelState({ mode: 'weekly', week })
    }
    runWithDiscardConfirm(action)
  }

  const handleMonthChange = (offset: number) => {
    const action = () => {
      const next = addMonths(safeSelectedMonth, offset)
      store.getState().setSelectedMonth(next)
      store.getState().cancelEdit()
      store.getState().setPanelState({ mode: 'daily', date: startOfMonth(next) })
    }
    runWithDiscardConfirm(action)
  }

  const openGenerateWithPanel = () => {
    const savedEmail = settings?.['git.author.email'] || ''
    if (panelState.mode === 'daily') {
      const dateValue = formatSafeDate(panelState.date, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
      store.getState().setGenerateForm({ type: 'daily', startDate: dateValue, endDate: dateValue, authorEmail: savedEmail })
    } else {
      const startValue = formatSafeDate(panelState.week.weekStart, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
      const endValue = formatSafeDate(panelState.week.weekEnd, 'yyyy-MM-dd', formatSafeDate(safeToday, 'yyyy-MM-dd', ''))
      store.getState().setGenerateForm({ type: 'weekly', startDate: startValue, endDate: endValue, authorEmail: savedEmail })
    }
    store.getState().openGenerateModal()
  }

  // --- Derived ---
  const dailyCompleted = monthSummary?.daily_reports.length ?? 0
  const weeklyCompleted = monthSummary?.weekly_reports.length ?? 0
  const dailyTotal = getDaysInMonth(safeSelectedMonth)
  const weeklyTotal = differenceInCalendarWeeks(calendarEnd, calendarStart, { weekStartsOn: 1 }) + 1

  const emptyStateTitle = panelState.mode === 'daily'
    ? `${formatSafeDate(panelState.date, 'yyyy年M月d日', '')} 暂无日报`
    : `第${panelState.week.weekNumber}周 周报 (${formatSafeDate(panelState.week.weekStart, 'yyyy-MM-dd', '')} ~ ${formatSafeDate(panelState.week.weekEnd, 'yyyy-MM-dd', '')})`
  const emptyStateButton = panelState.mode === 'daily' ? '生成日报' : '生成周报'
  const isDailyPanel = panelState.mode === 'daily'
  const hasDailyReport = isDailyPanel && selectedReport?.type === 'daily'
  const isGenerating = generateMutation.isPending
  const progressPercent = reportProgress ? Math.max(0, Math.min(100, Math.round(reportProgress.percent))) : null
  const progressTone = reportProgress?.status === 'error'
    ? 'bg-red-500'
    : reportProgress?.status === 'done'
      ? 'bg-emerald-500'
      : 'bg-[hsl(var(--accent))]'
  const reportDateText = selectedReport
    ? selectedReport.start_date === selectedReport.end_date ? selectedReport.start_date : `${selectedReport.start_date} ~ ${selectedReport.end_date}`
    : ''
  const reportTypeLabel = selectedReport?.type === 'daily' ? '日报' : '周报'

  return (
    <div className="space-y-10">
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
          {hasDailyReport ? (
            <Button onClick={handleUpdateDaily} disabled={isGenerating}>
              <Sparkles className="h-4 w-4" />
              {isGenerating && reportProgress?.mode === 'update' ? '更新中...' : '更新日报'}
            </Button>
          ) : (
            <Button onClick={openGenerateWithPanel} disabled={isGenerating}>
              <Sparkles className="h-4 w-4" />
              {isGenerating ? '生成中...' : isDailyPanel ? '生成日报' : '生成报告'}
            </Button>
          )}
        </div>
      </div>

      {reportProgress && progressPercent !== null ? (
        <Card>
          <CardContent className="space-y-2 p-4">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">
                {reportProgress.mode === 'update' ? '更新日报进度' : '生成报告进度'}
              </span>
              <span className="text-muted-foreground">{progressPercent}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn('h-full transition-all', progressTone)}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{reportProgress.message}</p>
          </CardContent>
        </Card>
      ) : null}

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
              {WEEK_DAYS.map((day) => <span key={day} className="py-1">{day}</span>)}
            </div>
            <div className="space-y-3">
              {weekRows.map((week, weekIndex) => {
                const weekDays = calendarDays.slice(weekIndex * 7, weekIndex * 7 + 7)
                const weeklyReport = weeklyMap.get(week.weekNumber)
                const isWeeklySelected = panelState.mode === 'weekly' && panelState.week.weekNumber === week.weekNumber
                return (
                  <div key={week.weekNumber} className="space-y-2">
                    <div className="grid grid-cols-7 gap-2">
                      {weekDays.map((day) => {
                        const dailyReport = dailyMap.get(day.dateKey)
                        const isSelected = panelState.mode === 'daily' && isSameDay(panelState.date, day.date)
                        return (
                          <button
                            key={day.dateKey}
                            type="button"
                            disabled={!day.isCurrentMonth}
                            onClick={() => handleSelectDate(day.date, day.isCurrentMonth)}
                            className={cn(
                              'flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-sm transition',
                              day.isCurrentMonth ? 'border-transparent hover:bg-muted/60' : 'cursor-not-allowed border-transparent text-muted-foreground',
                              dailyReport && day.isCurrentMonth && 'bg-emerald-50/60',
                              isSelected && 'border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10'
                            )}
                          >
                            <span className={cn('flex h-7 w-7 items-center justify-center rounded-full', isToday(day.date) && day.isCurrentMonth ? 'bg-primary text-primary-foreground' : 'text-foreground')}>
                              {format(day.date, 'd')}
                            </span>
                            {day.isCurrentMonth && (
                              <span className={cn('h-2 w-2 rounded-full', dailyReport ? 'bg-emerald-500' : 'border border-muted-foreground')} />
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
                        isWeeklySelected ? 'border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10' : 'border-dashed border-border hover:bg-muted/40'
                      )}
                    >
                      <span className="text-muted-foreground">周报 W{week.weekNumber}</span>
                      <span className={cn('h-2 w-2 rounded-full', weeklyReport ? 'bg-emerald-500' : 'border border-muted-foreground')} />
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
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">加载中...</div>
            ) : isReportLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">报告加载中...</div>
            ) : selectedReport ? (
              <div className="space-y-6">
                {isEditing ? (
                  <form onSubmit={handleSaveEdit} className="space-y-6">
                    <div className="space-y-3">
                      <Input value={editForm.title} onChange={(e) => store.getState().setEditForm({ title: e.target.value })} maxLength={200} required />
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="soft" tone={selectedReport.type === 'daily' ? 'info' : 'accent'}>{reportTypeLabel}</Badge>
                        <span>{reportDateText}</span>
                        <span>{selectedReport.created_at?.split('T')[0]}</span>
                      </div>
                    </div>
                    <MarkdownEditor
                      value={editForm.content}
                      onChange={(content) => store.getState().setEditForm({ content })}
                      required
                      components={MARKDOWN_COMPONENTS}
                      normalizeContent={normalizeReportMarkdown}
                    />
                    <div className="flex items-center gap-2">
                      <Button type="submit" disabled={updateMutation.isPending}>{updateMutation.isPending ? '保存中...' : '保存'}</Button>
                      <Button type="button" variant="secondary" onClick={handleCancelEdit}>取消</Button>
                    </div>
                  </form>
                ) : (
                  <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="space-y-2">
                        <h2 className="text-2xl font-semibold text-foreground">{selectedReport.title}</h2>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <Badge variant="soft" tone={selectedReport.type === 'daily' ? 'info' : 'accent'}>{reportTypeLabel}</Badge>
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
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600" onClick={handleDeleteReport} disabled={deleteMutation.isPending} aria-label="删除报告">
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
                <Button onClick={openGenerateWithPanel} disabled={isGenerating}>
                  {isGenerating ? '处理中...' : emptyStateButton}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isGenerateModalOpen} onOpenChange={(open) => { if (!open) store.getState().closeGenerateModal() }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>生成报告</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label>报告类型</Label>
              <Select value={generateForm.type} onValueChange={(value) => store.getState().setGenerateForm({ type: value })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">日报</SelectItem>
                  <SelectItem value="weekly">周报</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>开始日期</Label>
                <Input type="date" value={generateForm.startDate} onChange={(e) => store.getState().setGenerateForm({ startDate: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label>结束日期</Label>
                <Input type="date" value={generateForm.endDate} onChange={(e) => store.getState().setGenerateForm({ endDate: e.target.value })} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label>作者邮箱（可选）</Label>
              <Input type="email" value={generateForm.authorEmail} onChange={(e) => store.getState().setGenerateForm({ authorEmail: e.target.value })} placeholder="留空则使用全局设置" />
            </div>
            {reportProgress && reportProgress.mode === 'generate' && progressPercent !== null ? (
              <div className="space-y-2 rounded-lg border border-border/60 bg-muted/40 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{reportProgress.message}</span>
                  <span>{progressPercent}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn('h-full transition-all', progressTone)}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => store.getState().closeGenerateModal()}>取消</Button>
              <Button type="submit" disabled={generateMutation.isPending}>{generateMutation.isPending ? '生成中...' : '生成'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isDiscardDialogOpen}
        onOpenChange={(open) => {
          setIsDiscardDialogOpen(open)
          if (!open) pendingDiscardActionRef.current = null
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>放弃未保存的修改？</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">当前内容尚未保存，继续操作会丢失本次编辑内容。</p>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={handleKeepEditing}>
              继续编辑
            </Button>
            <Button type="button" onClick={handleConfirmDiscard}>
              放弃修改
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
