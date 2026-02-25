import { create } from 'zustand'
import {
  checkForAppUpdate,
  getCurrentAppVersion,
  installAppUpdate,
  restartApp,
  type AppUpdateDownloadEvent,
  type AppUpdateHandle,
} from '@/lib/updater'

type CheckOptions = {
  silent?: boolean
}

type UpdateState = {
  isDialogOpen: boolean
  hasPendingUpdate: boolean
  isChecking: boolean
  isInstalling: boolean
  isRestartReady: boolean
  currentVersion: string
  latestVersion?: string
  releaseDate?: string
  changelog?: string
  updateHandle: AppUpdateHandle | null
  statusMessage: string
  errorMessage?: string
  restartError?: string
  downloadedBytes: number
  totalBytes: number | null
  setDialogOpen: (open: boolean) => void
  clearUpdate: () => void
  loadCurrentVersion: () => Promise<void>
  checkForUpdates: (options?: CheckOptions) => Promise<void>
  installUpdate: () => Promise<void>
  restartApplication: () => Promise<void>
}

export const useUpdateStore = create<UpdateState>((set, get) => ({
  isDialogOpen: false,
  hasPendingUpdate: false,
  isChecking: false,
  isInstalling: false,
  isRestartReady: false,
  currentVersion: '-',
  latestVersion: undefined,
  releaseDate: undefined,
  changelog: undefined,
  updateHandle: null,
  statusMessage: '尚未检查更新',
  errorMessage: undefined,
  restartError: undefined,
  downloadedBytes: 0,
  totalBytes: null,
  setDialogOpen: (open) => set({ isDialogOpen: open }),
  clearUpdate: () =>
    set({
      hasPendingUpdate: false,
      latestVersion: undefined,
      releaseDate: undefined,
      changelog: undefined,
      updateHandle: null,
      isRestartReady: false,
      downloadedBytes: 0,
      totalBytes: null,
      errorMessage: undefined,
      statusMessage: '尚未检查更新',
    }),
  loadCurrentVersion: async () => {
    try {
      const version = await getCurrentAppVersion()
      set({ currentVersion: version })
    } catch {
      set({ currentVersion: '-' })
    }
  },
  checkForUpdates: async (options) => {
    const { isChecking } = get()
    if (isChecking && !options?.silent) return

    if (!options?.silent) {
      set({
        isChecking: true,
        statusMessage: '正在检查更新...',
        errorMessage: undefined,
      })
    }

    try {
      const result = await checkForAppUpdate()
      set({ currentVersion: result.currentVersion })

      if (result.available && result.update && result.latestVersion) {
        set({
          hasPendingUpdate: true,
          latestVersion: result.latestVersion,
          releaseDate: result.date,
          changelog: result.body,
          updateHandle: result.update,
          statusMessage: `发现新版本 ${result.latestVersion}`,
          errorMessage: undefined,
        })
      } else {
        set((state) => ({
          hasPendingUpdate: false,
          latestVersion: undefined,
          releaseDate: undefined,
          changelog: undefined,
          updateHandle: null,
          isRestartReady: false,
          downloadedBytes: 0,
          totalBytes: null,
          statusMessage:
            options?.silent || state.statusMessage === '更新安装完成，请点击立即重启应用'
              ? state.statusMessage
              : '当前已是最新版本',
        }))
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ errorMessage: message, statusMessage: `检查失败：${message}` })
    } finally {
      if (!options?.silent) {
        set({ isChecking: false })
      }
    }
  },
  installUpdate: async () => {
    const { updateHandle } = get()
    if (!updateHandle) return

    set({
      isInstalling: true,
      statusMessage: '正在下载更新...',
      downloadedBytes: 0,
      totalBytes: null,
      errorMessage: undefined,
    })

    try {
      await installAppUpdate(updateHandle, (event: AppUpdateDownloadEvent) => {
        if (event.event === 'Started') {
          set({
            totalBytes: event.data.contentLength ?? null,
            downloadedBytes: 0,
            statusMessage: '开始下载更新包...',
          })
          return
        }

        if (event.event === 'Progress') {
          set((state) => ({
            downloadedBytes: state.downloadedBytes + event.data.chunkLength,
            statusMessage: '正在下载更新包...',
          }))
          return
        }

        set({ statusMessage: '下载完成，正在安装...' })
      })

      set({
        hasPendingUpdate: false,
        updateHandle: null,
        statusMessage: '更新安装完成，请点击立即重启应用',
        isRestartReady: true,
        isDialogOpen: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ errorMessage: message, statusMessage: `安装失败：${message}` })
    } finally {
      set({ isInstalling: false })
    }
  },
  restartApplication: async () => {
    set({ restartError: undefined })
    try {
      await restartApp()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      set({ restartError: message })
    }
  },
}))
