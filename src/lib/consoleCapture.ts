import { logLevelWeight, normalizeLogLevel, type LogLevel, useConsoleStore } from '@/stores/console'

let captureInitialized = false

function shouldCapture(level: LogLevel): boolean {
  const state = useConsoleStore.getState()
  if (!state.enabled) return false
  return logLevelWeight(level) <= logLevelWeight(state.level)
}

function toText(value: unknown, seen = new WeakSet<object>()): string {
  if (value === null || value === undefined) return String(value)
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value)
  if (value instanceof Error) return `${value.name}: ${value.message}`
  if (typeof value === 'object') {
    if (seen.has(value as object)) return '[Circular]'
    seen.add(value as object)
    try {
      return JSON.stringify(value)
    } catch {
      return Object.prototype.toString.call(value)
    }
  }
  return String(value)
}

function normalizeMessage(args: unknown[]): string {
  if (!args.length) return ''
  return args.map((arg) => toText(arg)).join(' ')
}

export function setupConsoleCapture() {
  if (captureInitialized || typeof window === 'undefined') return
  captureInitialized = true

  const bindings: Array<[keyof Console, LogLevel]> = [
    ['error', 'error'],
    ['warn', 'warn'],
    ['info', 'info'],
    ['log', 'info'],
    ['debug', 'debug'],
  ]

  for (const [method, level] of bindings) {
    const consoleRef = console as unknown as Record<string, unknown>
    const original = consoleRef[method] as ((...args: unknown[]) => void) | undefined
    if (!original) continue

    consoleRef[method] = (...args: unknown[]) => {
      original(...args)
      if (!shouldCapture(level)) return
      useConsoleStore.getState().addLog({
        source: 'frontend',
        level,
        target: `console.${method}`,
        message: normalizeMessage(args),
      })
    }
  }

  window.addEventListener('error', (event) => {
    if (!shouldCapture('error')) return
    const detail = event.error instanceof Error
      ? `${event.error.name}: ${event.error.message}`
      : event.message
    useConsoleStore.getState().addLog({
      source: 'frontend',
      level: normalizeLogLevel('error'),
      target: 'window.error',
      message: detail,
    })
  })

  window.addEventListener('unhandledrejection', (event) => {
    if (!shouldCapture('error')) return
    useConsoleStore.getState().addLog({
      source: 'frontend',
      level: normalizeLogLevel('error'),
      target: 'window.unhandledrejection',
      message: toText(event.reason),
    })
  })
}
