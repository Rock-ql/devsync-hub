export interface EnvironmentOption {
  envCode: string
  envName: string
}

export const ENVIRONMENT_OPTIONS_SETTING_KEY = 'work.environment.options'

export const DEFAULT_ENVIRONMENT_OPTIONS: EnvironmentOption[] = [
  { envCode: 'local', envName: 'local' },
  { envCode: 'dev', envName: 'dev' },
  { envCode: 'test', envName: 'test' },
  { envCode: 'smoke', envName: 'smoke' },
  { envCode: 'prod', envName: 'prod' },
]

function splitOptionLine(line: string): { code: string; name: string } | null {
  const trimmed = line.trim()
  if (!trimmed) return null

  const enIndex = trimmed.indexOf(':')
  const zhIndex = trimmed.indexOf('：')
  const colonIndex =
    enIndex >= 0 && zhIndex >= 0
      ? Math.min(enIndex, zhIndex)
      : Math.max(enIndex, zhIndex)
  if (colonIndex <= 0) {
    return {
      code: trimmed.toLowerCase(),
      name: trimmed,
    }
  }

  const code = trimmed.slice(0, colonIndex).trim().toLowerCase()
  const name = trimmed.slice(colonIndex + 1).trim()
  if (!code) return null

  return {
    code,
    name: name || code,
  }
}

export function serializeEnvironmentOptions(options: EnvironmentOption[]): string {
  return options.map(o => `${o.envCode}: ${o.envName}`).join('\n')
}

export function parseEnvironmentOptions(rawSetting: string | null | undefined): EnvironmentOption[] {
  const raw = rawSetting?.trim()
  if (!raw) return DEFAULT_ENVIRONMENT_OPTIONS

  const seen = new Set<string>()
  const parsed: EnvironmentOption[] = []

  for (const line of raw.split(/\r?\n/)) {
    const item = splitOptionLine(line)
    if (!item) continue
    if (seen.has(item.code)) continue
    seen.add(item.code)
    parsed.push({
      envCode: item.code,
      envName: item.name,
    })
  }

  return parsed.length ? parsed : DEFAULT_ENVIRONMENT_OPTIONS
}
