import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Pencil, Plus, Save, Trash2, X } from 'lucide-react'
import { sqlApi, SqlEnvConfig } from '@/api/sql'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/components/ui/toaster'

interface SqlEnvConfigDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId?: number
  projectName?: string
  onChanged?: () => void
}

export default function SqlEnvConfigDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  onChanged,
}: SqlEnvConfigDialogProps) {
  const queryClient = useQueryClient()
  const [newEnvCode, setNewEnvCode] = useState('')
  const [newEnvName, setNewEnvName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')

  const canQuery = open && !!projectId

  const { data: envs, isLoading } = useQuery<SqlEnvConfig[]>({
    queryKey: ['sql-env-configs', projectId],
    queryFn: () => sqlApi.listEnvConfigs(projectId as number),
    enabled: canQuery,
  })

  useEffect(() => {
    if (!open) {
      setNewEnvCode('')
      setNewEnvName('')
      setEditingId(null)
      setEditingName('')
    }
  }, [open])

  const addMutation = useMutation({
    mutationFn: () => sqlApi.addEnvConfig({
      project_id: projectId as number,
      env_code: newEnvCode.trim(),
      env_name: newEnvName.trim(),
    }),
    onSuccess: () => {
      toast.success('环境已添加')
      setNewEnvCode('')
      setNewEnvName('')
      queryClient.invalidateQueries({ queryKey: ['sql-env-configs', projectId] })
      onChanged?.()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`添加失败：${message}`)
    },
  })

  const updateMutation = useMutation({
    mutationFn: (payload: { id: number; env_name?: string; sort_order?: number }) =>
      sqlApi.updateEnvConfig(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sql-env-configs', projectId] })
      onChanged?.()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`更新失败：${message}`)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sqlApi.deleteEnvConfig(id),
    onSuccess: () => {
      toast.success('环境已删除')
      queryClient.invalidateQueries({ queryKey: ['sql-env-configs', projectId] })
      onChanged?.()
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`删除失败：${message}`)
    },
  })

  const list = useMemo(() => envs || [], [envs])

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (updateMutation.isPending) return
    if (!list.length) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= list.length) return

    const a = list[index]
    const b = list[targetIndex]

    try {
      await Promise.all([
        sqlApi.updateEnvConfig({ id: a.id, sort_order: b.sort_order }),
        sqlApi.updateEnvConfig({ id: b.id, sort_order: a.sort_order }),
      ])
      queryClient.invalidateQueries({ queryKey: ['sql-env-configs', projectId] })
      onChanged?.()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      toast.error(`排序失败：${message}`)
    }
  }

  const handleStartEdit = (item: SqlEnvConfig) => {
    setEditingId(item.id)
    setEditingName(item.env_name)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingName('')
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const name = editingName.trim()
    if (!name) {
      toast.error('环境名称不能为空')
      return
    }
    updateMutation.mutate({ id: editingId, env_name: name })
    setEditingId(null)
    setEditingName('')
    toast.success('环境已更新')
  }

  const handleAdd = () => {
    if (!projectId) return
    const code = newEnvCode.trim()
    const name = newEnvName.trim()
    if (!code) {
      toast.error('请输入环境编码')
      return
    }
    if (!name) {
      toast.error('请输入环境名称')
      return
    }
    addMutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            SQL 执行环境配置{projectName ? ` - ${projectName}` : ''}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">加载中...</p>
        ) : list.length ? (
          <div className="space-y-3">
            {list.map((item, index) => {
              const isEditing = editingId === item.id
              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-muted px-2 py-1 text-xs">{item.env_code}</code>
                      {isEditing ? (
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="h-9 max-w-[240px]"
                        />
                      ) : (
                        <span className="truncate text-sm font-medium text-foreground">{item.env_name}</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">排序：{item.sort_order}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      disabled={index === 0}
                      onClick={() => handleMove(index, 'up')}
                      aria-label="上移"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0"
                      disabled={index === list.length - 1}
                      onClick={() => handleMove(index, 'down')}
                      aria-label="下移"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>

                    {isEditing ? (
                      <>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={updateMutation.isPending}
                        >
                          <Save className="h-4 w-4" />
                          保存
                        </Button>
                        <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                          <X className="h-4 w-4" />
                          取消
                        </Button>
                      </>
                    ) : (
                      <Button variant="secondary" size="sm" onClick={() => handleStartEdit(item)}>
                        <Pencil className="h-4 w-4" />
                        编辑
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                      onClick={() => {
                        if (!confirm(`确定删除环境 ${item.env_name} 吗？`)) return
                        deleteMutation.mutate(item.id)
                      }}
                      aria-label="删除"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">暂无环境配置</p>
        )}

        <div className="mt-4 rounded-xl border border-dashed border-border p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-foreground">新增环境</div>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>环境编码 *</Label>
              <Input
                value={newEnvCode}
                onChange={(e) => setNewEnvCode(e.target.value)}
                placeholder="例如：uat"
              />
            </div>
            <div className="space-y-2">
              <Label>环境名称 *</Label>
              <Input
                value={newEnvName}
                onChange={(e) => setNewEnvName(e.target.value)}
                placeholder="例如：预发"
              />
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="secondary"
              type="button"
              onClick={handleAdd}
              disabled={!projectId || addMutation.isPending}
            >
              <Plus className="h-4 w-4" />
              {addMutation.isPending ? '添加中...' : '添加环境'}
            </Button>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button variant="secondary" type="button" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
