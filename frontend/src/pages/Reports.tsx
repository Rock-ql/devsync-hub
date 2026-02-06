import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/api'
import {
  addDays,
  addMonths,
  differenceInCalendarWeeks,
  endOfMonth,
  endOfWeek,
  format,
  getDaysInMonth,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Copy, Pencil, Sparkles, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUnsavedWarning } from '@/hooks/useUnsavedWarning'

interface Report {
  id: number
  type: string
  typeDesc: string
  title: string
  content: string
  startDate: string
  endDate: string
  createdAt: string
}

interface MonthSummary {
  dailyReports: Array<{ date: string; id: number; title: string }>
  weeklyReports: Array<{ weekNumber: number; id: number; startDate: string; endDate: string }>
}

interface WeekRow {
  weekNumber: number
  weekStart: Date
  weekEnd: Date
}

type PanelState =
  | { mode: 'daily'; date: Date }
  | { mode: 'weekly'; week: WeekRow }

const WEEK_DAYS = ['一', '二', '三', '四', '五', '六', '日']

export default function Reports() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => startOfMonth(today))
  const [panelState, setPanelState] = useState<PanelState>(() => ({ mode: 'daily', date: today }))
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [generateForm, setGenerateForm] = useState({
    type: 'daily',
    startDate: format(today, 'yyyy-MM-dd'),
    endDate: format(today, 'yyyy-MM-dd'),
    authorEmail: '',
  })
  const [isEditing, setIsEditing] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [editForm, setEditForm] = useState({ title: '', content: '' })
  const [copySuccess, setCopySuccess] = useState(false)
  const { confirmLeave } = useUnsavedWarning(hasUnsavedChanges)

  const { data: settings } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => api.get('/setting/all'),
  })

  const monthStart = startOfMonth(selectedMonth)
  const monthEnd = endOfMonth(selectedMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const weekRows = useMemo<WeekRow[]>(() => {
    return Array.from({ length: 6 }, (_, index) => {
      const weekStart = addDays(calendarStart, index * 7)
      return {
        weekNumber: index + 1,
        weekStart,
        weekEnd: addDays(weekStart, 6),
      }
    })
  }, [calendarStart])

  const calendarDays = useMemo(() => {
    return Array.from({ length: 42 }, (_, index) => {
      const date = addDays(calendarStart, index)
      return {
        date,
        dateKey: format(date, 'yyyy-MM-dd'),
        isCurrentMonth: isSameMonth(date, selectedMonth),
      }
    })
  }, [calendarStart, selectedMonth])

  const { data: monthSummary, isLoading: isMonthLoading } = useQuery<MonthSummary>({
    queryKey: ['report-month-summary', format(selectedMonth, 'yyyy-MM')],
    queryFn: () =>
      api.post('/report/month-summary', {
        year: selectedMonth.getFullYear(),
        month: selectedMonth.getMonth() + 1,
      }),
  })

  const dailyMap = useMemo(() => {
    return new Map(monthSummary?.dailyReports.map((item) => [item.date, item]) ?? [])
  }, [monthSummary])

  const weeklyMap = useMemo(() => {
    return new Map(monthSummary?.weeklyReports.map((item) => [item.weekNumber, item]) ?? [])
  }, [monthSummary])

  const selectedReportId = useMemo(() => {
    if (!monthSummary) return null
    if (panelState.mode === 'daily') {
      const key = format(panelState.date, 'yyyy-MM-dd')
      return dailyMap.get(key)?.id ?? null
    }
    return weeklyMap.get(panelState.week.weekNumber)?.id ?? null
  }, [dailyMap, monthSummary, panelState, weeklyMap])

  const { data: selectedReport, isLoading: isReportLoading } = useQuery<Report>({
    queryKey: ['report-detail', selectedReportId],
    queryFn: () => api.get(`/report/detail/${selectedReportId}`),
    enabled: selectedReportId !== null,
  })

  const generateMutation = useMutation({
    mutationFn: (data: typeof generateForm) => api.post<Report>('/report/generate', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['report-month-summary'] })
      queryClient.invalidateQueries({ queryKey: ['report-detail'] })
      setIsGenerateModalOpen(false)
      const startDate = parseISO(data.startDate)
      const nextMonth = startOfMonth(startDate)
      setSelectedMonth(nextMonth)
      if (data.type === 'weekly') {
        const weekNumber = resolveWeekNumber(startDate, nextMonth)
        const weekStart = addDays(startOfWeek(nextMonth, { weekStartsOn: 1 }), (weekNumber - 1) * 7)
        setPanelState({
          mode: 'weekly',
          week: {
            weekNumber,
            weekStart,
            weekEnd: addDays(weekStart, 6),
          },
        })
      } else {
        setPanelState({ mode: 'daily', date: startDate })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.post(`/report/delete/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-month-summary'] })
      queryClient.invalidateQueries({ queryKey: ['report-detail'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; content: string }) =>
      api.post('/report/update', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-month-summary'] })
      queryClient.invalidateQueries({ queryKey: ['report-detail', selectedReportId] })
      setIsEditing(false)
      setHasUnsavedChanges(false)
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
    const nextMonth = addMonths(selectedMonth, offset)
    setSelectedMonth(nextMonth)
    setIsEditing(false)
    setHasUnsavedChanges(false)
    setPanelState({ mode: 'daily', date: startOfMonth(nextMonth) })
  }

  const openGenerateWithPanel = () => {
    const savedEmail = settings?.['git.author.email'] || ''
    if (panelState.mode === 'daily') {
      const dateValue = format(panelState.date, 'yyyy-MM-dd')
      setGenerateForm({ type: 'daily', startDate: dateValue, endDate: dateValue, authorEmail: savedEmail })
    } else {
      const startValue = format(panelState.week.weekStart, 'yyyy-MM-dd')
      const endValue = format(panelState.week.weekEnd, 'yyyy-MM-dd')
      setGenerateForm({ type: 'weekly', startDate: startValue, endDate: endValue, authorEmail: savedEmail })
    }
    setIsGenerateModalOpen(true)
  }

  const dailyCompleted = monthSummary?.dailyReports.length ?? 0
  const weeklyCompleted = monthSummary?.weeklyReports.length ?? 0
  const dailyTotal = getDaysInMonth(selectedMonth)
  const weeklyTotal =
    differenceInCalendarWeeks(calendarEnd, calendarStart, { weekStartsOn: 1 }) + 1

  const emptyStateTitle =
    panelState.mode === 'daily'
      ? `${format(panelState.date, 'yyyy年M月d日')} 暂无日报`
      : `第${panelState.week.weekNumber}周 周报 (${format(panelState.week.weekStart, 'yyyy-MM-dd')} ~ ${format(panelState.week.weekEnd, 'yyyy-MM-dd')})`

  const emptyStateButton = panelState.mode === 'daily' ? '生成日报' : '生成周报'

  const reportDateText = selectedReport
    ? selectedReport.startDate === selectedReport.endDate
      ? selectedReport.startDate
      : `${selectedReport.startDate} ~ ${selectedReport.endDate}`
    : ''

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
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => handleMonthChange(-1)}
                aria-label="上个月"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>{format(selectedMonth, 'yyyy年M月')}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 w-9 p-0"
                onClick={() => handleMonthChange(1)}
                aria-label="下个月"
              >
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
                <span key={day} className="py-1">
                  {day}
                </span>
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
                                  dailyReport
                                    ? 'bg-emerald-500'
                                    : 'border border-muted-foreground'
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
                          weeklyReport
                            ? 'bg-emerald-500'
                            : 'border border-muted-foreground'
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
                        <Badge
                          variant="soft"
                          tone={selectedReport.type === 'daily' ? 'info' : 'accent'}
                        >
                          {selectedReport.typeDesc}
                        </Badge>
                        <span>{reportDateText}</span>
                        <span>{selectedReport.createdAt?.split('T')[0]}</span>
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
                          <Badge
                            variant="soft"
                            tone={selectedReport.type === 'daily' ? 'info' : 'accent'}
                          >
                            {selectedReport.typeDesc}
                          </Badge>
                          <span>{reportDateText}</span>
                          <span>{selectedReport.createdAt?.split('T')[0]}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={handleCopy}
                          aria-label="复制报告内容"
                        >
                          {copySuccess ? (
                            <Check className="h-4 w-4 text-emerald-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0"
                          onClick={handleStartEdit}
                          aria-label="编辑报告"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => {
                            if (confirm('确定要删除此报告吗？')) {
                              deleteMutation.mutate(selectedReport.id)
                            }
                          }}
                          aria-label="删除报告"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="markdown text-sm text-foreground">
                      <ReactMarkdown>{selectedReport.content}</ReactMarkdown>
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
              <Select
                value={generateForm.type}
                onChange={(e) => setGenerateForm({ ...generateForm, type: e.target.value })}
              >
                <option value="daily">日报</option>
                <option value="weekly">周报</option>
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
              <Label>作者邮箱</Label>
              <Input
                value={generateForm.authorEmail}
                onChange={(e) => setGenerateForm({ ...generateForm, authorEmail: e.target.value })}
                placeholder="留空则获取所有人的提交"
              />
              <p className="text-xs text-muted-foreground">默认读取系统设置中的 Git 作者邮箱，可在此覆盖</p>
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsGenerateModalOpen(false)}
              >
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

function resolveWeekNumber(anchorDate: Date, monthStart: Date) {
  const offset = monthStart.getDay() === 0 ? 6 : monthStart.getDay() - 1
  const index = anchorDate.getDate() + offset - 1
  return Math.floor(index / 7) + 1
}
