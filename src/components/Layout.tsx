import { useEffect, useRef, useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  FolderGit2,
  IterationCw,
  Database,
  FileText,
  Settings,
  Menu,
  Moon,
  Sun,
  X,
  Github,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useSSE } from '@/hooks/useSSE'
import { toast } from '@/components/ui/toaster'
import { useUpdateStore } from '@/stores/update'
import { UpdateDialog } from '@/components/update/UpdateDialog'

const GITHUB_REPO_URL = 'https://github.com/Rock-ql/devsync-hub'

const navigation = [
  { name: '仪表盘', href: '/', icon: LayoutDashboard },
  { name: '项目管理', href: '/projects', icon: FolderGit2 },
  { name: '迭代管理', href: '/iterations', icon: IterationCw },
  { name: '执行事项', href: '/sql', icon: Database },
  { name: '日报周报', href: '/reports', icon: FileText },
  { name: '系统设置', href: '/settings', icon: Settings },
]

type GithubRepoButtonProps = {
  className?: string
  hasPendingUpdate: boolean
  onClick: () => void
}

function GithubRepoButton({ className, hasPendingUpdate, onClick }: GithubRepoButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={hasPendingUpdate ? '查看可用更新' : '打开 GitHub 仓库'}
      className={cn(
        'relative rounded-lg border border-border p-2 text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background',
        className,
      )}
    >
      <Github className="h-5 w-5" />
      {hasPendingUpdate ? (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-semibold leading-4 text-white shadow">
          NEW
        </span>
      ) : null}
    </button>
  )
}

export default function Layout() {
  const location = useLocation()
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false)
  const hasPendingUpdate = useUpdateStore((state) => state.hasPendingUpdate)
  const setUpdateDialogOpen = useUpdateStore((state) => state.setDialogOpen)
  const checkForUpdates = useUpdateStore((state) => state.checkForUpdates)
  const loadCurrentVersion = useUpdateStore((state) => state.loadCurrentVersion)

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = localStorage.getItem('devsync.theme')
      return stored === 'dark' ? 'dark' : 'light'
    } catch {
      return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
    }
  })

  useEffect(() => {
    const isDark = theme === 'dark'
    document.documentElement.classList.toggle('dark', isDark)
    try {
      localStorage.setItem('devsync.theme', theme)
    } catch {
      // ignore
    }
  }, [theme])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const syncToastRef = useRef<Map<number, ReturnType<typeof toast>>>(new Map())

  useSSE({
    events: ['project_sync'],
    onMessage: (eventName, data) => {
      if (eventName !== 'project_sync') {
        return
      }

      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(data) as Record<string, unknown>
      } catch {
        return
      }

      const projectId = Number(payload.project_id)
      if (!Number.isFinite(projectId) || projectId <= 0) {
        return
      }

      const projectName = String(payload.project_name || `#${projectId}`)
      const status = String(payload.status || 'running')
      const message = String(payload.message || '')
      const percent = typeof payload.percent === 'number' ? payload.percent : null

      const description = percent !== null ? `${message} (${percent}%)` : message
      const variant = status === 'error' ? 'error' : status === 'done' ? 'success' : 'default'
      const duration = status === 'done' || status === 'error' ? 2_500 : 60_000

      const existing = syncToastRef.current.get(projectId)
      if (!existing) {
        const toastRef = toast({
          title: `同步提交 - ${projectName}`,
          description,
          variant,
          duration,
        })
        syncToastRef.current.set(projectId, toastRef)
      } else {
        existing.update({
          title: `同步提交 - ${projectName}`,
          description,
          variant,
          duration,
        })
      }

      if (status === 'done' || status === 'error') {
        syncToastRef.current.delete(projectId)
      }
    },
  })

  useEffect(() => {
    return () => {
      syncToastRef.current.forEach((toastRef) => toastRef.dismiss())
      syncToastRef.current.clear()
    }
  }, [])

  useEffect(() => {
    let timer: number | null = null
    void loadCurrentVersion()
    void checkForUpdates({ silent: true })

    if (typeof window !== 'undefined') {
      timer = window.setInterval(() => {
        void checkForUpdates({ silent: true })
      }, 30 * 60 * 1000)
    }

    return () => {
      if (timer) {
        window.clearInterval(timer)
      }
    }
  }, [checkForUpdates, loadCurrentVersion])

  const handleGithubClick = () => {
    if (hasPendingUpdate) {
      setUpdateDialogOpen(true)
      return
    }
    window.open(GITHUB_REPO_URL, '_blank', 'noopener,noreferrer')
  }

  const renderNavigation = (onNavigate?: () => void) => (
    <nav className="space-y-1">
      {navigation.map((item) => {
        const isActive = location.pathname === item.href
        return (
          <Link
            key={item.name}
            to={item.href}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all',
              isActive
                ? 'bg-[hsl(var(--accent))]/10 text-[hsl(var(--accent))] shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        )
      })}
    </nav>
  )

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* 移动端顶部栏 */}
      <div className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <button
            type="button"
            onClick={() => setIsMobileNavOpen(true)}
            aria-label="打开导航"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] shadow-accent" />
            <span className="text-base font-semibold">DevSync Hub</span>
            <GithubRepoButton
              className="border-none"
              hasPendingUpdate={hasPendingUpdate}
              onClick={handleGithubClick}
            />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label="切换主题"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* 侧边栏 */}
      <aside className="fixed inset-y-0 left-0 hidden w-72 border-r border-border bg-card/80 backdrop-blur lg:flex lg:flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] shadow-accent" />
            <div>
              <p className="text-base font-semibold">DevSync Hub</p>
              <p className="text-xs text-muted-foreground">进度协同中枢</p>
            </div>
            <GithubRepoButton hasPendingUpdate={hasPendingUpdate} onClick={handleGithubClick} />
          </div>

          <button
            type="button"
            onClick={toggleTheme}
            aria-label="切换主题"
            className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
        <div className="px-4 py-6">{renderNavigation()}</div>
      </aside>

      {/* 主内容区 */}
      <main className="lg:pl-72">
        <div className="px-6 py-8 lg:px-10">
          <Outlet />
        </div>
      </main>

      {/* 移动端导航抽屉 */}
      {isMobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsMobileNavOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 border-r border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[hsl(var(--accent))] to-[hsl(var(--accent-secondary))] shadow-accent" />
                <span className="text-base font-semibold">DevSync Hub</span>
                <GithubRepoButton
                  className="border-none"
                  hasPendingUpdate={hasPendingUpdate}
                  onClick={handleGithubClick}
                />
              </div>
              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                aria-label="关闭导航"
                className="rounded-full p-2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-6">
              {renderNavigation(() => setIsMobileNavOpen(false))}
            </div>
          </div>
        </div>
      )}
      <UpdateDialog />
    </div>
  )
}
