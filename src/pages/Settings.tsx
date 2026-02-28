import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { buildSettingMap, settingApi, type ImportResult } from '@/api/setting'
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, Upload, Download, RefreshCw, ArrowUp, ArrowDown, Pencil, Save, X } from 'lucide-react'
import { parseEnvironmentOptions, serializeEnvironmentOptions, type EnvironmentOption } from '@/lib/environmentOptions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'
import { useUpdateStore } from '@/stores/update'
import { useShallow } from 'zustand/react/shallow'

const SETTING_KEYS = {
  DEEPSEEK_API_KEY: 'deepseek.api.key',
  DEEPSEEK_BASE_URL: 'deepseek.base.url',
  DAILY_TEMPLATE: 'report.template.daily',
  WEEKLY_TEMPLATE: 'report.template.weekly',
  GIT_AUTHOR_EMAIL: 'git.author.email',
  GIT_GITLAB_TOKEN: 'git.gitlab.token',
  ENVIRONMENT_OPTIONS: 'work.environment.options',
  DEBUG_LOG_ENABLED: 'debug.log.enabled',
  DEBUG_LOG_LEVEL: 'debug.log.level',
}

export default function Settings() {
  const queryClient = useQueryClient()
  const { dialogState, openConfirm, closeConfirm, handleConfirm } = useConfirmDialog()
  const [activeTab, setActiveTab] = useState('general')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showGitlabToken, setShowGitlabToken] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [envList, setEnvList] = useState<EnvironmentOption[]>([])
  const [newEnvCode, setNewEnvCode] = useState('')
  const [newEnvName, setNewEnvName] = useState('')
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [envListInitialized, setEnvListInitialized] = useState(false)
  const {
    currentVersion,
    latestVersion,
    releaseDate,
    changelog,
    statusMessage,
    hasPendingUpdate,
    isChecking,
    isInstalling,
    isRestartReady,
    downloadedBytes,
    totalBytes,
    checkForUpdates,
    installUpdate,
    setDialogOpen: setUpdateDialogOpen,
  } = useUpdateStore(
    useShallow((state) => ({
      currentVersion: state.currentVersion,
      latestVersion: state.latestVersion,
      releaseDate: state.releaseDate,
      changelog: state.changelog,
      statusMessage: state.statusMessage,
      hasPendingUpdate: state.hasPendingUpdate,
      isChecking: state.isChecking,
      isInstalling: state.isInstalling,
      isRestartReady: state.isRestartReady,
      downloadedBytes: state.downloadedBytes,
      totalBytes: state.totalBytes,
      checkForUpdates: state.checkForUpdates,
      installUpdate: state.installUpdate,
      setDialogOpen: state.setDialogOpen,
    })),
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings', 'map'],
    queryFn: () => settingApi.getAll(),
    select: buildSettingMap,
  })

  const [settingForm, setSettingForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (settings && !envListInitialized) {
      setEnvList(parseEnvironmentOptions(settings[SETTING_KEYS.ENVIRONMENT_OPTIONS]))
      setEnvListInitialized(true)
    }
  }, [settings, envListInitialized])

  const updateSettingMutation = useMutation({
    mutationFn: (data: Record<string, string>) => settingApi.batchUpdate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })

  const { data: apiKeys, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['apiKeys'],
    queryFn: () => settingApi.listApiKeys(),
  })

  const createKeyMutation = useMutation({
    mutationFn: (name: string) => settingApi.createApiKey(name),
    onSuccess: (data) => {
      setNewKeyValue(data.key)
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })

  const deleteKeyMutation = useMutation({
    mutationFn: (id: number) => settingApi.deleteApiKey(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] })
    },
  })

  const handleCreateKey = () => {
    if (!newKeyName.trim()) return
    createKeyMutation.mutate(newKeyName)
  }

  const handleCopyKey = () => {
    navigator.clipboard.writeText(newKeyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSaveSettings = () => {
    const dataToSave: Record<string, string> = {}
    for (const [key, value] of Object.entries(settingForm)) {
      if (value && value.trim()) {
        dataToSave[key] = value
      }
    }
    if (Object.keys(dataToSave).length > 0) {
      updateSettingMutation.mutate(dataToSave)
    }
  }

  const importMutation = useMutation({
    mutationFn: (content: string) => settingApi.importData(content),
    onSuccess: (data) => {
      setImportResult(data)
      queryClient.invalidateQueries()
    },
  })

  const exportMutation = useMutation({
    mutationFn: () => settingApi.exportData(),
    onSuccess: (json) => {
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `devsync-export-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    },
  })

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const content = ev.target?.result as string
      if (content) importMutation.mutate(content)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const progressPercent =
    totalBytes && totalBytes > 0
      ? Math.min(100, Math.round((downloadedBytes / totalBytes) * 100))
      : null
  const debugLogEnabledValue = settingForm[SETTING_KEYS.DEBUG_LOG_ENABLED] ?? settings?.[SETTING_KEYS.DEBUG_LOG_ENABLED] ?? '0'
  const debugLogEnabled = debugLogEnabledValue === '1'
  const debugLogLevel = (settingForm[SETTING_KEYS.DEBUG_LOG_LEVEL] ?? settings?.[SETTING_KEYS.DEBUG_LOG_LEVEL] ?? 'info').toLowerCase()

  const requestDeleteApiKey = (id: number, name: string) => {
    openConfirm(
      {
        title: '删除 API Key？',
        description: `确认删除「${name}」吗？删除后调用方将立即失效。`,
        confirmText: '删除',
      },
      () => deleteKeyMutation.mutate(id),
    )
  }

  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <SectionLabel>SETTINGS</SectionLabel>
        <div>
          <h1 className="text-3xl font-display">系统设置</h1>
          <p className="mt-2 text-sm text-muted-foreground">配置系统参数与 API 密钥</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="general">基础设置</TabsTrigger>
          <TabsTrigger value="apikey">API Key 管理</TabsTrigger>
          <TabsTrigger value="template">模板设置</TabsTrigger>
          <TabsTrigger value="data">数据管理</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>DeepSeek API 配置</CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="text-center py-6 text-muted-foreground">加载中...</div>
              ) : (
                <div className="space-y-4 max-w-lg">
                  <div className="space-y-2">
                    <Label>API Base URL</Label>
                    <Input
                      value={
                        settingForm[SETTING_KEYS.DEEPSEEK_BASE_URL]
                        || settings?.[SETTING_KEYS.DEEPSEEK_BASE_URL]
                        || ''
                      }
                      onChange={(e) => setSettingForm({
                        ...settingForm,
                        [SETTING_KEYS.DEEPSEEK_BASE_URL]: e.target.value,
                      })}
                      placeholder="https://api.deepseek.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>API Key</Label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        value={settingForm[SETTING_KEYS.DEEPSEEK_API_KEY] || ''}
                        onChange={(e) => setSettingForm({
                          ...settingForm,
                          [SETTING_KEYS.DEEPSEEK_API_KEY]: e.target.value,
                        })}
                        placeholder={settings?.[SETTING_KEYS.DEEPSEEK_API_KEY] ? '已配置，留空则不修改' : '请输入 API Key'}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={updateSettingMutation.isPending}>
                    {updateSettingMutation.isPending ? '保存中...' : '保存设置'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Git 作者配置</CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="text-center py-6 text-muted-foreground">加载中...</div>
              ) : (
                <div className="space-y-4 max-w-lg">
                  <div className="space-y-2">
                    <Label>Git 作者邮箱</Label>
                    <Input
                      value={
                        settingForm[SETTING_KEYS.GIT_AUTHOR_EMAIL]
                        || settings?.[SETTING_KEYS.GIT_AUTHOR_EMAIL]
                        || ''
                      }
                      onChange={(e) => setSettingForm({
                        ...settingForm,
                        [SETTING_KEYS.GIT_AUTHOR_EMAIL]: e.target.value,
                      })}
                      placeholder="your-email@example.com"
                    />
                    <p className="text-xs text-muted-foreground">用于日报生成时过滤只属于你的提交记录，留空则获取所有人的提交</p>
                  </div>
                  <div className="space-y-2">
                    <Label>全局 GitLab Token</Label>
                    <div className="relative">
                      <Input
                        type={showGitlabToken ? 'text' : 'password'}
                        value={settingForm[SETTING_KEYS.GIT_GITLAB_TOKEN] || ''}
                        onChange={(e) => setSettingForm({
                          ...settingForm,
                          [SETTING_KEYS.GIT_GITLAB_TOKEN]: e.target.value,
                        })}
                        placeholder={settings?.[SETTING_KEYS.GIT_GITLAB_TOKEN] ? '已配置，留空则不修改' : '所有项目共用，项目级 Token 可覆盖'}
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowGitlabToken(!showGitlabToken)}
                        aria-label={showGitlabToken ? '隐藏全局 GitLab Token' : '显示全局 GitLab Token'}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showGitlabToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={updateSettingMutation.isPending}>
                    {updateSettingMutation.isPending ? '保存中...' : '保存设置'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>调试日志</CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="text-center py-6 text-muted-foreground">加载中...</div>
              ) : (
                <div className="space-y-4 max-w-lg">
                  <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-4 py-3">
                    <div className="space-y-1">
                      <Label className="text-sm font-medium">开启调试日志</Label>
                      <p className="text-xs text-muted-foreground">开启后可在控制台实时查看前后端日志</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={debugLogEnabled}
                      onChange={(e) => setSettingForm({
                        ...settingForm,
                        [SETTING_KEYS.DEBUG_LOG_ENABLED]: e.target.checked ? '1' : '0',
                      })}
                      className="h-4 w-4 accent-[hsl(var(--accent))]"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>日志级别</Label>
                    <Select
                      value={debugLogLevel}
                      onValueChange={(value) => setSettingForm({
                        ...settingForm,
                        [SETTING_KEYS.DEBUG_LOG_LEVEL]: value,
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="error">ERROR</SelectItem>
                        <SelectItem value="warn">WARN</SelectItem>
                        <SelectItem value="info">INFO</SelectItem>
                        <SelectItem value="debug">DEBUG</SelectItem>
                        <SelectItem value="trace">TRACE</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">当前级别会同时作用于前端与后端日志输出</p>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={updateSettingMutation.isPending}>
                    {updateSettingMutation.isPending ? '保存中...' : '保存设置'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>统一环境配置</CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="text-center py-6 text-muted-foreground">加载中...</div>
              ) : (
                <div className="space-y-4 max-w-lg">
                  <div className="space-y-2">
                    <Label>环境列表</Label>
                    <p className="text-xs text-muted-foreground">
                      该配置会同时用于"需求管理"的环境和"执行事项"的环境。
                    </p>
                  </div>

                  {envList.length > 0 ? (
                    <div className="space-y-3">
                      {envList.map((item, index) => {
                        const isEditing = editingIndex === index
                        return (
                          <div
                            key={item.envCode}
                            className="flex flex-col gap-3 rounded-xl border border-border/60 bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <code className="rounded bg-muted px-2 py-1 text-xs">{item.envCode}</code>
                                {isEditing ? (
                                  <Input
                                    value={editingName}
                                    onChange={(e) => setEditingName(e.target.value)}
                                    className="h-9 max-w-[240px]"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const name = editingName.trim()
                                        if (!name) return
                                        setEnvList(envList.map((env, i) => i === index ? { ...env, envName: name } : env))
                                        setEditingIndex(null)
                                        setEditingName('')
                                      } else if (e.key === 'Escape') {
                                        setEditingIndex(null)
                                        setEditingName('')
                                      }
                                    }}
                                  />
                                ) : (
                                  <span className="truncate text-sm font-medium text-foreground">{item.envName}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0"
                                disabled={index === 0}
                                onClick={() => {
                                  const newList = [...envList]
                                  ;[newList[index - 1], newList[index]] = [newList[index], newList[index - 1]]
                                  setEnvList(newList)
                                }}
                                aria-label="上移"
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0"
                                disabled={index === envList.length - 1}
                                onClick={() => {
                                  const newList = [...envList]
                                  ;[newList[index], newList[index + 1]] = [newList[index + 1], newList[index]]
                                  setEnvList(newList)
                                }}
                                aria-label="下移"
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>

                              {isEditing ? (
                                <>
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                      const name = editingName.trim()
                                      if (!name) return
                                      setEnvList(envList.map((env, i) => i === index ? { ...env, envName: name } : env))
                                      setEditingIndex(null)
                                      setEditingName('')
                                    }}
                                  >
                                    <Save className="h-4 w-4" />
                                    保存
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => { setEditingIndex(null); setEditingName('') }}>
                                    <X className="h-4 w-4" />
                                    取消
                                  </Button>
                                </>
                              ) : (
                                <Button variant="secondary" size="sm" onClick={() => { setEditingIndex(index); setEditingName(item.envName) }}>
                                  <Pencil className="h-4 w-4" />
                                  编辑
                                </Button>
                              )}

                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                                onClick={() => setEnvList(envList.filter((_, i) => i !== index))}
                                aria-label="删除"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">暂无环境配置</p>
                  )}

                  <div className="rounded-xl border border-dashed border-border p-4">
                    <div className="text-sm font-medium text-foreground">新增环境</div>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label>环境编码 *</Label>
                        <Input
                          value={newEnvCode}
                          onChange={(e) => setNewEnvCode(e.target.value)}
                          placeholder="例如：uat"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>环境名称 *</Label>
                        <Input
                          value={newEnvName}
                          onChange={(e) => setNewEnvName(e.target.value)}
                          placeholder="例如：预发"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <Button
                        variant="secondary"
                        type="button"
                        onClick={() => {
                          const code = newEnvCode.trim().toLowerCase()
                          const name = newEnvName.trim()
                          if (!code) return
                          if (envList.some(e => e.envCode === code)) return
                          setEnvList([...envList, { envCode: code, envName: name || code }])
                          setNewEnvCode('')
                          setNewEnvName('')
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        添加环境
                      </Button>
                    </div>
                  </div>

                  <Button
                    onClick={() => {
                      const envValue = serializeEnvironmentOptions(envList)
                      const merged = { ...settingForm, [SETTING_KEYS.ENVIRONMENT_OPTIONS]: envValue }
                      setSettingForm(merged)
                      const dataToSave: Record<string, string> = {}
                      for (const [key, value] of Object.entries(merged)) {
                        if (value && value.trim()) {
                          dataToSave[key] = value
                        }
                      }
                      if (Object.keys(dataToSave).length > 0) {
                        updateSettingMutation.mutate(dataToSave)
                      }
                    }}
                    disabled={updateSettingMutation.isPending}
                  >
                    {updateSettingMutation.isPending ? '保存中...' : '保存设置'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>应用更新</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge variant="soft" tone="neutral">当前版本 {currentVersion}</Badge>
                {latestVersion && hasPendingUpdate ? (
                  <Badge variant="soft" tone="info">可更新至 {latestVersion}</Badge>
                ) : null}
                {releaseDate ? (
                  <Badge variant="soft" tone="neutral">发布时间 {releaseDate.split('T')[0]}</Badge>
                ) : null}
                {isRestartReady ? (
                  <Badge variant="soft" tone="warning">等待重启</Badge>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => checkForUpdates()}
                  disabled={isChecking || isInstalling}
                >
                  <RefreshCw className="h-4 w-4" />
                  {isChecking ? '检查中...' : '检查更新'}
                </Button>

                <Button
                  type="button"
                  onClick={() => installUpdate()}
                  disabled={!hasPendingUpdate || isChecking || isInstalling || isRestartReady}
                >
                  {isInstalling ? '更新中...' : hasPendingUpdate ? '立即更新' : '等待新版本'}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setUpdateDialogOpen(true)}
                >
                  查看更新详情
                </Button>
              </div>

              <p className="text-sm text-muted-foreground">
                {statusMessage}
                {hasPendingUpdate ? ' · 也可点击左上角 GitHub 图标快速处理' : ''}
              </p>

              {progressPercent !== null ? (
                <div className="space-y-2">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-[hsl(var(--accent))] transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    下载进度 {progressPercent}% · {downloadedBytes} / {totalBytes || 0} bytes
                  </p>
                </div>
              ) : null}

              {changelog && !isRestartReady ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">更新说明</p>
                  <pre className="max-h-40 overflow-auto rounded-xl border border-border/60 bg-muted/60 p-3 text-xs text-foreground whitespace-pre-wrap">
                    {changelog}
                  </pre>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="apikey" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>创建 API Key</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="Key 名称，如：AI 助手"
                />
                <Button
                  onClick={handleCreateKey}
                  disabled={createKeyMutation.isPending || !newKeyName.trim()}
                >
                  <Plus className="h-4 w-4" />
                  创建
                </Button>
              </div>

              {newKeyValue && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm text-emerald-800 mb-3">API Key 创建成功，请妥善保存（只显示一次）：</p>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <code className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm font-mono">
                      {newKeyValue}
                    </code>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCopyKey}
                      className="sm:h-10"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                      {copied ? '已复制' : '复制'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>已有 API Keys</CardTitle>
            </CardHeader>
            <CardContent>
              {apiKeysLoading ? (
                <div className="text-center py-6 text-muted-foreground">加载中...</div>
              ) : apiKeys?.length ? (
                <div className="space-y-3">
                  {apiKeys.map((key) => (
                    <div
                      key={key.id}
                      className="flex flex-col gap-3 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3">
                        <div className="rounded-xl bg-muted p-2 text-muted-foreground">
                          <Key className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{key.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {key.key_prefix}••••••••
                            {key.last_used_at && ` · 最后使用: ${key.last_used_at.split('T')[0]}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="soft" tone="neutral">
                          {key.created_at?.split('T')[0]}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-9 w-9 p-0 text-muted-foreground hover:text-red-600"
                          onClick={() => requestDeleteApiKey(key.id, key.name)}
                          aria-label="删除 API Key"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                  暂无 API Key
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="template">
          <Card>
            <CardHeader>
              <CardTitle>报告模板</CardTitle>
            </CardHeader>
            <CardContent>
              {settingsLoading ? (
                <div className="text-center py-6 text-muted-foreground">加载中...</div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <Label>日报模板</Label>
                    <Textarea
                      value={settingForm[SETTING_KEYS.DAILY_TEMPLATE] || settings?.[SETTING_KEYS.DAILY_TEMPLATE] || ''}
                      onChange={(e) => setSettingForm({
                        ...settingForm,
                        [SETTING_KEYS.DAILY_TEMPLATE]: e.target.value,
                      })}
                      rows={8}
                      className="font-mono text-sm"
                      placeholder="请输入日报模板..."
                    />
                    <p className="text-xs text-muted-foreground">
                      支持变量：{'{title}'}、{'{commits}'}、{'{date}'}；标题可用首行“# 标题”或“标题：”指定；模板包含“按项目/序号/简要/详细”等关键词会影响生成规则
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>周报模板</Label>
                    <Textarea
                      value={settingForm[SETTING_KEYS.WEEKLY_TEMPLATE] || settings?.[SETTING_KEYS.WEEKLY_TEMPLATE] || ''}
                      onChange={(e) => setSettingForm({
                        ...settingForm,
                        [SETTING_KEYS.WEEKLY_TEMPLATE]: e.target.value,
                      })}
                      rows={8}
                      className="font-mono text-sm"
                      placeholder="请输入周报模板..."
                    />
                    <p className="text-xs text-muted-foreground">
                      支持变量：{'{title}'}、{'{commits}'}、{'{startDate}'}/{'{endDate}'}；标题可用首行“# 标题”或“标题：”指定；模板包含“按项目/序号/简要/详细”等关键词会影响生成规则
                    </p>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={updateSettingMutation.isPending}>
                    {updateSettingMutation.isPending ? '保存中...' : '保存模板'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>导入数据</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                从 Web 版导出的 JSON 文件导入数据。使用 <code className="rounded bg-muted px-1.5 py-0.5 text-xs">scripts/export-pg-data.js</code> 从 PostgreSQL 导出。
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={importMutation.isPending}
              >
                <Upload className="h-4 w-4" />
                {importMutation.isPending ? '导入中...' : '选择 JSON 文件导入'}
              </Button>

              {importMutation.isError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  导入失败: {String(importMutation.error)}
                </div>
              )}

              {importResult && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-medium text-emerald-800 mb-3">
                    导入成功，共 {importResult.total} 条记录
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                    {importResult.tables.filter(t => t.count > 0).map((t) => (
                      <div key={t.table} className="flex items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs">
                        <span className="text-muted-foreground">{t.table}</span>
                        <Badge variant="soft" tone="success">{t.count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>导出数据</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                将当前客户端所有数据导出为 JSON 文件，可用于备份或迁移到其他设备。
              </p>
              <Button
                variant="secondary"
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending}
              >
                <Download className="h-4 w-4" />
                {exportMutation.isPending ? '导出中...' : '导出数据'}
              </Button>

              {exportMutation.isError && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
                  导出失败: {String(exportMutation.error)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <ConfirmDialog
        open={dialogState.open}
        onOpenChange={(open) => {
          if (!open) closeConfirm()
        }}
        title={dialogState.title}
        description={dialogState.description}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        onConfirm={handleConfirm}
      />
    </div>
  )
}
