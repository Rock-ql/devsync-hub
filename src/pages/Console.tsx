import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { buildSettingMap, settingApi } from '@/api/setting'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SectionLabel } from '@/components/ui/section-label'
import { cn } from '@/lib/utils'
import { logLevelWeight, normalizeLogLevel, type ConsoleLogEntry, type LogLevel, useConsoleStore } from '@/stores/console'

const DEBUG_LOG_ENABLED_KEY = 'debug.log.enabled'
const DEBUG_LOG_LEVEL_KEY = 'debug.log.level'

function levelTone(level: LogLevel): 'warning' | 'info' | 'accent' | 'neutral' {
  switch (level) {
    case 'error':
      return 'warning'
    case 'warn':
      return 'warning'
    case 'debug':
      return 'accent'
    case 'trace':
      return 'neutral'
    default:
      return 'info'
  }
}

function isLogVisible(entry: ConsoleLogEntry, configuredLevel: LogLevel): boolean {
  return logLevelWeight(entry.level) <= logLevelWeight(configuredLevel)
}

export default function ConsolePage() {
  const logs = useConsoleStore((s) => s.logs)
  const enabled = useConsoleStore((s) => s.enabled)
  const level = useConsoleStore((s) => s.level)
  const clearLogs = useConsoleStore((s) => s.clearLogs)
  const setConfig = useConsoleStore((s) => s.setConfig)
  const [autoScroll, setAutoScroll] = useState(true)
  const listRef = useRef<HTMLDivElement | null>(null)

  const { data: settingsMap } = useQuery({
    queryKey: ['settings', 'map'],
    queryFn: () => settingApi.getAll(),
    select: buildSettingMap,
  })

  useEffect(() => {
    const nextEnabled = settingsMap?.[DEBUG_LOG_ENABLED_KEY] === '1'
    const nextLevel = normalizeLogLevel(settingsMap?.[DEBUG_LOG_LEVEL_KEY] || 'info')
    setConfig(nextEnabled, nextLevel)
  }, [settingsMap, setConfig])

  const visibleLogs = useMemo(
    () => logs.filter((entry) => isLogVisible(entry, level)),
    [logs, level],
  )

  useEffect(() => {
    if (!autoScroll) return
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [visibleLogs, autoScroll])

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionLabel>CONSOLE</SectionLabel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-display">控制台</h1>
            <p className="mt-2 text-sm text-muted-foreground">实时查看前后端日志输出</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="soft" tone={enabled ? 'success' : 'warning'}>
              调试日志{enabled ? '已开启' : '已关闭'}
            </Badge>
            <Badge variant="soft" tone={levelTone(level)}>
              级别 {level.toUpperCase()}
            </Badge>
            <Button type="button" variant="secondary" onClick={() => setAutoScroll((v) => !v)}>
              {autoScroll ? '自动滚动中' : '自动滚动已停'}
            </Button>
            <Button type="button" variant="ghost" onClick={clearLogs}>
              清空
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>实时日志</CardTitle>
        </CardHeader>
        <CardContent>
          {!enabled ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              调试日志未开启。请前往「系统设置」开启调试日志并选择级别。
            </div>
          ) : (
            <div
              ref={listRef}
              className="h-[62vh] overflow-y-auto rounded-xl border border-border/60 bg-muted/25 p-3 font-mono text-xs"
            >
              {visibleLogs.length === 0 ? (
                <div className="p-3 text-muted-foreground">当前级别暂无日志输出</div>
              ) : (
                <div className="space-y-1">
                  {visibleLogs.map((entry) => (
                    <div
                      key={entry.id}
                      className={cn(
                        'rounded px-2 py-1',
                        entry.level === 'error' && 'bg-red-50 text-red-700',
                        entry.level === 'warn' && 'bg-amber-50 text-amber-700',
                      )}
                    >
                      <span className="text-muted-foreground">{entry.timestamp}</span>
                      <span className="mx-2">[{entry.source}]</span>
                      <span className="mr-2">{entry.level.toUpperCase()}</span>
                      {entry.target ? <span className="mr-2 text-muted-foreground">({entry.target})</span> : null}
                      <span>{entry.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
