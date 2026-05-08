/**
 * 准入漏斗 + 动态退避调度
 */

import type { GitHubRepoInfo, QualityGateResult } from './types'

// ==========================================
// 准入门槛配置
// ==========================================

export const MIN_STARS = 500
export const MAX_DAYS_SINCE_PUSH = 180  // 6 个月

/**
 * 项目准入校验
 */
export function checkQualityGate(repo: GitHubRepoInfo): QualityGateResult {
  if (repo.fork) {
    return { passed: false, reason: 'is_fork' }
  }

  if (repo.stargazers_count < MIN_STARS) {
    return { passed: false, reason: `stars_below_${MIN_STARS}` }
  }

  const license = repo.license?.spdx_id
  if (!license || license === 'NOASSERTION') {
    return { passed: false, reason: 'no_license' }
  }

  const pushedAt = new Date(repo.pushed_at)
  const daysSincePush = (Date.now() - pushedAt.getTime()) / 86400000
  if (daysSincePush > MAX_DAYS_SINCE_PUSH) {
    return { passed: false, reason: 'inactive_over_6_months' }
  }

  return { passed: true }
}

// ==========================================
// 动态退避：基于活跃度计算下次检查时间
// ==========================================

/**
 * 根据 pushed_at + archived 状态计算下次允许检查时间。
 * 返回 ISO 字符串（D1 datetime 兼容）。
 *
 * 规则：
 *   - archived           → +90 天
 *   - <30 天有 push     → +1 天
 *   - <180 天有 push    → +7 天
 *   - <365 天有 push    → +14 天
 *   - 其它              → +30 天
 *   - pushed_at 缺失    → +7 天（保守值）
 */
export function computeNextCheckAt(pushedAt: string | null, archived: boolean): string {
  const now = Date.now()
  let addDays: number

  if (archived) {
    addDays = 90
  } else if (!pushedAt) {
    addDays = 7
  } else {
    const days = (now - new Date(pushedAt).getTime()) / 86400000
    if (days < 30) addDays = 1
    else if (days < 180) addDays = 7
    else if (days < 365) addDays = 14
    else addDays = 30
  }

  return toSqliteDateTime(new Date(now + addDays * 86400000))
}

/**
 * 命中 304 时使用：基于已存的 last_pushed_at 计算下次检查
 * 行为与 computeNextCheckAt 一致，但额外加 0.5 天抖动避免雪崩
 */
export function computeNextCheckAt304(
  lastPushedAt: string | null,
  archived: boolean,
): string {
  const baseIso = computeNextCheckAt(lastPushedAt, archived)
  const jittered = new Date(new Date(baseIso).getTime() + Math.random() * 12 * 3600 * 1000)
  return toSqliteDateTime(jittered)
}

/**
 * 失败时的指数退避（按重试次数）
 */
export function computeRetryNextCheck(retryCount: number): string {
  const base = Math.min(60, 5 * Math.pow(2, retryCount)) // 分钟
  return toSqliteDateTime(new Date(Date.now() + base * 60_000))
}

/**
 * Skip 类项目按 reason 分级退避，避免每天对永远不会翻盘的项目重复拉 GitHub。
 *
 * 背景数据（raw_apps 879 skipped中）：
 *   no_installable_release = 496   不发 release 的项目短期不会突然发
 *   stars_below_500        = 208   暂时星数不足，可能未来涨
 *   no_license             = 142   大多数永久无 license
 *   inactive_over_6_months = 25    只会更 inactive
 *   is_fork                = 7     fork 身份几乎不可变
 *
 * 退避策略（灵敏度与资源浪费权衡）：
 *   is_fork                → 365 天（近似永久，保留恢复可能）
 *   inactive_over_6_months → 180 天
 *   no_license             → 90  天
 *   no_installable_release → 30  天
 *   stars_below_500        → 30  天
 *   gate_failed / fallback → 30  天
 *
 * 附加 0~0.5 天随机抖动，避免同时到期雪崩。
 */
export function computeSkipNextCheck(reason: string | undefined): string {
  let addDays: number
  switch (reason) {
    case 'is_fork':
      addDays = 365
      break
    case 'inactive_over_6_months':
      addDays = 180
      break
    case 'no_license':
      addDays = 90
      break
    case 'no_installable_release':
    case 'stars_below_500':
      addDays = 30
      break
    default:
      // 包括 gate_failed、stars_below_N 变数以及未知 reason
      addDays = 30
  }
  const jitterMs = Math.random() * 12 * 3600 * 1000 // ±12h 抖动
  return toSqliteDateTime(new Date(Date.now() + addDays * 86400_000 + jitterMs))
}

/**
 * D1 datetime 字段格式：'YYYY-MM-DD HH:MM:SS'
 */
export function toSqliteDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19)
}
