import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Settings from '@/pages/Settings'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'get_all_settings') {
      return [
        { id: 1, setting_key: 'deepseek.api.key', setting_value: 'test', description: '' },
      ]
    }
    if (cmd === 'list_api_keys') {
      return []
    }
    if (cmd === 'import_data') {
      return { total: 0, tables: [] }
    }
    if (cmd === 'export_data') {
      return '{}'
    }
    if (cmd === 'batch_update_settings') {
      return null
    }
    return null
  }),
  isTauri: () => false,
}))

vi.mock('@tauri-apps/api/app', () => ({
  getVersion: async () => 'test'
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: async () => null,
}))

describe('Settings page', () => {
  it('renders without crashing', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <Settings />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(await screen.findByText('系统设置')).toBeInTheDocument()
  })
})
