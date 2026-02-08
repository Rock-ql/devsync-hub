import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { dashboardApi, DashboardOverview } from '@/api/dashboard'
import { FolderGit2, IterationCw, Database, GitCommit, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { SectionLabel } from '@/components/ui/section-label'
import { HeroGraphic } from '@/components/hero-graphic'

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
    transition: { staggerChildren: 0.1, delayChildren: 0.1 },
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
        <div className="text-muted-foreground">加载中...</div>
      </div>
    )
  }

  const stats = [
    {
      name: '活跃项目',
      value: data?.active_project_count || 0,
      total: data?.project_count || 0,
      icon: FolderGit2,
      subValue: null,
    },
    {
      name: '进行中迭代',
      value: data?.active_iteration_count || 0,
      total: data?.iteration_count || 0,
      icon: IterationCw,
      subValue: null,
    },
    {
      name: '待执行SQL',
      value: data?.pending_sql_count || 0,
      icon: Database,
      subValue: data?.pending_sql_count ? `${data.pending_sql_count} 条待处理` : null,
    },
    {
      name: '需求总数',
      value: data?.requirement_count || 0,
      icon: Target,
      subValue: null,
    },
    {
      name: '本周提交',
      value: data?.week_commit_count || 0,
      subValue: `今日 ${data?.today_commit_count || 0}`,
      icon: GitCommit,
    },
  ]

  return (
    <div className="space-y-12">
      <motion.section
        variants={stagger}
        initial="hidden"
        animate="visible"
        className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]"
      >
        <motion.div variants={fadeInUp} className="space-y-6">
          <SectionLabel>OVERVIEW</SectionLabel>
          <div className="space-y-4">
            <h1 className="text-4xl font-display leading-[1.1] md:text-5xl lg:text-[3.5rem]">
              项目进度
              <span className="relative ml-3 inline-block">
                <span className="gradient-text">一目了然</span>
                <span className="gradient-underline" />
              </span>
            </h1>
            <p className="max-w-xl text-lg text-muted-foreground">
              用更清晰的结构与动态指标，让项目节奏、风险与产出统一掌控。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link to="/projects">查看项目</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/reports">生成报告</Link>
            </Button>
          </div>
        </motion.div>
        <motion.div variants={fadeInUp} className="hidden lg:block">
          <HeroGraphic />
        </motion.div>
      </motion.section>

      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div key={stat.name} variants={fadeInUp}>
            <Card className="group hover:shadow-xl transition-all">
              <CardContent className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.name}</p>
                    <div className="mt-3 flex items-end gap-2">
                      <span className="text-3xl font-semibold text-foreground">
                        {stat.value}
                      </span>
                      {stat.total !== undefined && (
                        <span className="text-sm text-muted-foreground">
                          / {stat.total}
                        </span>
                      )}
                    </div>
                    {stat.subValue && (
                      <Badge className="mt-3" variant="soft" tone="info">
                        {stat.subValue}
                      </Badge>
                    )}
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] p-3 shadow-accent transition group-hover:shadow-accent-lg">
                    <stat.icon className="h-6 w-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.section>

      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="relative overflow-hidden rounded-3xl bg-foreground text-background"
      >
        <div className="absolute inset-0 dot-pattern opacity-40" />
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[hsl(var(--accent))]/15 blur-[140px]" />
        <div className="relative p-8 lg:p-10">
          <motion.div variants={fadeInUp} className="space-y-3">
            <SectionLabel className="border-white/20 bg-white/5">
              INSIGHTS
            </SectionLabel>
            <h2 className="text-3xl font-display text-white">关键态势</h2>
            <p className="max-w-2xl text-white/70">
              关键指标集中展示，帮助团队把控风险与交付节奏。
            </p>
          </motion.div>
          <motion.div
            variants={stagger}
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {[
              {
                label: '活跃项目',
                value: data?.active_project_count || 0,
              },
              {
                label: '进行中迭代',
                value: data?.active_iteration_count || 0,
              },
              {
                label: '待执行 SQL',
                value: data?.pending_sql_count || 0,
              },
              {
                label: '本周提交',
                value: data?.week_commit_count || 0,
              },
            ].map((item) => (
              <motion.div
                key={item.label}
                variants={fadeInUp}
                className="rounded-2xl border border-white/10 bg-white/5 p-4"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-white/60 font-mono">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-semibold text-white">
                  {item.value}
                </p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.section>

      <motion.section
        variants={stagger}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        className="grid gap-6 lg:grid-cols-2"
      >
        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>最近项目</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.recent_projects?.length ? (
                data.recent_projects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3 transition hover:bg-muted/60"
                  >
                    <div>
                      <p className="font-medium text-foreground">
                        {project.name}
                      </p>
                    </div>
                    {project.pending_sql_count > 0 ? (
                      <Badge tone="warning" variant="soft">
                        {project.pending_sql_count} 条 SQL
                      </Badge>
                    ) : (
                      <Badge tone="success" variant="soft">
                        全部清零
                      </Badge>
                    )}
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  暂无项目
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="h-full">
            <CardHeader>
              <CardTitle>待执行 SQL</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.pending_sql_by_project?.length ? (
                data.pending_sql_by_project.map((item) => (
                  <div
                    key={item.project_id}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-background/60 px-4 py-3 transition hover:bg-muted/60"
                  >
                    <span className="font-medium text-foreground">
                      {item.project_name}
                    </span>
                    <Badge tone="warning" variant="soft">
                      {item.count} 条
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  无待执行 SQL
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </motion.section>
    </div>
  )
}
