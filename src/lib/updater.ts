import { getVersion } from '@tauri-apps/api/app'
import { invoke, isTauri } from '@tauri-apps/api/core'
import { check, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater'

export interface AppUpdateCheckResult {
  available: boolean
  currentVersion: string
  latestVersion?: string
  date?: string
  body?: string
  update?: Update
}

export type AppUpdateDownloadEvent = DownloadEvent
export type AppUpdateHandle = Update

export async function getCurrentAppVersion(): Promise<string> {
  if (!isTauri()) return 'web'
  return getVersion()
}

export async function checkForAppUpdate(): Promise<AppUpdateCheckResult> {
  const currentVersion = await getCurrentAppVersion()
  if (!isTauri()) {
    return { available: false, currentVersion }
  }

  let update: Update | null
  try {
    update = await check()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('updater is disabled') || message.includes('Updater is disabled')) {
      return { available: false, currentVersion }
    }
    throw error
  }

  if (!update) {
    return { available: false, currentVersion }
  }

  return {
    available: true,
    currentVersion,
    latestVersion: update.version,
    date: update.date,
    body: update.body,
    update,
  }
}

export async function installAppUpdate(
  update: Update,
  onEvent?: (event: AppUpdateDownloadEvent) => void,
): Promise<void> {
  await update.downloadAndInstall(onEvent)
}

export async function restartApp(): Promise<void> {
  if (!isTauri()) {
    window.location.reload()
    return
  }

  await invoke('restart_app')
}
