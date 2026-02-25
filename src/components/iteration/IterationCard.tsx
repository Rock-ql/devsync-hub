import type { ReactNode } from 'react'
import { IterationDetail } from '@/api/iteration'
import { Project } from '@/api/project'
import RequirementList from '@/components/requirement/RequirementList'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ChevronDown, ChevronRight, Pencil, Trash2 } from 'lucide-react'

export interface IterationCardProps {
  iteration: IterationDetail
  projects: Project[]
  isExpanded: boolean
  onToggleRequirements: () => void
  onStatusChange: (status: string) => void
  onEdit: () => void
  onDelete: () => void
}

const STATUS_OPTIONS = [
  { value: 'planning', label: '规划中' },
  { value: 'developing', label: '开发中' },
  { value: 'testing', label: '测试中' },
  { value: 'released', label: '已上线' },
]

const sqlTone = (count?: number): 'success' | 'warning' => (count && count > 0 ? 'warning' : 'success')

const formatProjects = (names?: string[]) => {
  if (!names?.length) return '未关联项目'
  const visible = names.slice(0, 3)
  const extra = names.length - visible.length
  return extra > 0 ? `${visible.join(', ')} +${extra}` : visible.join(', ')
}

const formatRange = (start?: string | null, end?: string | null) => {
  if (start && end) return `${start} ~ ${end}`
  return '未设置时间'
}

const StatLabel = ({ label }: { label: string }) => (
  <span className="text-sm font-medium text-muted-foreground">{label}</span>
)

const StatPanel = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex min-h-[132px] flex-col justify-between rounded-2xl border border-border/60 bg-muted/20 p-4">
    <StatLabel label={label} />
    {children}
  </div>
)

export default function IterationCard({
  iteration,
  projects,
  isExpanded,
  onToggleRequirements,
  onStatusChange,
  onEdit,
  onDelete,
}: IterationCardProps) {
  const pendingSqlCount = iteration.pending_sql_count ?? 0
  const requirementCount = iteration.requirement_count ?? 0

  return (
    <Card className="space-y-0 overflow-hidden rounded-2xl border border-border/70 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-border/60 p-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">迭代 #{iteration.id}</div>
          <div className="space-y-1">
            <h2 className="text-xl font-semibold text-foreground">{iteration.name}</h2>
            <p className="text-sm text-muted-foreground">{formatProjects(iteration.project_names)}</p>
            {iteration.description ? (
              <p className="text-sm text-muted-foreground/90">{iteration.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-start">
          <Button variant="ghost" size="sm" className="h-9 w-9 p-0" onClick={onEdit} aria-label="编辑迭代">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
            onClick={onDelete}
            aria-label="删除迭代"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border-t border-border/60 bg-muted/10 p-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatPanel label="状态">
            <Select value={iteration.status} onValueChange={onStatusChange}>
              <SelectTrigger size="md" className="h-11 border-border/70 bg-background shadow-sm">
                <SelectValue placeholder="选择状态" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </StatPanel>

          <StatPanel label="时间范围">
            <p className="text-lg font-semibold leading-snug text-foreground">
              {formatRange(iteration.start_date, iteration.end_date)}
            </p>
          </StatPanel>

          <StatPanel label="待执行 SQL">
            <div className="space-y-3">
              <div className="flex items-end justify-between">
                <span className="text-3xl font-semibold leading-none tabular-nums text-foreground">{pendingSqlCount}</span>
                <Badge tone={sqlTone(pendingSqlCount)} variant="soft" className="px-3 py-1 text-sm font-medium">
                  {pendingSqlCount > 0 ? '待处理' : '空闲'}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">SQL 脚本</p>
            </div>
          </StatPanel>

          <StatPanel label="关联需求">
            <div className="space-y-3">
              <p className="text-3xl font-semibold leading-none tabular-nums text-foreground">{requirementCount}</p>
              <Button
                variant="secondary"
                className="h-10 w-full justify-between border border-border/70 bg-background/80 px-3 text-sm"
                onClick={onToggleRequirements}
                size="sm"
              >
                <span>{isExpanded ? '收起详情' : '查看详情'}</span>
                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </Button>
            </div>
          </StatPanel>
        </div>
      </div>

      {isExpanded ? (
        <div className="border-t border-border/60 bg-muted/40 p-6">
          <RequirementList iterationId={iteration.id} iterationName={iteration.name} projects={projects} />
        </div>
      ) : null}
    </Card>
  )
}
