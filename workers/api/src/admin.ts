import { jsonResponse, errorResponse } from './utils'
import type { Env } from './utils'

function adminAuth(request: Request, env: Env): boolean {
  const auth = request.headers.get('Authorization') || ''
  const token = auth.replace(/^Bearer\s+/i, '')
  return token === env.ADMIN_TOKEN && token.length > 0
}

export async function handleAdminRoute(
  path: string, method: string, request: Request, env: Env, ctx: ExecutionContext,
): Promise<Response | null> {
  const url = new URL(request.url)

  // ---- POST 路由 ----
  if (method === 'POST') {
    // 登录（不需要鉴权）
    if (path === '/admin/login') {
      const body = await request.json().catch(() => ({})) as { token?: string }
      if (body.token && body.token === env.ADMIN_TOKEN && body.token.length > 0) {
        return jsonResponse({ ok: true })
      }
      return errorResponse('Invalid token', 401)
    }

    // 以下需要 adminAuth
    if (path === '/admin/jobs/bulk-retry') {
      if (!adminAuth(request, env)) return errorResponse('Unauthorized', 401)
      const b = await request.json().catch(() => ({})) as { ids?: number[]; status?: string }
      let affected = 0
      if (b.ids?.length) {
        const ph = b.ids.map(() => '?').join(',')
        const r = await env.DB.prepare(`UPDATE raw_apps SET etl_status='pending', retry_count=0, next_check_at=NULL WHERE github_repo_id IN (${ph})`).bind(...b.ids).run()
        affected = r.meta?.changes || 0
      } else if (b.status) {
        const r = await env.DB.prepare(`UPDATE raw_apps SET etl_status='pending', retry_count=0, next_check_at=NULL WHERE etl_status=?`).bind(b.status).run()
        affected = r.meta?.changes || 0
      }
      return jsonResponse({ affected })
    }

    if (path.match(/^\/admin\/submissions\/([^/]+)\/approve$/)) {
      if (!adminAuth(request, env)) return errorResponse('Unauthorized', 401)
      const id = path.split('/')[3]
      await env.DB.prepare(`UPDATE user_submissions SET status='approved', reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run()
      return jsonResponse({ ok: true })
    }

    if (path.match(/^\/admin\/submissions\/([^/]+)\/reject$/)) {
      if (!adminAuth(request, env)) return errorResponse('Unauthorized', 401)
      const id = path.split('/')[3]
      await env.DB.prepare(`UPDATE user_submissions SET status='rejected', reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run()
      return jsonResponse({ ok: true })
    }

    if (path === '/admin/translations/retry-failed') {
      if (!adminAuth(request, env)) return errorResponse('Unauthorized', 401)
      const r = await env.DB.prepare(`UPDATE translation_tasks SET status='pending', retry_count=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE status='failed'`).run()
      return jsonResponse({ affected: r.meta?.changes || 0 })
    }

    if (path === '/admin/translations/bulk-retry') {
      if (!adminAuth(request, env)) return errorResponse('Unauthorized', 401)
      const b = await request.json().catch(() => ({})) as { ids?: number[] }
      if (!b.ids?.length) return errorResponse('ids required', 400)
      const ph = b.ids.map(() => '?').join(',')
      const r = await env.DB.prepare(`UPDATE translation_tasks SET status='pending', retry_count=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id IN (${ph})`).bind(...b.ids).run()
      return jsonResponse({ affected: r.meta?.changes || 0 })
    }

    const transRetryMatch = path.match(/^\/admin\/translations\/(\d+)\/retry$/)
    if (transRetryMatch) {
      if (!adminAuth(request, env)) return errorResponse('Unauthorized', 401)
      const r = await env.DB.prepare(`UPDATE translation_tasks SET status='pending', retry_count=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(parseInt(transRetryMatch[1])).run()
      return jsonResponse({ affected: r.meta?.changes || 0 })
    }

    return null  // 非 admin POST 路由，让 index.ts 处理
  }

  // ---- GET 路由 ----
  if (method !== 'GET') return null
  if (!adminAuth(request, env)) return null

  if (path === '/admin/stats') {
    const [appCount, libCount, etlStats, submissions, translationStats] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as c FROM apps WHERE status = 'active'`).first<{c:number}>(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM apps_library WHERE status = 'active'`).first<{c:number}>(),
      env.DB.prepare(`SELECT etl_status, COUNT(*) as c FROM raw_apps GROUP BY etl_status`).all<{etl_status:string;c:number}>(),
      env.DB.prepare(`SELECT status, COUNT(*) as c FROM user_submissions GROUP BY status`).all<{status:string;c:number}>(),
      env.DB.prepare(`SELECT status, COUNT(*) as c FROM translation_tasks GROUP BY status`).all<{status:string;c:number}>(),
    ])
    const etl: Record<string,number> = {}; (etlStats.results||[]).forEach(r => etl[r.etl_status]=r.c)
    const sub: Record<string,number> = {}; (submissions.results||[]).forEach(r => sub[r.status]=r.c)
    const tr: Record<string,number> = {}; (translationStats.results||[]).forEach(r => tr[r.status]=r.c)
    return jsonResponse({ apps: appCount?.c||0, library: libCount?.c||0, etl, submissions: sub, translation: tr })
  }

  if (path === '/admin/jobs') {
    const st = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = 30; const offset = (page - 1) * limit
    let sql = `SELECT * FROM raw_apps`; const binds: (string|number)[] = []
    if (st) { sql += ` WHERE etl_status = ?`; binds.push(st) }
    sql += ` ORDER BY last_processed_at DESC LIMIT ? OFFSET ?`; binds.push(limit, offset)
    const { results } = await env.DB.prepare(sql).bind(...binds).all()
    const { c } = await env.DB.prepare(`SELECT COUNT(*) as c FROM raw_apps`).first<{c:number}>() || {c:0}
    return jsonResponse({ data: results||[], total: c||0, page, limit })
  }

  if (path === '/admin/translations') {
    const st = url.searchParams.get('status')
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = 30; const offset = (page - 1) * limit
    let sql = `SELECT * FROM translation_tasks`; const binds: (string|number)[] = []
    if (st) { sql += ` WHERE status = ?`; binds.push(st) }
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`; binds.push(limit, offset)
    const { results } = await env.DB.prepare(sql).bind(...binds).all()
    const { c } = await env.DB.prepare(`SELECT COUNT(*) as c FROM translation_tasks`).first<{c:number}>() || {c:0}
    return jsonResponse({ data: results||[], total: c||0, page, limit })
  }

  if (path === '/admin/daily-stats') {
    const today = `datetime('now', 'start of day')`
    const [newApps, etlDone, etlFailed, transDone, transFailed] = await Promise.all([
      env.DB.prepare(`SELECT COUNT(*) as c FROM apps WHERE etl_processed_at >= ${today} AND status='active'`).first<{c:number}>(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM raw_apps WHERE last_processed_at >= ${today} AND etl_status='completed'`).first<{c:number}>(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM raw_apps WHERE last_processed_at >= ${today} AND etl_status='failed'`).first<{c:number}>(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM translation_tasks WHERE updated_at >= ${today} AND status='done'`).first<{c:number}>(),
      env.DB.prepare(`SELECT COUNT(*) as c FROM translation_tasks WHERE updated_at >= ${today} AND status='failed'`).first<{c:number}>(),
    ])
    return jsonResponse({ newApps: newApps?.c||0, etlDone: etlDone?.c||0, etlFailed: etlFailed?.c||0, transDone: transDone?.c||0, transFailed: transFailed?.c||0 })
  }

  if (path === '/admin/submissions') {
    const st = url.searchParams.get('status') || 'pending'
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = 20; const offset = (page - 1) * limit
    const { results } = await env.DB.prepare(`SELECT * FROM user_submissions WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`).bind(st, limit, offset).all()
    const { c } = await env.DB.prepare(`SELECT COUNT(*) as c FROM user_submissions WHERE status = ?`).bind(st).first<{c:number}>() || {c:0}
    return jsonResponse({ data: results||[], total: c||0, page, limit })
  }

  if (path === '/admin/trigger-etl') {
    ctx.waitUntil(fetch('https://opensource-hub-etl.358042175.workers.dev/etl/trigger', {
      method: 'POST', headers: { 'Authorization': `Bearer ${env.TRIGGER_TOKEN}` },
    }))
    return jsonResponse({ ok: true })
  }

  if (path === '/admin/trigger-translate') {
    ctx.waitUntil(fetch('https://opensource-hub-translator.358042175.workers.dev/translate/trigger', {
      method: 'POST', headers: { 'Authorization': `Bearer ${env.TRIGGER_TOKEN}` },
    }))
    return jsonResponse({ ok: true })
  }

  return null
}
