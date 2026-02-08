import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface AddEnvDialogProps {
  open: boolean
  envCode: string
  envName: string
  onEnvCodeChange: (value: string) => void
  onEnvNameChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function AddEnvDialog({
  open,
  envCode,
  envName,
  onEnvCodeChange,
  onEnvNameChange,
  onClose,
  onConfirm,
}: AddEnvDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>添加环境</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>环境代码</Label>
            <Input value={envCode} onChange={(e) => onEnvCodeChange(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>环境名称</Label>
            <Input value={envName} onChange={(e) => onEnvNameChange(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>取消</Button>
          <Button onClick={onConfirm}>确认添加</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
