import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ConsolePage from '@/pages/Console'
import { useConsoleStore } from '@/stores/console'

const { getAllSettings } = vi.hoisted(() => ({
  getAllSettings: vi.fn(),
}))

vi.mock('@/api/setting', () => ({
  buildSettingMap: (settings: Array<{ setting_key: string; setting_value: string }> | null | undefined) => {
    if (!Array.isArray(settings)) return {}
    return settings.reduce<Record<string, string>>((acc, item) => {
      acc[item.setting_key] = item.setting_value
      return acc
    }, {})
  },
  settingApi: {
    getAll: getAllSettings,
  },
}))

function hasExactText(text: string) {
  return (_: string, element: Element | null) => element?.textContent === text
}

describe('ConsolePage', () => {
  beforeEach(() => {
    getAllSettings.mockResolvedValue([
      { id: 1, setting_key: 'debug.log.enabled', setting_value: '1', description: '' },
      { id: 2, setting_key: 'debug.log.level', setting_value: 'info', description: '' },
    ])

    useConsoleStore.setState({
      enabled: true,
      level: 'info',
      logs: [],
    })

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    cleanup()
  })

  function renderPage() {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    return render(
      <QueryClientProvider client={queryClient}>
        <ConsolePage />
      </QueryClientProvider>,
    )
  }

  it('首屏仅渲染最近的日志窗口', async () => {
    useConsoleStore.getState().addLogs(
      Array.from({ length: 650 }, (_, index) => ({
        source: 'backend',
        level: 'info',
        message: `message-${index}`,
      })),
    )

    renderPage()

    expect(await screen.findByText(hasExactText('调试日志已开启'))).toBeInTheDocument()
    expect(screen.getByText(hasExactText('可见 650 / 渲染 300'))).toBeInTheDocument()
    expect(screen.getByText(hasExactText('已折叠较早的 350 条日志，避免首屏阻塞'))).toBeInTheDocument()
    expect(screen.queryByText('message-0')).not.toBeInTheDocument()
    expect(screen.getByText('message-649')).toBeInTheDocument()
    expect(screen.getAllByText(/message-/)).toHaveLength(300)
  })

  it('点击加载更多后会扩大渲染窗口', async () => {
    useConsoleStore.getState().addLogs(
      Array.from({ length: 650 }, (_, index) => ({
        source: 'backend',
        level: 'info',
        message: `message-${index}`,
      })),
    )

    const user = userEvent.setup()
    renderPage()

    expect(await screen.findByText(hasExactText('调试日志已开启'))).toBeInTheDocument()

    const button = screen.getByRole('button', { name: '再加载 300 条' })
    await user.click(button)

    expect(await screen.findByText(hasExactText('可见 650 / 渲染 600'))).toBeInTheDocument()
    expect(screen.getByText('message-50')).toBeInTheDocument()
    expect(screen.queryByText('message-0')).not.toBeInTheDocument()
    expect(screen.getAllByText(/message-/)).toHaveLength(600)
  })
})
