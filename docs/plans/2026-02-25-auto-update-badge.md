# 自动检查更新与 GitHub 图标提示 实施计划

> **对于 Claude：** 必需的子技能：使用 superpowers:executing-plans 按任务逐步实施此计划。

**目标：** 周期性检查客户端更新，若发现新版本则在左上角 GitHub 图标展示 `NEW` 标识，并在用户点击图标时弹出更新对话框以引导安装。

**架构：** 在前端创建全局更新状态 store（Zustand）与复用的 `UpdateDialog` 组件，Layout 负责调度周期检查并驱动标识展示，Settings 页面调用同一 store/API 以保持单一事实来源。

**技术栈：** React 19、TypeScript、Zustand、Radix Dialog、Tauri Updater API。

---

### 任务 1: 全局更新状态 Store 与 Dialog 组件

**文件：**
- 创建：`src/stores/update.ts`
- 创建：`src/components/update/UpdateDialog.tsx`
- 修改：`src/lib/updater.ts`

**步骤 1: 定义 updater store**

```ts
import { create } from 'zustand'
import { AppUpdateHandle } from '@/lib/updater'

type UpdateState = {
  isDialogOpen: boolean
  hasPendingUpdate: boolean
  latestVersion?: string
  releaseDate?: string
  changelog?: string
  updateHandle?: AppUpdateHandle | null
  currentVersion: string
  setDialogOpen(open: boolean): void
  setUpdateInfo(payload: Partial<...>): void
  resetUpdate(): void
}
```

**步骤 2: 抽象 UpdateDialog 组件**

```tsx
import { Dialog, DialogContent, DialogHeader, ... } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUpdateStore } from '@/stores/update'
import { checkForAppUpdate, installAppUpdate, restartApp } from '@/lib/updater'

export default function UpdateDialog() { /* 复用 Settings 中逻辑 */ }
```
- 负责展示当前/最新版本，下载进度条，错误提示，`检查更新` 与 `立即更新` 按钮。
- 成功安装后触发 `restartApp` 及 `resetUpdate`。

**步骤 3: 在 `src/lib/updater.ts` 增补 `scheduleUpdateCheck(intervalMs)` 帮助函数**（若已有可共享逻辑则跳过）。封装定时调用 `checkForAppUpdate` 并返回用于清理的 `AbortController`/`timerId`。

### 任务 2: Layout 中的自动检查与 GitHub 标识

**文件：**
- 修改：`src/components/Layout.tsx`

**步骤 1: 引入 `useUpdateStore` 并在已有 `useEffect` 基础上每隔 30 分钟调用 `checkForAppUpdate`**

```tsx
const { hasPendingUpdate, setDialogOpen, setUpdateInfo } = useUpdateStore()

useEffect(() => {
  let timer = window.setInterval(runCheck, 30 * 60 * 1000)
  return () => clearInterval(timer)
}, [])
```
- `runCheck` 内调用 `checkForAppUpdate`，有新版本时更新 store；无新版本则清空标记。

**步骤 2: 更新 GitHub 图标 UI**

```tsx
<div className="relative">
  <Github ... />
  {hasPendingUpdate && <span className="...">NEW</span>}
</div>
```

**步骤 3: 根据是否有更新决定点击行为**

```tsx
const handleGithubClick = () => {
  if (hasPendingUpdate) {
    setDialogOpen(true)
  } else {
    window.open(GITHUB_REPO_URL, '_blank')
  }
}
```

### 任务 3: Settings 页面接入全局对话框

**文件：**
- 修改：`src/pages/Settings.tsx`

**步骤 1: 移除本地 `Dialog` 状态，改为直接渲染 `<UpdateDialog />`**
- 从 store 读取当前版本、状态、进度等（必要时 store 内维护 `downloadedBytes`、`totalBytes`）。
- 保存按钮逻辑保持不变。

**步骤 2: 复用 store 的 `checkForAppUpdate` 与 `installAppUpdate`**
- Settings 内 `检查更新`/`立即更新` 按钮可直接调用 store action，避免重复代码。

**步骤 3: 调整提示文案**
- 当 `hasPendingUpdate` 为 true 时展示 `Badge` 标识并提示亦可通过左上角入口更新。

---

计划完成并保存到 `docs/plans/2026-02-25-auto-update-badge.md`。有两种执行选项：

1. 子代理驱动（本会话） — 每个任务由子代理依次完成，并在任务间审查
2. 并行会话（单独） — 新开会话按计划批量执行并设置检查点

选择哪种方法？
