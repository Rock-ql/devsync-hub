import { cn } from '@/lib/utils'

export function HeroGraphic({ className }: { className?: string }) {
  return (
    <div
      className={cn('relative h-[420px] w-full pointer-events-none', className)}
      aria-hidden="true"
    >
      <div className="absolute -right-10 -top-10 h-52 w-52 rounded-full bg-[hsl(var(--accent))]/10 blur-[120px]" />
      <div className="absolute -bottom-6 left-6 h-40 w-40 rounded-full bg-[hsl(var(--accent))]/10 blur-[120px]" />

      <div className="absolute inset-0 flex items-center justify-center">
        <div className="h-72 w-72 rounded-full border border-dashed border-[hsl(var(--accent))]/30 animate-spin-slower motion-reduce:animate-none" />
      </div>

      <div className="absolute left-8 top-10 h-16 w-16 rounded-2xl bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] shadow-accent" />

      <div className="absolute right-8 top-16 h-24 w-36 rounded-2xl border border-border bg-white/80 p-4 shadow-lg backdrop-blur animate-float-slow motion-reduce:animate-none" />

      <div
        className="absolute left-10 bottom-16 h-20 w-28 rounded-2xl border border-border bg-card shadow-xl animate-float-slow motion-reduce:animate-none"
        style={{ animationDelay: '1.2s' }}
      />

      <div className="absolute right-12 bottom-8 h-10 w-10 rounded-xl bg-[hsl(var(--accent))] shadow-accent" />

      <div className="absolute right-16 top-44 grid grid-cols-3 gap-1">
        {Array.from({ length: 9 }).map((_, index) => (
          <span
            key={index}
            className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--accent))]/50"
          />
        ))}
      </div>
    </div>
  )
}
