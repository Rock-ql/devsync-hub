import { format } from 'date-fns'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface EnvExecutionItem {
  envCode: string
  envName: string
  executed: boolean
  executedAt?: string
  executor?: string
  remark?: string
}

interface EnvExecutionButtonsProps {
  items: EnvExecutionItem[]
  executedCount: number
  envTotal: number
  onExecute: (envCode: string) => void
  onDetail: (envCode: string) => void
}

export function EnvExecutionButtons({
  items,
  executedCount,
  envTotal,
  onExecute,
  onDetail,
}: EnvExecutionButtonsProps) {
  const formatDate = (value?: string) => {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return format(date, 'MM-dd')
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">环境执行：已完成 {executedCount}/{envTotal}</div>
      <div className="flex flex-wrap gap-3">
        {items.map((item) => {
          const isDone = item.executed
          return (
            <button
              key={item.envCode}
              type="button"
              onClick={() => (isDone ? onDetail(item.envCode) : onExecute(item.envCode))}
              className={cn(
                'flex min-w-[96px] flex-col items-center gap-1 rounded-xl border px-3 py-2 text-xs transition',
                isDone
                  ? 'border-emerald-400/60 bg-emerald-50 text-emerald-700'
                  : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
              )}
            >
              <div className="text-sm font-medium">{item.envName || item.envCode.toUpperCase()}</div>
              {isDone ? (
                <div className="flex items-center gap-1 text-[11px]">
                  <Check className="h-3 w-3" />
                  <span>{formatDate(item.executedAt) || '已执行'}</span>
                </div>
              ) : (
                <div className="text-[11px]">待执行</div>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
