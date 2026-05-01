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
    const existing = (await env.KV.get<ETLMetrics>('etl_metrics', 'json')) || EMPTY_METRICS
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
        endpoints: ['POST /etl/trigger', 'GET /etl/status', 'GET /etl/metrics'],
      })
    }

    return new Response('Not Found', { status: 404 })
  },
}
