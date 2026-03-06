import { beforeEach, describe, expect, it } from 'vitest'
import { useConsoleStore } from '@/stores/console'

describe('useConsoleStore', () => {
  beforeEach(() => {
    useConsoleStore.setState({
      enabled: false,
      level: 'info',
      logs: [],
    })
  })

  it('会在批量写入时保留最新的日志窗口', () => {
    useConsoleStore.getState().addLogs(
      Array.from({ length: 2005 }, (_, index) => ({
        source: 'backend',
        level: 'info',
        message: `message-${index}`,
      })),
    )

    const logs = useConsoleStore.getState().logs

    expect(logs).toHaveLength(2000)
    expect(logs[0]?.message).toBe('message-5')
    expect(logs[logs.length - 1]?.message).toBe('message-2004')
  })
})
