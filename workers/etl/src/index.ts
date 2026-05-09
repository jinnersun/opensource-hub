/**
 * OpenSource-Hub ETL Worker（增量发现 + ETag + 动态退避）
 *
 * 触发方式：
 *   - 定时：cron（见 wrangler.toml）
 *   - HTTP：POST /etl/trigger 手动触发
 *           GET  /etl/status   待处理状态
 *           GET  /etl/metrics  累计指标
 */

import { runEtl } from './scheduler'
import { fetchLatestRelease } from './release'
import { saveVersionsOnly } from './persistence'
import { promoteToLibrary } from './library'
import type { BatchStats, Env } from './types'

interface ETLMetrics {
  totalProcessed: number
  totalSucceeded: number
  totalNotModified: number
  totalSkipped: number
  totalFailed: number
  totalRateLimited: number
  lastRun: string | null
}

const EMPTY_METRICS: ETLMetrics = {
  totalProcessed: 0,
  totalSucceeded: 0,
  totalNotModified: 0,
  totalSkipped: 0,
  totalFailed: 0,
  totalRateLimited: 0,
  lastRun: null,
}

async function recordMetrics(env: Env, stats: BatchStats): Promise<void> {
  try {
    // 与旧版 KV 数据兼容：缺失字段按 0 处理，避免 undefined + N = NaN（序列化为 null）
    const raw = (await env.KV.get<Partial<ETLMetrics>>('etl_metrics', 'json')) || {}
    const existing: ETLMetrics = { ...EMPTY_METRICS, ...raw }
    const updated: ETLMetrics = {
      totalProcessed: existing.totalProcessed + stats.fetched,
      totalSucceeded: existing.totalSucceeded + stats.succeeded,
      totalNotModified: existing.totalNotModified + stats.notModified,
      totalSkipped: existing.totalSkipped + stats.skipped,
      totalFailed: existing.totalFailed + stats.failed,
      totalRateLimited: existing.totalRateLimited + stats.rateLimited,
      lastRun: new Date().toISOString(),
    }
    await env.KV.put('etl_metrics', JSON.stringify(updated), {
      expirationTtl: 30 * 24 * 60 * 60,
    })
  } catch (err) {
    console.error('[ETL] 写入指标失败:', err)
  }
}

async function executeAndRecord(env: Env): Promise<void> {
  const stats = await runEtl(env)
  await recordMetrics(env, stats)
  // 主 ETL 跑完后自动触发 Library 分支：处理 Trending 高星无 Release 的候选者
  // 独立 try/catch，Library 分支的失败不影响主指标
  try {
    const libStats = await promoteToLibrary(env)
    console.log('[ETL scheduled] library stats:', libStats)
  } catch (err) {
    console.error('[ETL scheduled] promoteToLibrary failed:', (err as Error).message)
  }
}

/**
 * 仅给已 completed 的 raw_apps 增量补齐 release/sha256，不重跑 AI。
 * 优先处理那些 app_versions 表里没有任何记录的项目。
 */
async function refreshVersions(env: Env, limit: number): Promise<void> {
  const rows = await env.DB.prepare(
    `SELECT r.full_name, r.github_repo_id
     FROM raw_apps r
     WHERE r.etl_status = 'completed'
       AND r.github_repo_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM app_versions v WHERE v.app_id = 'app_' || r.github_repo_id
       )
     ORDER BY r.last_processed_at DESC
     LIMIT ?`,
  ).bind(limit).all<{ full_name: string; github_repo_id: number }>()

  let ok = 0, noRel = 0, fail = 0
  for (const r of rows.results || []) {
    try {
      const rel = await fetchLatestRelease(r.full_name, env.GITHUB_TOKEN)
      if (rel.status === 'ok' && rel.assets && rel.assets.length > 0) {
        await saveVersionsOnly(env, `app_${r.github_repo_id}`, rel.assets)
        ok++
      } else {
        noRel++
      }
    } catch (err) {
      console.warn(`[refreshVersions] ${r.full_name} failed:`, (err as Error).message)
      fail++
    }
  }
  console.log(`[refreshVersions] done: ok=${ok} noRelease=${noRel} fail=${fail} total=${rows.results?.length || 0}`)
}

async function handleStatus(env: Env): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT etl_status, COUNT(*) AS count FROM raw_apps GROUP BY etl_status`,
  ).all<{ etl_status: string; count: number }>()

  const due = await env.DB.prepare(
    `SELECT COUNT(*) AS count FROM raw_apps
     WHERE retry_count < max_retries
       AND etl_status != 'processing'
       AND (next_check_at IS NULL OR next_check_at <= CURRENT_TIMESTAMP)`,
  ).first<{ count: number }>()

  const byStatus: Record<string, number> = {}
  for (const r of rows.results || []) byStatus[r.etl_status] = r.count

  return Response.json({
    byStatus,
    dueNow: due?.count || 0,
    timestamp: new Date().toISOString(),
  })
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    console.log('[ETL] scheduled 触发')
    ctx.waitUntil(executeAndRecord(env))
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/etl/trigger' && request.method === 'POST') {
      ctx.waitUntil(executeAndRecord(env))
      return new Response('ETL job started in background', { status: 202 })
    }

    if (url.pathname === '/etl/promote-library' && request.method === 'POST') {
      // 手动触发 Library 分支，不跑主 ETL
      ctx.waitUntil(
        promoteToLibrary(env)
          .then(s => console.log('[promote-library] done:', s))
          .catch(e => console.error('[promote-library] failed:', (e as Error).message)),
      )
      return new Response('promote-library started', { status: 202 })
    }

    if (url.pathname === '/etl/refresh-versions' && request.method === 'POST') {
      const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') || '20')))
      ctx.waitUntil(refreshVersions(env, limit))
      return new Response(`refresh-versions started (limit=${limit})`, { status: 202 })
    }

    if (url.pathname === '/etl/status' && request.method === 'GET') {
      try {
        return await handleStatus(env)
      } catch (err) {
        return new Response(`status error: ${(err as Error).message}`, { status: 500 })
      }
    }

    if (url.pathname === '/etl/metrics' && request.method === 'GET') {
      const metrics = (await env.KV.get('etl_metrics')) || JSON.stringify(EMPTY_METRICS)
      return new Response(metrics, {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    if (url.pathname === '/' || url.pathname === '/health') {
      return Response.json({
        service: 'opensource-hub-etl',
        status: 'ok',
        endpoints: [
          'POST /etl/trigger',
          'POST /etl/promote-library',
          'POST /etl/refresh-versions?limit=20',
          'GET /etl/status',
          'GET /etl/metrics',
        ],
      })
    }

    return new Response('Not Found', { status: 404 })
  },
}
