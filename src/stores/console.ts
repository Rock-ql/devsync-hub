import { create } from 'zustand'

export type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace'
export type LogSource = 'frontend' | 'backend'

export interface ConsoleLogInput {
  source: LogSource
  level: LogLevel
  message: string
  target?: string
  timestamp?: string
}

export interface ConsoleLogEntry {
  id: number
  source: LogSource
  level: LogLevel
  message: string
  target?: string
  timestamp: string
}

const MAX_LOG_ENTRIES = 2000
let logSequence = 0

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
  addLog: (log: ConsoleLogInput) => void
  addLogs: (logs: ConsoleLogInput[]) => void
  clearLogs: () => void
}

function createConsoleLogEntry(log: ConsoleLogInput): ConsoleLogEntry {
  logSequence += 1

  return {
    id: logSequence,
    source: log.source,
    level: log.level,
    message: log.message,
    target: log.target,
    timestamp: log.timestamp || nowText(),
  }
}

function trimLogs(logs: ConsoleLogEntry[]): ConsoleLogEntry[] {
  return logs.length > MAX_LOG_ENTRIES ? logs.slice(logs.length - MAX_LOG_ENTRIES) : logs
}

export const useConsoleStore = create<ConsoleState>()((set) => ({
  enabled: false,
  level: 'info',
  logs: [],
  setConfig: (enabled, level) => set({ enabled, level }),
  addLog: (log) =>
    set((state) => {
      const nextLogs = [...state.logs, createConsoleLogEntry(log)]
      return { logs: trimLogs(nextLogs) }
    }),
  addLogs: (logs) =>
    set((state) => {
      if (logs.length === 0) return state
      const nextLogs = [...state.logs, ...logs.map(createConsoleLogEntry)]
      return { logs: trimLogs(nextLogs) }
    }),
  clearLogs: () => set({ logs: [] }),
}))
