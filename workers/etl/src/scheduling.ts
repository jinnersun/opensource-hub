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
 * D1 datetime 字段格式：'YYYY-MM-DD HH:MM:SS'
 */
export function toSqliteDateTime(d: Date): string {
  return d.toISOString().replace('T', ' ').slice(0, 19)
}
