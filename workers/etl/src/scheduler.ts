/**
 * ETL 调度器：拉取到期项目 → 走 GitHub ETag 检查 → 准入校验 → AI 生成 → 写库
 */

import { AIClient } from './ai'
import { GitHubClient } from './github'
import { fetchLatestRelease } from './release'
import { processFAQsForApp } from './faq-generator'
import {
  computeNextCheckAt,
  computeNextCheckAt304,
  computeRetryNextCheck,
  computeSkipNextCheck,
  checkQualityGate,
} from './scheduling'
import {
  lockBatch,
  save304,
  saveFailure,
  saveSkipped,
  saveSuccess,
  upsertEmbedding,
} from './persistence'
import type { BatchStats, Env, RawApp, ReleaseAssetView } from './types'

// Cloudflare Workers Paid plan 单次 invocation 上限 1000 subrequest
// 单批耗费：2（fetchDueBatch+lockBatch）+ N*5～8（fetchRepo/fetchReadme/AI/release/D1/可选SHA256）+ 1 KV
// 150 repos/run 约 750～1050 subrequest（AI 重试会括大上界）
// BATCH_SIZE=15, MAX_BATCHES_PER_RUN=10, CONCURRENCY=5 → 150 repos/invocation
const BATCH_SIZE = 15
const CONCURRENCY = 5
const MAX_BATCHES_PER_RUN = 10
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
 * 处理单个 raw_app（顶层 try/catch 兜底，确保任何异常都落库为 failed 而非沉默）
 */
async function processOne(
  raw: RawApp,
  github: GitHubClient,
  ai: AIClient,
  env: Env,
  stats: BatchStats,
): Promise<void> {
  try {
    await processOneInner(raw, github, ai, env, stats)
  } catch (err) {
    if ((err as Error).message === 'GITHUB_RATE_LIMIT') throw err
    const msg = (err as Error).message || String(err)
    // 子请求耗尽是 worker 级别的硬限制，本轮内重试无意义，下一次 cron 再试
    const isSubrequestLimit = msg.includes('Too many subrequests')
    await saveFailure(
      env, raw.full_name, 'failed',
      msg,
      isSubrequestLimit
        ? computeRetryNextCheck(0)
        : computeRetryNextCheck(raw.retry_count + 1),
    )
    stats.failed++
  }
}

async function processOneInner(
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

  // 2. 去重检查：同一 github_repo_id 已处理过则跳过
  const repo = fetchResult.repo
  const existingAppId = `app_${repo.id}`
  const existing = await env.DB.prepare(`SELECT id FROM apps WHERE id=?`).bind(existingAppId).first()
  if (existing) {
    await saveSkipped(env, fullName, 'already_processed', computeNextCheckAt(repo.pushed_at, repo.archived),
      repo.id, fetchResult.etag, repo.pushed_at, repo.archived)
    stats.skipped++
    return
  }

  // 3. 准入漏斗
  const gate = checkQualityGate(repo)
  const nextOk = computeNextCheckAt(repo.pushed_at, repo.archived)

  if (!gate.passed) {
    // gate 不过的项目按 reason 分级长退避（永久/180d/90d/30d），避免每 1~7 天无效轮询
    const nextSkip = computeSkipNextCheck(gate.reason)
    await saveSkipped(
      env, fullName, gate.reason || 'gate_failed', nextSkip,
      repo.id, fetchResult.etag, repo.pushed_at, repo.archived,
    )
    stats.skipped++
    return
  }

  // 3. README + AI 处理
  const readme = await github.fetchReadme(fullName)
  const aiResult = await ai.generate(repo, readme)

  // 4. GitHub Releases（拿下载链接 + sha256，失败/无 release 不阻断主流程）
  let releaseAssets: ReleaseAssetView[] | undefined
  try {
    const rel = await fetchLatestRelease(fullName, env.GITHUB_TOKEN)
    if (rel.status === 'ok' && rel.assets && rel.assets.length > 0) {
      releaseAssets = rel.assets
    }
  } catch (err) {
    console.warn(`[ETL] fetchLatestRelease ${fullName} failed:`, (err as Error).message)
  }

  // 4.1 准入校验：必须有可安装的 release asset（识别到 windows/macos/linux 平台的安装包）
  if (!releaseAssets || releaseAssets.length === 0) {
    // 未发 release 的仓库短期不会突然发：退避 30 天而非默认 1~7 天
    const nextSkip = computeSkipNextCheck('no_installable_release')
    await saveSkipped(
      env, fullName, 'no_installable_release', nextSkip,
      repo.id, fetchResult.etag, repo.pushed_at, repo.archived,
    )
    stats.skipped++
    return
  }

  // 5. 入库
  await saveSuccess({
    env, fullName, repo, readme,
    etag: fetchResult.etag, ai: aiResult, nextCheckAt: nextOk,
    releaseAssets,
  })
  // 向量 embedding（失败不阻塞主流程）
  try {
    const appId = `app_${repo.id}`
    await upsertEmbedding(
      env, appId, aiResult.name, aiResult.description,
      aiResult.summaryZh, aiResult.summaryEn,
      aiResult.tags, aiResult.category,
    )
  } catch { /* embedding 失败静默 */ }
  // 多语言翻译任务
  try {
    const appId = `app_${repo.id}`
    for (const tl of ['ja', 'ko', 'es', 'pt-BR']) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO translation_tasks (app_id, source_table, source_id, source_locale, target_locale) VALUES (?, 'app_translations', ?, 'zh', ?)`,
      ).bind(appId, appId, tl).run()
    }
  } catch { /* 忽略 */ }
  
  // FAQ 处理 (新增)
  try {
    const appId = `app_${repo.id}`
    const faqStats = await processFAQsForApp(env, appId, aiResult.name, aiResult.fullDescription)
    if (faqStats.processed > 0) {
      console.log(`[ETL] FAQ 处理完成: ${faqStats.succeeded}/${faqStats.processed}`)
    }
  } catch (err) {
    console.error(`[ETL] FAQ 处理失败:`, (err as Error).message)
    // FAQ 处理失败不阻塞主流程
  }
  
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
  const ai = new AIClient(env.OPENAI_API_KEY,
    env.AI_GATEWAY_ACCOUNT && env.AI_GATEWAY_TOKEN
      ? { account: env.AI_GATEWAY_ACCOUNT, token: env.AI_GATEWAY_TOKEN }
      : undefined,
  )
  const start = Date.now()
  const total: BatchStats = {
    fetched: 0, notModified: 0, skipped: 0, succeeded: 0, failed: 0, rateLimited: 0,
  }

  let batchesRun = 0
  while (Date.now() - start < WORKER_BUDGET_MS && batchesRun < MAX_BATCHES_PER_RUN) {
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
    batchesRun++
    await delay(500)
  }

  console.log(`[ETL] 本轮统计:`, total, `耗时 ${Math.round((Date.now() - start) / 1000)}s`)
  return total
}
