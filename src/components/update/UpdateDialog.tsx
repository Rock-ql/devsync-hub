import { useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useUpdateStore } from '@/stores/update'

export function UpdateDialog() {
  const {
    isDialogOpen,
    setDialogOpen,
    hasPendingUpdate,
    isChecking,
    isInstalling,
    isRestartReady,
    currentVersion,
    latestVersion,
    releaseDate,
    changelog,
    statusMessage,
    errorMessage,
    restartError,
    downloadedBytes,
    totalBytes,
    checkForUpdates,
    installUpdate,
    restartApplication,
    loadCurrentVersion,
  } = useUpdateStore()

  useEffect(() => {
    void loadCurrentVersion()
  }, [loadCurrentVersion])

  const progressPercent = totalBytes && totalBytes > 0
    ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
    : null

  return (
    <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>应用更新</DialogTitle>
          <DialogDescription>
            当前版本 {currentVersion}，{hasPendingUpdate && latestVersion ? `可更新至 ${latestVersion}` : '如有新版本将提示安装'}。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          {releaseDate ? (
            <Badge variant="soft" tone="neutral">发布时间 {releaseDate.split('T')[0]}</Badge>
          ) : null}
          <p className="text-muted-foreground">{statusMessage}</p>

          {progressPercent !== null ? (
            <div className="space-y-2">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-[hsl(var(--accent))] transition-all"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                下载进度 {progressPercent}% · {downloadedBytes} / {totalBytes ?? 0} bytes
              </p>
            </div>
          ) : null}

          {changelog ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">更新说明</p>
              <pre className="max-h-36 overflow-auto rounded-lg border border-border/60 bg-muted/60 p-3 text-xs whitespace-pre-wrap">
                {changelog}
              </pre>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="text-xs text-red-500">{errorMessage}</p>
          ) : null}

          {restartError ? (
            <p className="text-xs text-red-500">重启失败：{restartError}</p>
          ) : null}
        </div>

        <DialogFooter className="pt-4">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              onClick={() => checkForUpdates()}
              disabled={isChecking || isInstalling || isRestartReady}
            >
              {isChecking ? '检查中...' : '检查更新'}
            </Button>
            {!isRestartReady ? (
              <Button
                type="button"
                onClick={installUpdate}
                disabled={!hasPendingUpdate || isChecking || isInstalling}
              >
                {isInstalling ? '更新中...' : hasPendingUpdate ? '立即更新' : '等待新版本'}
              </Button>
            ) : (
              <Button type="button" onClick={restartApplication}>
                立即重启
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
