/** 需求状态 */
export const STATUS_LABEL: Record<string, string> = {
  pending_dev: '待开发',
  developing: '开发中',
  testing: '测试中',
  released: '已发布',
}

export const STATUS_COLOR: Record<string, string> = {
  pending_dev: 'bg-zinc-400',
  developing: 'bg-blue-500',
  testing: 'bg-amber-500',
  released: 'bg-emerald-500',
}

/** 迭代状态 */
export const ITER_STATUS_LABEL: Record<string, string> = {
  planning: '规划中',
  developing: '开发中',
  testing: '测试中',
  released: '已发布',
}

export const ITER_STATUS_TONE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  planning: 'neutral',
  developing: 'info',
  testing: 'warning',
  released: 'success',
}

/** SQL 状态 */
export const SQL_STATUS_LABEL: Record<string, string> = {
  pending: '待执行',
  partial: '部分执行',
  completed: '全部完成',
  executed: '已执行',
}
