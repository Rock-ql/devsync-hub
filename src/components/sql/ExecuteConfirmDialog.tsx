import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface ExecuteConfirmDialogProps {
  open: boolean
  mode: 'execute' | 'detail'
  envName: string
  sqlTitle: string
  envOptions?: { envCode: string; envName: string; executed?: boolean }[]
  selectedEnvCode?: string
  executedAt?: string
  executor?: string
  remark: string
  onRemarkChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
  onEnvChange?: (value: string) => void
  onRevoke?: () => void
}

export function ExecuteConfirmDialog({
  open,
  mode,
  envName,
  sqlTitle,
  envOptions,
  selectedEnvCode,
  executedAt,
  executor,
  remark,
  onRemarkChange,
  onClose,
  onConfirm,
  onEnvChange,
  onRevoke,
}: ExecuteConfirmDialogProps) {
  const isDetail = mode === 'detail'
  const title = isDetail
    ? `执行详情 - ${envName}`
    : envName
      ? `确认执行 - ${envName}`
      : '确认执行'

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm text-muted-foreground">
          <div>事项：{sqlTitle}</div>
          {!isDetail && envOptions?.length ? (
            <div className="space-y-2">
              <Label>执行环境</Label>
              <Select value={selectedEnvCode || undefined} onValueChange={(value) => onEnvChange?.(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="请选择环境" />
                </SelectTrigger>
                <SelectContent>
                  {envOptions.map((option) => (
                    <SelectItem
                      key={option.envCode}
                      value={option.envCode}
                      disabled={option.executed}
                    >
                      {option.envName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          {isDetail && (
            <div className="space-y-1 text-xs text-muted-foreground">
              <div>执行时间：{executedAt || '-'}</div>
              <div>执行人：{executor || '-'}</div>
            </div>
          )}
          <Textarea
            value={remark}
            onChange={(e) => onRemarkChange(e.target.value)}
            placeholder={isDetail ? '执行备注' : '执行备注（可选）'}
            disabled={isDetail}
          />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            取消
          </Button>
          {isDetail ? (
            <Button onClick={onRevoke}>撤销执行</Button>
          ) : (
            <Button onClick={onConfirm}>确认执行</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
