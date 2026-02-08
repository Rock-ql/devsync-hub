import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        solid: '',
        soft: '',
        outline: 'border',
      },
      tone: {
        accent: '',
        success: '',
        warning: '',
        info: '',
        neutral: '',
      },
    },
    compoundVariants: [
      {
        variant: 'solid',
        tone: 'accent',
        className: 'bg-[hsl(var(--accent))] text-white',
      },
      {
        variant: 'soft',
        tone: 'accent',
        className: 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))]',
      },
      {
        variant: 'outline',
        tone: 'accent',
        className:
          'border-[hsl(var(--accent))]/40 text-[hsl(var(--accent))]',
      },
      {
        variant: 'solid',
        tone: 'success',
        className: 'bg-emerald-500 text-white',
      },
      {
        variant: 'soft',
        tone: 'success',
        className: 'bg-emerald-100 text-emerald-700',
      },
      {
        variant: 'outline',
        tone: 'success',
        className: 'border-emerald-200 text-emerald-700',
      },
      {
        variant: 'solid',
        tone: 'warning',
        className: 'bg-amber-500 text-white',
      },
      {
        variant: 'soft',
        tone: 'warning',
        className: 'bg-amber-100 text-amber-700',
      },
      {
        variant: 'outline',
        tone: 'warning',
        className: 'border-amber-200 text-amber-700',
      },
      {
        variant: 'solid',
        tone: 'info',
        className: 'bg-sky-500 text-white',
      },
      {
        variant: 'soft',
        tone: 'info',
        className: 'bg-sky-100 text-sky-700',
      },
      {
        variant: 'outline',
        tone: 'info',
        className: 'border-sky-200 text-sky-700',
      },
      {
        variant: 'solid',
        tone: 'neutral',
        className: 'bg-slate-900 text-white',
      },
      {
        variant: 'soft',
        tone: 'neutral',
        className: 'bg-slate-100 text-slate-600',
      },
      {
        variant: 'outline',
        tone: 'neutral',
        className: 'border-slate-200 text-slate-600',
      },
    ],
    defaultVariants: {
      variant: 'soft',
      tone: 'accent',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  return (
    <span
      className={cn(badgeVariants({ variant, tone }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
