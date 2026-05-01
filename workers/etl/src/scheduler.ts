/**
 * ETL 调度器：拉取到期项目 → 走 GitHub ETag 检查 → 准入校验 → AI 生成 → 写库
 */

import { AIClient } from './ai'
import { GitHubClient } from './github'
import {
  computeNextCheckAt,
  computeNextCheckAt304,
  computeRetryNextCheck,
  checkQualityGate,
} from './scheduling'
import {
  lockBatch,
  save304,
  saveFailure,
  saveSkipped,
  saveSuccess,
} from './persistence'
import type { BatchStats, Env, RawApp } from './types'

const BATCH_SIZE = 50
const CONCURRENCY = 5
const WORKER_BUDGET_MS = 14 * 60 * 1000

const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

/**
 * 拉取一批到期或首次处理的 raw_apps
 */
async function fetchDueBatch(env: Env): Promise<RawApp[]> {
  const result = await env.DB.prepare(
    `SELECT * FROM raw_apps
     WHERE retry_count < max_retries
       AND (
         (etl_status != 'processing'
          AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP))
         OR (etl_status = 'processing'
             AND processing_started_at < datetime('now', '-30 minutes'))
       )
     ORDER BY (next_check_at IS NULL) DESC, next_check_at ASC
     LIMIT ?`,
  ).bind(BATCH_SIZE).all<RawApp>()

  return result.results || []
}

/**
 * 处理单个 raw_app
 */
async function processOne(
  raw: RawApp,
  github: GitHubClient,
  ai: AIClient,
  env: Env,
  stats: BatchStats,
): Promise<void> {
  const { full_name: fullName, github_etag: etag } = raw

  // 1. GitHub API（带 ETag）
  const fetchResult = await github.fetchRepo(fullName, etag)
  stats.fetched++

  if (fetchResult.status === 'not_modified') {
    const next = computeNextCheckAt304(raw.last_pushed_at, raw.is_archived === 1)
    await save304(env, fullName, next)
    stats.notModified++
    return
  }

  if (fetchResult.status === 'rate_limited') {
    const resetAt = fetchResult.rateLimitResetAt || Math.floor(Date.now() / 1000) + 3600
    const next = new Date(resetAt * 1000 + 60_000).toISOString().replace('T', ' ').slice(0, 19)
    await saveFailure(env, fullName, 'rate_limited', fetchResult.errorMessage || 'rate limit', next)
    stats.rateLimited++
    throw new Error('GITHUB_RATE_LIMIT')
  }

  if (fetchResult.status === 'not_found') {
    await saveFailure(env, fullName, 'not_found', 'repo not found', computeNextCheckAt(null, false))
    stats.skipped++
    return
  }

  if (fetchResult.status === 'error' || !fetchResult.repo) {
    await saveFailure(
      env, fullName, 'failed',
      fetchResult.errorMessage || 'unknown github error',
      computeRetryNextCheck(raw.retry_count + 1),
    )
    stats.failed++
    return
  }

  // 2. 准入漏斗
  const repo = fetchResult.repo
  const gate = checkQualityGate(repo)
  const nextOk = computeNextCheckAt(repo.pushed_at, repo.archived)

  if (!gate.passed) {
    await saveSkipped(
      env, fullName, gate.reason || 'gate_failed', nextOk,
      repo.id, fetchResult.etag, repo.pushed_at, repo.archived,
    )
    stats.skipped++
    return
  }

  // 3. README + AI 处理
  const readme = await github.fetchReadme(fullName)
  const aiResult = await ai.generate(repo, readme)

  // 4. 入库
  await saveSuccess({
    env, fullName, repo, readme, etag: fetchResult.etag, ai: aiResult, nextCheckAt: nextOk,
  })
  stats.succeeded++
}

/**
 * 并发处理一批
 */
async function processBatch(env: Env, github: GitHubClient, ai: AIClient): Promise<BatchStats> {
  const stats: BatchStats = {
    fetched: 0, notModified: 0, skipped: 0, succeeded: 0, failed: 0, rateLimited: 0,
  }

  const batch = await fetchDueBatch(env)
  if (batch.length === 0) return stats

  console.log(`[ETL] 拉取 ${batch.length} 条待处理项目`)
  await lockBatch(env, batch.map(r => r.full_name))

  let rateLimitHit = false
  for (let i = 0; i < batch.length; i += CONCURRENCY) {
    if (rateLimitHit) break
    const slice = batch.slice(i, i + CONCURRENCY)
    const results = await Promise.allSettled(
      slice.map(r => processOne(r, github, ai, env, stats)),
    )
    for (const r of results) {
      if (r.status === 'rejected' && (r.reason as Error)?.message === 'GITHUB_RATE_LIMIT') {
        rateLimitHit = true
        break
      }
    }
    if (!rateLimitHit) await delay(500)
  }

  if (rateLimitHit) throw new Error('GITHUB_RATE_LIMIT')
  return stats
}

/**
 * 主入口：在时间预算内尽可能多地处理
 */
export async function runEtl(env: Env): Promise<BatchStats> {
  const github = new GitHubClient(env.GITHUB_TOKEN)
  const ai = new AIClient(env.OPENAI_API_KEY)
  const start = Date.now()
  const total: BatchStats = {
    fetched: 0, notModified: 0, skipped: 0, succeeded: 0, failed: 0, rateLimited: 0,
  }

  while (Date.now() - start < WORKER_BUDGET_MS) {
    let batchStats: BatchStats
    try {
      batchStats = await processBatch(env, github, ai)
    } catch (err) {
      if ((err as Error).message === 'GITHUB_RATE_LIMIT') {
        console.warn('[ETL] GitHub 限流，本轮提前退出')
        break
      }
      throw err
    }
    Object.keys(total).forEach(k => {
      (total as any)[k] += (batchStats as any)[k]
    })
    if (batchStats.fetched === 0) {
      console.log('[ETL] 无更多到期项目，本轮完成')
      break
    }
    await delay(500)
  }

  console.log(`[ETL] 本轮统计:`, total, `耗时 ${Math.round((Date.now() - start) / 1000)}s`)
  return total
}
