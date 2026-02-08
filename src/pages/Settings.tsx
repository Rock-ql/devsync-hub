import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { settingApi, type ApiKeyItem, type ApiKeyCreateResult, type SystemSetting, type ImportResult } from '@/api/setting'
import { Key, Plus, Trash2, Eye, EyeOff, Copy, Check, Upload, Download } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SectionLabel } from '@/components/ui/section-label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

const SETTING_KEYS = {
  DEEPSEEK_API_KEY: 'deepseek.api.key',
  DEEPSEEK_BASE_URL: 'deepseek.base.url',
  DAILY_TEMPLATE: 'report.template.daily',
  WEEKLY_TEMPLATE: 'report.template.weekly',
  GIT_AUTHOR_EMAIL: 'git.author.email',
  GIT_GITLAB_TOKEN: 'git.gitlab.token',
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState('general')
  const [showApiKey, setShowApiKey] = useState(false)
  const [showGitlabToken, setShowGitlabToken] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [copied, setCopied] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const list = await settingApi.getAll()
      return list.reduce<Record<string, string>>((acc, item) => {
        acc[item.setting_key] = item.setting_value
        return acc
      }, {})
    },
  })

  const [settingForm, setSettingForm] = useState<Record<string, string>>({})

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
                          onClick={() => {
                            if (confirm('确定要删除此 API Key 吗？')) {
                              deleteKeyMutation.mutate(key.id)
                            }
                          }}
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
    </div>
  )
}
