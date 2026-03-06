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
const INITIAL_RENDER_LIMIT = 300
const RENDER_STEP = 300
const BOTTOM_THRESHOLD_PX = 24

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

function isNearBottom(element: HTMLDivElement): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= BOTTOM_THRESHOLD_PX
}

export default function ConsolePage() {
  const logs = useConsoleStore((s) => s.logs)
  const enabled = useConsoleStore((s) => s.enabled)
  const level = useConsoleStore((s) => s.level)
  const clearLogs = useConsoleStore((s) => s.clearLogs)
  const setConfig = useConsoleStore((s) => s.setConfig)
  const [autoScroll, setAutoScroll] = useState(true)
  const [renderLimit, setRenderLimit] = useState(INITIAL_RENDER_LIMIT)
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
    setRenderLimit(INITIAL_RENDER_LIMIT)
  }, [level])

  useEffect(() => {
    if (visibleLogs.length <= renderLimit) return
    const listElement = listRef.current
    if (!listElement || !isNearBottom(listElement)) return
    setRenderLimit((current) => Math.min(visibleLogs.length, Math.max(current, INITIAL_RENDER_LIMIT)))
  }, [renderLimit, visibleLogs.length])

  const hiddenCount = Math.max(0, visibleLogs.length - renderLimit)
  const renderedLogs = useMemo(
    () => (hiddenCount > 0 ? visibleLogs.slice(-renderLimit) : visibleLogs),
    [hiddenCount, renderLimit, visibleLogs],
  )

  useEffect(() => {
    if (!autoScroll) return
    const element = listRef.current
    if (!element) return

    const frameId = window.requestAnimationFrame(() => {
      element.scrollTop = element.scrollHeight
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [autoScroll, renderedLogs])

  const handleListScroll = () => {
    const element = listRef.current
    if (!element) return
    setAutoScroll(isNearBottom(element))
  }

  const handleClearLogs = () => {
    clearLogs()
    setRenderLimit(INITIAL_RENDER_LIMIT)
  }

  const handleLoadMore = () => {
    setRenderLimit((current) => Math.min(visibleLogs.length, current + RENDER_STEP))
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <SectionLabel>CONSOLE</SectionLabel>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-display">控制台</h1>
            <p className="mt-2 text-sm text-muted-foreground">实时查看前后端日志输出</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="soft" tone={enabled ? 'success' : 'warning'}>
              调试日志{enabled ? '已开启' : '已关闭'}
            </Badge>
            <Badge variant="soft" tone={levelTone(level)}>
              级别 {level.toUpperCase()}
            </Badge>
            <Badge variant="soft" tone="neutral">
              可见 {visibleLogs.length} / 渲染 {renderedLogs.length}
            </Badge>
            <Button type="button" variant="secondary" onClick={() => setAutoScroll((value) => !value)}>
              {autoScroll ? '自动滚动中' : '自动滚动已停'}
            </Button>
            <Button type="button" variant="ghost" onClick={handleClearLogs}>
              清空
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <CardTitle>实时日志</CardTitle>
          {hiddenCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>已折叠较早的 {hiddenCount} 条日志，避免首屏阻塞</span>
              <Button type="button" size="sm" variant="outline" onClick={handleLoadMore}>
                再加载 {Math.min(RENDER_STEP, hiddenCount)} 条
              </Button>
            </div>
          ) : null}
        </CardHeader>
        <CardContent>
          {!enabled ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              调试日志未开启。请前往「系统设置」开启调试日志并选择级别。
            </div>
          ) : (
            <div
              ref={listRef}
              onScroll={handleListScroll}
              className="h-[62vh] overflow-y-auto rounded-xl border border-border/60 bg-muted/25 p-3 font-mono text-xs"
            >
              {visibleLogs.length === 0 ? (
                <div className="p-3 text-muted-foreground">当前级别暂无日志输出</div>
              ) : (
                <div className="space-y-1">
                  {renderedLogs.map((entry) => (
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
