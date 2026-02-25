# GitHub图标与一键重启 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 在客户端左上角加入可跳转 GitHub 仓库的入口，并在设置页完成系统更新后弹出可一键重启的提示对话框。

**架构：** 前端保持单一 Layout 容器和 Settings 页面结构，抽象 GitHub 入口按钮以适配桌面/移动布局；更新模块通过 `lib/updater` 暴露统一的 `restartApp` 辅助，Settings 页面复用该接口触发 Tauri `relaunch` 或浏览器刷新。

**技术栈：** React 19、TypeScript、TailwindCSS、Radix UI Dialog、Tauri `@tauri-apps/api`。

---

### 任务 1: 导航栏 GitHub 快捷入口

**文件：**
- 修改：`src/components/Layout.tsx`

**步骤 1: 添加 GitHub 常量与按钮组件**

```tsx
import { Github, ... } from 'lucide-react'

const GITHUB_REPO_URL = 'https://github.com/Rock-ql/devsync-hub'

function GithubRepoButton() {
  return (
    <a
      href={GITHUB_REPO_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="打开 GitHub 仓库"
      className="rounded-lg border border-border p-2 text-muted-foreground transition hover:text-foreground"
    >
      <Github className="h-5 w-5" />
    </a>
  )
}
```

**步骤 2: 将按钮插入移动端和桌面头部**

```tsx
<div className="flex items-center gap-2">
  <div className="h-8 w-8 ..." />
  <span className="text-base font-semibold">DevSync Hub</span>
  <GithubRepoButton />
</div>

<div className="flex items-center gap-3">
  <div className="h-10 w-10 ..." />
  <div>...</div>
  <GithubRepoButton />
</div>
```

确保按钮在移动端顶部栏和桌面侧栏头部对齐，不破坏布局。

**步骤 3: 运行静态检查验证**

```bash
npm run lint -- Layout
```

预期： ESLint 通过且无类型错误。

### 任务 2: 更新完成后的重启对话框

**文件：**
- 修改：`src/lib/updater.ts`
- 修改：`src/pages/Settings.tsx`

**步骤 1: 在 updater 模块中添加重启辅助**

```ts
import { relaunch } from '@tauri-apps/api/process'
import { isTauri } from '@tauri-apps/api/core'

export async function restartApp() {
  if (!isTauri()) {
    window.location.reload()
    return
  }
  await relaunch()
}
```

**步骤 2: 调整 Settings 逻辑，记录更新完成状态并触发对话框**

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { restartApp } from '@/lib/updater'

const [isRestartDialogOpen, setIsRestartDialogOpen] = useState(false)
const [restartError, setRestartError] = useState('')

const handleInstallAppUpdate = async () => {
  ...
  setUpdateStatus('下载完成，正在安装...')
  await installAppUpdate(...)
  setIsRestartDialogOpen(true)
}

const handleRestartApp = async () => {
  try {
    setRestartError('')
    await restartApp()
  } catch (error) {
    setRestartError(error instanceof Error ? error.message : String(error))
  }
}

return (
  ...
  <Dialog open={isRestartDialogOpen} onOpenChange={setIsRestartDialogOpen}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>更新已安装</DialogTitle>
        <DialogDescription>点击下方按钮立即重启应用以载入 {updateLatestVersion || '最新版本'}。</DialogDescription>
      </DialogHeader>
      {restartError && <p className="text-sm text-red-500">{restartError}</p>}
      <DialogFooter>
        <Button variant="secondary" onClick={() => setIsRestartDialogOpen(false)}>稍后再说</Button>
        <Button onClick={handleRestartApp}>立即重启</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

**步骤 3: 运行静态检查确保类型与导入正确**

```bash
npm run lint -- Settings
```

预期： ESLint 通过；若在 Web 环境下运行，Dialog 打开/关闭逻辑可通过手动触发 `handleInstallAppUpdate` 的成功路径验证。

---

计划完成并保存到 `docs/plans/2026-02-25-github-icon-restart.md`。有两种执行选项：

1. 子代理驱动（本会话） — 我为每个任务分派新的子代理，在任务之间进行审查，快速迭代
2. 并行会话（单独） — 打开新的会话以执行计划，批量执行并设置检查点

选择哪种方法？
