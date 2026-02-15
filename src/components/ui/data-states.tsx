import { cn } from '@/lib/utils'

export function ListSkeleton({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 p-4 animate-pulse">
          <div className="space-y-2 flex-1">
            <div className="h-4 w-1/3 rounded bg-muted" />
            <div className="h-3 w-1/5 rounded bg-muted" />
          </div>
          <div className="h-6 w-16 rounded bg-muted" />
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ message = '暂无数据', className }: { message?: string; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-dashed border-border p-8 text-center', className)}>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  )
}

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: Error | null
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn('rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/10 p-6 text-center space-y-3', className)}>
      <p className="text-sm text-red-600 dark:text-red-400">{error?.message || '加载失败'}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-border px-4 py-1.5 text-xs text-foreground transition hover:bg-muted"
        >
          重试
        </button>
      )}
    </div>
  )
}
