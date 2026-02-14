import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { dashboardApi, DashboardOverview } from '@/api/dashboard'
import { FolderGit2, IterationCw, Database, GitCommit, Target, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { STATUS_LABEL, STATUS_COLOR, ITER_STATUS_LABEL, ITER_STATUS_TONE } from '@/constants/status'

const easeOut: number[] = [0.16, 1, 0.3, 1]

const fadeInUp = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: easeOut },
  },
}

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

export default function Dashboard() {
  const { data, isLoading } = useQuery<DashboardOverview>({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.overview(),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const stats = [
    {
      name: '活跃项目',
      value: data?.active_project_count || 0,
      icon: FolderGit2,
      sub: `${data?.project_count || 0} 个项目`,
    },
    {
      name: '进行中迭代',
      value: data?.active_iteration_count || 0,
      icon: IterationCw,
      sub: `共 ${data?.iteration_count || 0} 个`,
    },
    {
      name: '待执行 SQL',
      value: data?.pending_sql_count || 0,
      icon: Database,
      sub: data?.pending_sql_count ? '需处理' : '已清零',
    },
    {
      name: '需求总数',
      value: data?.requirement_count || 0,
      icon: Target,
      sub: null,
    },
    {
      name: '本周提交',
      value: data?.week_commit_count || 0,
      icon: GitCommit,
      sub: `今日 ${data?.today_commit_count || 0}`,
    },
  ]

  const totalReq = data?.requirement_status_dist?.reduce((s, i) => s + i.count, 0) || 0
  const trendMax = Math.max(...(data?.daily_commit_trend?.map(d => d.count) || [1]), 1)

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
      >
        {stats.map((stat) => (
          <motion.div key={stat.name} variants={fadeInUp}>
            <Card className="group hover:shadow-lg transition-all">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground truncate">{stat.name}</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
                    {stat.sub && (
                      <p className="mt-1 text-xs text-muted-foreground">{stat.sub}</p>
                    )}
                  </div>
                  <div className="shrink-0 rounded-lg bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] p-2.5 shadow-accent transition group-hover:shadow-accent-lg">
                    <stat.icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      {/* Row 2: Requirement Status + Commit Trend */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-6 lg:grid-cols-2"
      >
        {/* Requirement Status Distribution */}
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">需求状态分布</CardTitle>
            </CardHeader>
            <CardContent>
              {totalReq > 0 ? (
                <div className="space-y-4">
                  <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
                    {data!.requirement_status_dist.map((item) => (
                      <div
                        key={item.status}
                        className={`${STATUS_COLOR[item.status] || 'bg-zinc-300'} transition-all`}
                        style={{ width: `${(item.count / totalReq) * 100}%` }}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-x-5 gap-y-2">
                    {data!.requirement_status_dist.map((item) => (
                      <div key={item.status} className="flex items-center gap-2 text-sm">
                        <span className={`h-2.5 w-2.5 rounded-full ${STATUS_COLOR[item.status] || 'bg-zinc-300'}`} />
                        <span className="text-muted-foreground">
                          {STATUS_LABEL[item.status] || item.status}
                        </span>
                        <span className="font-medium">{item.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <EmptyPlaceholder text="暂无需求数据" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 7-day Commit Trend */}
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">近 7 天提交趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.daily_commit_trend?.length ? (
                <div className="flex items-end gap-2 h-32">
                  {data.daily_commit_trend.map((d) => {
                    const pct = trendMax > 0 ? (d.count / trendMax) * 100 : 0
                    const weekday = new Date(d.date + 'T00:00:00').toLocaleDateString('zh-CN', { weekday: 'short' })
                    return (
                      <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{d.count || ''}</span>
                        <div className="w-full relative rounded-t-md bg-muted overflow-hidden" style={{ height: '80px' }}>
                          <div
                            className="absolute bottom-0 w-full rounded-t-md bg-gradient-to-t from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] transition-all"
                            style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 0)}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{weekday}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <EmptyPlaceholder text="暂无提交数据" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>

      {/* Row 3: Recent Projects + Recent Iterations */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-6 lg:grid-cols-2"
      >
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">最近项目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.recent_projects?.length ? (
                data.recent_projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 transition hover:bg-muted/60"
                  >
                    <Link to="/projects" className="font-medium text-sm text-foreground truncate mr-3 hover:underline">
                      {project.name}
                    </Link>
                    {project.pending_sql_count > 0 ? (
                      <Badge tone="warning" variant="soft" className="shrink-0">
                        {project.pending_sql_count} SQL
                      </Badge>
                    ) : (
                      <Badge tone="success" variant="soft" className="shrink-0">
                        已清零
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <EmptyPlaceholder text="暂无项目" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">最近迭代</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.recent_iterations?.length ? (
                data.recent_iterations.map((iter) => (
                  <div
                    key={iter.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 transition hover:bg-muted/60"
                  >
                    <Link to="/iterations" className="font-medium text-sm text-foreground truncate mr-3 hover:underline">
                      {iter.name}
                    </Link>
                    <Badge
                      tone={ITER_STATUS_TONE[iter.status] || 'info'}
                      variant="soft"
                      className="shrink-0"
                    >
                      {ITER_STATUS_LABEL[iter.status] || iter.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <EmptyPlaceholder text="暂无迭代" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>

      {/* Row 4: Pending SQL + Recent Reports */}
      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-6 lg:grid-cols-2"
      >
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">待执行 SQL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.pending_sql_by_project?.length ? (
                data.pending_sql_by_project.map((item) => (
                  <div
                    key={item.project_id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 transition hover:bg-muted/60"
                  >
                    <span className="font-medium text-sm text-foreground truncate mr-3">
                      {item.project_name}
                    </span>
                    <Badge tone="warning" variant="soft" className="shrink-0">
                      {item.count} 条
                    </Badge>
                  </div>
                ))
              ) : (
                <EmptyPlaceholder text="无待执行 SQL" />
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">最近报告</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data?.recent_reports?.length ? (
                data.recent_reports.map((rpt) => (
                  <div
                    key={rpt.id}
                    className="flex items-center justify-between rounded-lg border border-border/60 bg-background/60 px-4 py-2.5 transition hover:bg-muted/60"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <Link to="/reports" className="text-sm text-foreground truncate hover:underline">
                        {rpt.title || (rpt.type === 'daily' ? '日报' : '周报')}
                      </Link>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="soft" tone={rpt.type === 'daily' ? 'info' : 'success'}>
                        {rpt.type === 'daily' ? '日报' : '周报'}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {rpt.created_at?.slice(0, 10)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyPlaceholder text="暂无报告" />
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>
    </div>
  )
}

function EmptyPlaceholder({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
      {text}
    </div>
  )
}
