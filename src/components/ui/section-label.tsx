import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SectionLabelProps
  extends React.HTMLAttributes<HTMLDivElement> {
  dotClassName?: string
  textClassName?: string
}

export function SectionLabel({
  className,
  dotClassName,
  textClassName,
  children,
  ...props
}: SectionLabelProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-3 rounded-full border border-[hsl(var(--accent))]/30 bg-[hsl(var(--accent))]/5 px-5 py-2',
        className
      )}
      {...props}
    >
      <span
        className={cn(
          'h-2 w-2 rounded-full bg-[hsl(var(--accent))] animate-pulse-dot',
          dotClassName
        )}
      />
      <span
        className={cn(
          'font-mono text-xs uppercase tracking-[0.15em] text-[hsl(var(--accent))]',
          textClassName
        )}
      >
        {children}
      </span>
    </div>
  )
}
