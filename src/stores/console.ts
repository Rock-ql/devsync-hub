import { create } from 'zustand'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace'
export type LogSource = 'frontend' | 'backend'

export interface ConsoleLogEntry {
  id: number
  source: LogSource
  level: LogLevel
  message: string
  target?: string
  timestamp: string
}

const MAX_LOG_ENTRIES = 2000

function nowText() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}.${String(date.getMilliseconds()).padStart(3, '0')}`
}

export function normalizeLogLevel(level?: string): LogLevel {
  switch ((level || '').toLowerCase()) {
    case 'error':
      return 'error'
    case 'warn':
    case 'warning':
      return 'warn'
    case 'debug':
      return 'debug'
    case 'trace':
      return 'trace'
    default:
      return 'info'
  }
}

export function logLevelWeight(level: LogLevel): number {
  switch (level) {
    case 'error':
      return 1
    case 'warn':
      return 2
    case 'info':
      return 3
    case 'debug':
      return 4
    case 'trace':
      return 5
    default:
      return 3
  }
}

interface ConsoleState {
  enabled: boolean
  level: LogLevel
  logs: ConsoleLogEntry[]
  setConfig: (enabled: boolean, level: LogLevel) => void
  addLog: (log: Omit<ConsoleLogEntry, 'id' | 'timestamp'> & Partial<Pick<ConsoleLogEntry, 'timestamp'>>) => void
  clearLogs: () => void
}

export const useConsoleStore = create<ConsoleState>()((set) => ({
  enabled: false,
  level: 'info',
  logs: [],
  setConfig: (enabled, level) => set({ enabled, level }),
  addLog: (log) =>
    set((state) => {
      const nextLog: ConsoleLogEntry = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        source: log.source,
        level: log.level,
        message: log.message,
        target: log.target,
        timestamp: log.timestamp || nowText(),
      }
      const nextLogs = [...state.logs, nextLog]
      const sliced = nextLogs.length > MAX_LOG_ENTRIES ? nextLogs.slice(nextLogs.length - MAX_LOG_ENTRIES) : nextLogs
      return { logs: sliced }
    }),
  clearLogs: () => set({ logs: [] }),
}))
