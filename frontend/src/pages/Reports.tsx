import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api, { PageResult } from '@/api'
import { FileText, Trash2, Sparkles, Pencil, Copy, Check } from 'lucide-react'
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

export default function Reports() {
  const queryClient = useQueryClient()
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false)
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [generateForm, setGenerateForm] = useState({
    type: 'daily',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  })
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editForm, setEditForm] = useState({ id: 0, title: '', content: '' })
  const [copySuccess, setCopySuccess] = useState(false)

  const { data: reports, isLoading } = useQuery<PageResult<Report>>({
    queryKey: ['reports'],
    queryFn: () => api.post('/report/list', { pageNum: 1, pageSize: 50 }),
  })

  const generateMutation = useMutation({
    mutationFn: (data: typeof generateForm) => api.post<Report>('/report/generate', data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setIsGenerateModalOpen(false)
      setSelectedReport(data)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.post(`/report/delete/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      if (selectedReport) setSelectedReport(null)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: { id: number; title: string; content: string }) =>
      api.post('/report/update', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      setIsEditModalOpen(false)
      if (selectedReport) {
        setSelectedReport({ ...selectedReport, title: editForm.title, content: editForm.content })
      }
    },
  })

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault()
    generateMutation.mutate(generateForm)
  }

  const handleOpenEdit = () => {
    if (selectedReport) {
      setEditForm({ id: selectedReport.id, title: selectedReport.title, content: selectedReport.content })
      setIsEditModalOpen(true)
    }
  }

  const handleEdit = (e: React.FormEvent) => {
    e.preventDefault()
    updateMutation.mutate(editForm)
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

  const handleGenerateModalChange = (open: boolean) => {
    setIsGenerateModalOpen(open)
  }

  const handleEditModalChange = (open: boolean) => {
    setIsEditModalOpen(open)
  }

  if (isLoading) {
    return <div className="text-center py-12 text-muted-foreground">加载中...</div>
  }

  return (
    <div className="space-y-10">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-4">
          <SectionLabel>REPORTS</SectionLabel>
          <div>
            <h1 className="text-3xl font-display">日报周报</h1>
            <p className="mt-2 text-sm text-muted-foreground">AI 自动生成高质量工作报告</p>
          </div>
        </div>
        <Button onClick={() => setIsGenerateModalOpen(true)}>
          <Sparkles className="h-4 w-4" />
          生成报告
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-full">
          <CardHeader>
            <CardTitle>历史报告</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {reports?.list?.map((report) => (
              <button
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 text-left transition',
                  selectedReport?.id === report.id
                    ? 'border-[hsl(var(--accent))]/40 bg-[hsl(var(--accent))]/5 shadow-sm'
                    : 'border-transparent hover:bg-muted/60'
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">
                    {report.title}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant="soft"
                    tone={report.type === 'daily' ? 'info' : 'accent'}
                  >
                    {report.typeDesc}
                  </Badge>
                  <span>{report.createdAt?.split('T')[0]}</span>
                </div>
              </button>
            ))}
            {!reports?.list?.length && (
              <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                暂无报告
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full">
          <CardContent className="p-6">
            {selectedReport ? (
              <div className="space-y-6">
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
                      onClick={handleOpenEdit}
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
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                选择一个报告查看详情
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isGenerateModalOpen} onOpenChange={handleGenerateModalChange}>
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
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleGenerateModalChange(false)}
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

      <Dialog open={isEditModalOpen} onOpenChange={handleEditModalChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>编辑报告</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-2">
              <Label>标题</Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
                maxLength={200}
              />
            </div>
            <div className="space-y-2">
              <Label>内容（Markdown 格式）</Label>
              <Textarea
                value={editForm.content}
                onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                rows={15}
                className="font-mono text-sm"
                required
              />
            </div>
            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleEditModalChange(false)}
              >
                取消
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? '保存中...' : '保存'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
