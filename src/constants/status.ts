/** 需求状态 */
export const STATUS_LABEL: Record<string, string> = {
  presented: '已宣讲',
  pending_dev: '待研发',
  developing: '开发中',
  integrating: '联调中',
  pending_test: '待测试',
  testing: '测试中',
  pending_acceptance: '待验收',
  pending_release: '待上线',
  released: '已上线',
}

export const STATUS_COLOR: Record<string, string> = {
  presented: 'bg-zinc-400',
  pending_dev: 'bg-slate-400',
  developing: 'bg-blue-500',
  integrating: 'bg-cyan-500',
  pending_test: 'bg-yellow-400',
  testing: 'bg-amber-500',
  pending_acceptance: 'bg-orange-400',
  pending_release: 'bg-violet-500',
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
