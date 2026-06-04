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
import { saveVersionsOnly, upsertEmbedding } from './persistence'
import { promoteToLibrary } from './library'
import { processAllPendingFAQs } from './faq-generator'
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

async function processFAQ(env: Env): Promise<void> {
  try {
    const fStats = await processAllPendingFAQs(env)
    if (fStats.issues > 0) {
      console.log('[FAQ] scheduled stats:', fStats)
    }
  } catch (err) {
    console.error('[FAQ] processAllPendingFAQs failed:', (err as Error).message)
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

/**
 * 存量项目向量回填：对已有的 apps 生成 embedding 并写入 Vectorize
 * 同步执行，返回详细结果。用 offset 参数分批调用，避免超时。
 * 幂等：重复 upsert 会覆盖同 ID 的旧向量
 */
async function backfillEmbeddings(
  env: Env, batchSize: number, offset: number,
): Promise<{ done: number; failed: number; errors: string[]; hasMore: boolean; nextOffset: number }> {
  let done = 0
  let failed = 0
  const errors: string[] = []

  const rows = await env.DB.prepare(
    `SELECT a.id, a.name, a.description, a.tags, a.category,
            t_zh.summary as summaryZh, t_en.summary as summaryEn
     FROM apps a
     LEFT JOIN app_translations t_zh ON t_zh.app_id = a.id AND t_zh.locale = 'zh'
     LEFT JOIN app_translations t_en ON t_en.app_id = a.id AND t_en.locale = 'en'
     WHERE a.status = 'active'
     ORDER BY a.id
     LIMIT ? OFFSET ?`,
  ).bind(batchSize, offset).all<{
    id: string; name: string; description: string | null;
    tags: string | null; category: string;
    summaryZh: string | null; summaryEn: string | null;
  }>()

  if (!rows.results || rows.results.length === 0) {
    return { done: 0, failed: 0, errors: [], hasMore: false, nextOffset: offset }
  }

  for (const r of rows.results) {
    try {
      let tags: string[] = []
      if (r.tags) {
        try { tags = JSON.parse(r.tags) } catch { tags = [r.tags] }
      }
      await upsertEmbedding(
        env, r.id, r.name, r.description || '',
        r.summaryZh || '', r.summaryEn || '',
        tags, r.category || '',
      )
      done++
    } catch (err) {
      failed++
      const msg = `${r.id}: ${(err as Error).message}`
      errors.push(msg)
      console.warn(`[backfill] ${msg}`)
    }
  }

  const hasMore = rows.results.length === batchSize
  const nextOffset = offset + rows.results.length
  console.log(`[backfill] offset=${offset} done=${done} failed=${failed} hasMore=${hasMore}`)
  return { done, failed, errors, hasMore, nextOffset }
}

/**
 * 库项目向量回填：对 apps_library 表生成 embedding
 */
async function backfillLibraryEmbeddings(
  env: Env, batchSize: number, offset: number,
): Promise<{ done: number; failed: number; errors: string[]; hasMore: boolean; nextOffset: number }> {
  let done = 0; let failed = 0; const errors: string[] = []
  const rows = await env.DB.prepare(
    `SELECT l.github_repo_id, l.name, l.description, l.tags, l.category,
            t_zh.summary as summaryZh, t_en.summary as summaryEn
     FROM apps_library l
     LEFT JOIN apps_library_translations t_zh ON t_zh.library_id = l.id AND t_zh.locale = 'zh'
     LEFT JOIN apps_library_translations t_en ON t_en.library_id = l.id AND t_en.locale = 'en'
     WHERE l.status = 'active'
     ORDER BY l.id
     LIMIT ? OFFSET ?`,
  ).bind(batchSize, offset).all<{
    github_repo_id: number; name: string; description: string | null;
    tags: string | null; category: string | null;
    summaryZh: string | null; summaryEn: string | null;
  }>()
  if (!rows.results || rows.results.length === 0) {
    return { done: 0, failed: 0, errors: [], hasMore: false, nextOffset: offset }
  }
  for (const r of rows.results) {
    try {
      let tags: string[] = []
      if (r.tags) { try { tags = JSON.parse(r.tags) } catch { tags = [r.tags] } }
      await upsertEmbedding(
        env, `lib_${r.github_repo_id}`, r.name, r.description || '',
        r.summaryZh || '', r.summaryEn || '', tags, r.category || '',
      )
      done++
    } catch (err) {
      failed++
      errors.push(`lib_${r.github_repo_id}: ${(err as Error).message}`)
    }
  }
  const hasMore = rows.results.length === batchSize
  console.log(`[backfill-lib] offset=${offset} done=${done} failed=${failed} hasMore=${hasMore}`)
  return { done, failed, errors, hasMore, nextOffset: offset + rows.results.length }
}

export default {
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    console.log('[ETL] scheduled trigger')
    ctx.waitUntil(Promise.all([
      executeAndRecord(env),
      processFAQ(env),
    ]))
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // POST 操作鉴权
    const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
    const ok = auth && auth === env.TRIGGER_TOKEN

    if (url.pathname === '/etl/trigger' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      ctx.waitUntil(executeAndRecord(env))
      return new Response('ETL job started in background', { status: 202 })
    }

    if (url.pathname === '/etl/promote-library' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      ctx.waitUntil(
        promoteToLibrary(env)
          .then(s => console.log('[promote-library] done:', s))
          .catch(e => console.error('[promote-library] failed:', (e as Error).message)),
      )
      return new Response('promote-library started', { status: 202 })
    }

    if (url.pathname === '/etl/refresh-versions' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      const limit = Math.max(1, Math.min(50, parseInt(url.searchParams.get('limit') || '20')))
      ctx.waitUntil(refreshVersions(env, limit))
      return new Response(`refresh-versions started (limit=${limit})`, { status: 202 })
    }

    if (url.pathname === '/etl/backfill-embeddings' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      const batchSize = Math.max(1, Math.min(20, parseInt(url.searchParams.get('batch') || '10')))
      const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'))
      try {
        const result = await backfillEmbeddings(env, batchSize, offset)
        return Response.json(result)
      } catch (err) {
        return new Response(`backfill error: ${(err as Error).message}`, { status: 500 })
      }
    }

    // 诊断端点：测试 AI + Vectorize 绑定是否正常
    if (url.pathname === '/etl/backfill-library-embeddings' && request.method === 'POST') {
      if (!ok) return new Response('Unauthorized', { status: 401 })
      const batchSize = Math.max(1, Math.min(20, parseInt(url.searchParams.get('batch') || '10')))
      const offset = Math.max(0, parseInt(url.searchParams.get('offset') || '0'))
      try {
        const result = await backfillLibraryEmbeddings(env, batchSize, offset)
        return Response.json(result)
      } catch (err) {
        return new Response(`backfill error: ${(err as Error).message}`, { status: 500 })
      }
    }

    if (url.pathname === '/etl/diag' && request.method === 'GET') {
      const diag: Record<string, unknown> = {}
      // Test AI binding
      try {
        const aiRes = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: ['hello test'] }) as { data: number[][] }
        diag.ai = { ok: true, dimensions: aiRes.data?.[0]?.length || 0 }
      } catch (err) {
        diag.ai = { ok: false, error: (err as Error).message }
      }
      // Test Vectorize binding
      try {
        await env.VECTORIZE.getByIds(['nonexistent-test-id'])
        diag.vectorize = { ok: true }
      } catch (err) {
        diag.vectorize = { ok: false, error: (err as Error).message }
      }
      // Count apps
      const count = await env.DB.prepare(`SELECT COUNT(*) as c FROM apps WHERE status = 'active'`).first<{ c: number }>()
      diag.appCount = count?.c || 0
      return Response.json(diag)
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
          'POST /etl/backfill-embeddings?batch=10&offset=0',
          'POST /etl/backfill-library-embeddings?batch=10&offset=0',
          'GET /etl/diag',
          'GET /etl/status',
          'GET /etl/metrics',
        ],
      })
    }

    return new Response('Not Found', { status: 404 })
  },
}
