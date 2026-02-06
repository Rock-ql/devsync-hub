import { useEffect, useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { requirementApi, RequirementItem } from '@/api/requirement'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { toast } from '@/components/ui/toaster'

interface ProjectOption {
  id: number
  name: string
}

interface RequirementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  iterationId: number
  iterationName: string
  projects: ProjectOption[]
  initialData?: RequirementItem | null
  onSaved?: () => void
}

export default function RequirementDialog({
  open,
  onOpenChange,
  iterationId,
  iterationName,
  projects,
  initialData,
  onSaved,
}: RequirementDialogProps) {
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([])
  const [status, setStatus] = useState('presented')
  const [branch, setBranch] = useState('')

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

  const isEditing = !!initialData?.id

  useEffect(() => {
    if (open) {
      setName(initialData?.name || '')
      setLink(initialData?.link || '')
      setSelectedProjectIds(initialData?.projectIds || [])
      setStatus(initialData?.status || 'presented')
      setBranch(initialData?.branch || '')
    }
  }, [open, initialData])

  const projectOptions = useMemo(() => projects || [], [projects])

  const editableStatusOptions = useMemo(() => {
    if (!isEditing) {
      return statusOptions
    }

    const current = initialData?.status || 'presented'
    const index = statusOptions.findIndex((item) => item.code === current)
    if (index < 0) {
      return statusOptions.slice(0, 1)
    }

    const candidates: Array<{ code: string; desc: string }> = []
    if (index - 1 >= 0) candidates.push(statusOptions[index - 1])
    candidates.push(statusOptions[index])
    if (index + 1 < statusOptions.length) candidates.push(statusOptions[index + 1])
    return candidates
  }, [initialData?.status, isEditing])

  const saveMutation = useMutation({
    mutationFn: () => {
      if (isEditing && initialData) {
        return requirementApi.update({
          id: initialData.id,
          name: name.trim(),
          link: link.trim(),
          projectIds: selectedProjectIds,
          status,
          branch: branch.trim(),
        })
      }
      return requirementApi.add({
        iterationId,
        name: name.trim(),
        link: link.trim(),
        projectIds: selectedProjectIds,
        status,
        branch: branch.trim(),
      })
    },
    onSuccess: () => {
      toast.success(isEditing ? '需求已更新' : '需求已新增')
      onOpenChange(false)
      onSaved?.()
    },
    onError: (error: Error) => toast.error(error.message),
  })

  const handleToggleProject = (projectId: number) => {
    setSelectedProjectIds((prev) => {
      if (prev.includes(projectId)) {
        return prev.filter((id) => id !== projectId)
      }
      return [...prev, projectId]
    })
  }

  const canSubmit = name.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? '编辑需求' : `添加需求 - ${iterationName}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>需求名称 *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="输入需求名称"
            />
          </div>
          <div className="space-y-2">
            <Label>需求链接</Label>
            <Input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://..."
            />
            <p className="text-xs text-muted-foreground">填写后名称可直接跳转</p>
          </div>
          <div className="space-y-2">
            <Label>关联项目（可多选）</Label>
            <div className="grid gap-2 sm:grid-cols-2">
              {projectOptions.length ? projectOptions.map((project) => (
                <label
                  key={project.id}
                  className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground"
                >
                  <input
                    type="checkbox"
                    checked={selectedProjectIds.includes(project.id)}
                    onChange={() => handleToggleProject(project.id)}
                    className="h-4 w-4 accent-[hsl(var(--accent))]"
                  />
                  <span className="text-foreground">{project.name}</span>
                </label>
              )) : (
                <p className="text-sm text-muted-foreground">暂无项目可选</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>需求状态</Label>
            <Select value={status} onChange={(e) => setStatus(e.target.value)}>
              {editableStatusOptions.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.desc}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label>关联分支</Label>
            <Input
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              placeholder="如 feat/user-auth"
            />
            <p className="text-xs text-muted-foreground">填写该需求对应的开发分支名称</p>
          </div>
        </div>
        <DialogFooter className="pt-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button type="button" disabled={!canSubmit || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? '保存中...' : '保存'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
