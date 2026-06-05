/**
 * OpenSource-Hub API Workers
 * Cloudflare Workers 后端 API 服务
 */

// 导入路由函数
import { getApps } from './src/routes/apps'
import { getAppById, getAppFAQs } from './src/routes/apps'
import { getCategories } from './src/routes/categories'
import { getTrending } from './src/routes/trending'
import { getHomeData } from './src/routes/home'
import { searchApps } from './src/routes/search'
import { getLibrary, getLibraryItem, getLibraryFacets } from './src/routes/library'

// 导入工具函数
import { jsonResponse, errorResponse, handleOptions } from './src/utils/response'
import { extractTags } from './src/utils/tags'

export interface Env {
  DB: D1Database
  VECTORIZE?: VectorizeIndex
  AI?: Ai
  ADMIN_TOKEN?: string
  TRIGGER_TOKEN?: string
}

// ==========================================
// 用户提交
// ==========================================

// 创建用户提交
async function createSubmission(db: D1Database, request: Request): Promise<Response> {
  try {
    const body = await request.json() as {
      name: string
      email: string
      github_url: string
      description: string
      category: string
      message?: string
    }

    // 验证必填字段
    if (!body.name || !body.email || !body.github_url || !body.description || !body.category) {
      return errorResponse('Missing required fields', 400)
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return errorResponse('Invalid email format', 400)
    }

    // 验证 GitHub URL 格式
    if (!body.github_url.startsWith('http')) {
      return errorResponse('Invalid GitHub URL', 400)
    }

    // 插入数据库
    const result = await db.prepare(
      `INSERT INTO user_submissions (id, name, email, github_url, description, category, message, status, created_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))`
    ).bind(
      body.name,
      body.email,
      body.github_url,
      body.description,
      body.category,
      body.message || null
    ).run()

    return jsonResponse({
      success: true,
      message: 'Submission received successfully',
    }, 201)
  } catch (error) {
    console.error('Error creating submission:', error)
    return errorResponse('Failed to create submission', 500)
  }
}

// ==========================================
// SHA256 工具函数
// ==========================================

// 计算 SHA256 哈希
async function sha256Hex(input: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// ==========================================
// 主入口
// ==========================================

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // 处理 CORS 预检请求
    if (method === 'OPTIONS') {
      return handleOptions()
    }

    // 路由分发
    try {
      // ---- POST 路由 ----
      if (method === 'POST') {
        if (path === '/api/submissions') {
          return await createSubmission(env.DB, request)
        }
        if (path === '/admin/login') {
          const body = await request.json().catch(() => ({})) as { token?: string }
          if (body.token && body.token === env.ADMIN_TOKEN && body.token.length > 0) {
            return jsonResponse({ ok: true })
          }
          return errorResponse('Invalid token', 401)
        }
        // Admin POST routes
        if (path === '/admin/jobs/bulk-retry') {
          const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
          if (auth !== env.ADMIN_TOKEN || !auth) return errorResponse('Unauthorized', 401)
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
          const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
          if (auth !== env.ADMIN_TOKEN || !auth) return errorResponse('Unauthorized', 401)
          const id = path.split('/')[3]
          await env.DB.prepare(`UPDATE user_submissions SET status='approved', reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run()
          return jsonResponse({ ok: true })
        }
        if (path.match(/^\/admin\/submissions\/([^/]+)\/reject$/)) {
          const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
          if (auth !== env.ADMIN_TOKEN || !auth) return errorResponse('Unauthorized', 401)
          const id = path.split('/')[3]
          await env.DB.prepare(`UPDATE user_submissions SET status='rejected', reviewed_at=CURRENT_TIMESTAMP WHERE id=?`).bind(id).run()
          return jsonResponse({ ok: true })
        }
        if (path === '/admin/translations/retry-failed') {
          const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
          if (auth !== env.ADMIN_TOKEN || !auth) return errorResponse('Unauthorized', 401)
          const r = await env.DB.prepare(
            `UPDATE translation_tasks SET status='pending', retry_count=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE status='failed'`
          ).run()
          return jsonResponse({ affected: r.meta?.changes || 0 })
        }
        if (path === '/admin/translations/bulk-retry') {
          const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
          if (auth !== env.ADMIN_TOKEN || !auth) return errorResponse('Unauthorized', 401)
          const b = await request.json().catch(() => ({})) as { ids?: number[] }
          if (!b.ids?.length) return errorResponse('ids required', 400)
          const ph = b.ids.map(() => '?').join(',')
          const r = await env.DB.prepare(
            `UPDATE translation_tasks SET status='pending', retry_count=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id IN (${ph})`
          ).bind(...b.ids).run()
          return jsonResponse({ affected: r.meta?.changes || 0 })
        }
        const transRetryMatch = path.match(/^\/admin\/translations\/(\d+)\/retry$/)
        if (transRetryMatch) {
          const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
          if (auth !== env.ADMIN_TOKEN || !auth) return errorResponse('Unauthorized', 401)
          const r = await env.DB.prepare(
            `UPDATE translation_tasks SET status='pending', retry_count=0, last_error=NULL, updated_at=CURRENT_TIMESTAMP WHERE id=?`
          ).bind(parseInt(transRetryMatch[1])).run()
          return jsonResponse({ affected: r.meta?.changes || 0 })
        }
        return errorResponse('Not found', 404)
      }

      // 其余方法仅允许 GET
      if (method !== 'GET') {
        return errorResponse('Method not allowed', 405)
      }

      // ---- GET 路由 ----
      // 标签列表（返回 slugs + slug→original 映射，供前端 tag 页和 sitemap）
      if (path === '/api/tags') {
        const tagMap = await extractTags(env.DB)
        const slugs = [...tagMap.keys()].sort()
        const map: Record<string, string> = {}
        for (const [slug, original] of tagMap) map[slug] = original
        return jsonResponse({ tags: slugs, map }, 200, { 'Cache-Control': 'public, max-age=3600' })
      }

      // Sitemap
      if (path === '/api/sitemap') {
        const [apps, libs, cats] = await Promise.all([
          env.DB.prepare(`SELECT slug, last_updated FROM apps WHERE status='active'`).all<{slug:string;last_updated:string}>(),
          env.DB.prepare(`SELECT slug, last_updated FROM apps_library WHERE status='active'`).all<{slug:string;last_updated:string}>(),
          env.DB.prepare(`SELECT slug, name FROM categories WHERE is_active=1`).all<{slug:string;name:string}>(),
        ])
        const locs = ['zh', 'en', 'ja', 'ko']
        const fmt = (d: string | null) => { if (!d) return ''; const m = d.match(/^(\d{4}-\d{2}-\d{2})/); return m ? `<lastmod>${m[1]}</lastmod>` : '' }
        const urls: string[] = []
        const today = new Date().toISOString().match(/^\d{4}-\d{2}-\d{2}/)?.[0] || ''
        for (const l of locs) urls.push(`<url><loc>https://www.opensource-hub.com/${l}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`)
        for (const c of (cats.results||[])) {
          for (const l of locs) urls.push(`<url><loc>https://www.opensource-hub.com/${l}/category/${c.slug}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>`)
        }
        for (const a of (apps.results||[])) {
          for (const l of locs) urls.push(`<url><loc>https://www.opensource-hub.com/${l}/project/${a.slug}</loc>${fmt(a.last_updated)}<changefreq>weekly</changefreq><priority>0.8</priority></url>`)
        }
        for (const li of (libs.results||[])) {
          for (const l of locs) urls.push(`<url><loc>https://www.opensource-hub.com/${l}/library/${li.slug}</loc>${fmt(li.last_updated)}<changefreq>weekly</changefreq><priority>0.7</priority></url>`)
        }

        // 标签页（使用 slug，URL-encode 处理特殊字符）
        const tagMap = await extractTags(env.DB)
        for (const slug of tagMap.keys()) {
          const encoded = encodeURIComponent(slug)
          for (const l of locs) urls.push(`<url><loc>https://www.opensource-hub.com/${l}/tag/${encoded}</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`)
        }

        // 推荐页（Worker 内联 slug 列表，与 web/config/guides.ts 同步）
        const GUIDE_SLUGS = [
          'best-free-screen-recorder', 'free-video-downloader', 'adobe-alternatives',
        ]
        for (const slug of GUIDE_SLUGS) {
          for (const l of locs) urls.push(`<url><loc>https://www.opensource-hub.com/${l}/guide/${slug}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`)
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join('')}</urlset>`
        return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' } })
      }

      // API 健康检查
      if (path === '/api/health') {
        return jsonResponse({
          status: 'ok',
          timestamp: new Date().toISOString(),
          version: '1.0.0',
        })
      }

      // 首页数据
      if (path === '/api/home') {
        return await getHomeData(env.DB, url.searchParams)
      }

      // 应用列表
      if (path === '/api/apps') {
        return await getApps(env.DB, url.searchParams)
      }

      // 应用详情
      const appDetailMatch = path.match(/^\/api\/apps\/([^/]+)$/)
      if (appDetailMatch) {
        return await getAppById(env.DB, appDetailMatch[1], url.searchParams.get('lang') || 'zh')
      }

      // 分类列表
      if (path === '/api/categories') {
        return await getCategories(env.DB)
      }

      // 热门应用
      if (path === '/api/trending') {
        return await getTrending(env.DB, url.searchParams)
      }

      // 搜索
      if (path === '/api/search') {
        return await searchApps(env.DB, url.searchParams, env)
      }

      // 代码宝库列表
      if (path === '/api/library') {
        return await getLibrary(env.DB, url.searchParams)
      }

      // 代码宝库 facets (project_type / language 分布)
      if (path === '/api/library/facets') {
        return await getLibraryFacets(env.DB)
      }

      // 代码宝库项目详情
      const libraryDetailMatch = path.match(/^\/api\/library\/([^/]+)$/)
      if (libraryDetailMatch) {
        return await getLibraryItem(env.DB, libraryDetailMatch[1], url.searchParams.get('lang') || 'zh')
      }

      // FAQ 列表（按 app_id）
      const faqMatch = path.match(/^\/api\/apps\/([^/]+)\/faqs$/)
      if (faqMatch) {
        return await getAppFAQs(env.DB, faqMatch[1], url.searchParams.get('lang') || 'en')
      }

      // ---- Admin 路由（仅 GET） ----
      const adminAuth = (r: Request) => {
        const auth = r.headers.get('Authorization') || ''
        const token = auth.replace(/^Bearer\s+/i, '')
        return token === env.ADMIN_TOKEN && token.length > 0
      }

      if (path === '/admin/stats' && adminAuth(request)) {
        const [appCount, libCount, etlStats, submissions, translationStats, deadlocked] = await Promise.all([
          env.DB.prepare(`SELECT COUNT(*) as c FROM apps WHERE status = 'active'`).first<{c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM apps_library WHERE status = 'active'`).first<{c:number}>(),
          env.DB.prepare(`SELECT etl_status, COUNT(*) as c FROM raw_apps GROUP BY etl_status`).all<{etl_status:string;c:number}>(),
          env.DB.prepare(`SELECT status, COUNT(*) as c FROM user_submissions GROUP BY status`).all<{status:string;c:number}>(),
          env.DB.prepare(`SELECT status, COUNT(*) as c FROM translation_tasks GROUP BY status`).all<{status:string;c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM translation_tasks WHERE status='failed' AND retry_count >= 3 AND last_error LIKE 'Audit:%'`).first<{c:number}>(),
        ])
        const etl: Record<string,number> = {}; (etlStats.results||[]).forEach(r => etl[r.etl_status]=r.c)
        const sub: Record<string,number> = {}; (submissions.results||[]).forEach(r => sub[r.status]=r.c)
        const tr: Record<string,number> = {}; (translationStats.results||[]).forEach(r => tr[r.status]=r.c)
        return jsonResponse({ apps: appCount?.c||0, library: libCount?.c||0, etl, submissions: sub, translation: tr, translationDeadlocked: deadlocked?.c||0 })
      }

      if (path === '/admin/jobs' && adminAuth(request)) {
        const st = url.searchParams.get('status')
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = 30; const offset = (page - 1) * limit
        console.log('[API /admin/jobs] status:', st, 'page:', page, 'limit:', limit)
        let sql = `SELECT * FROM raw_apps`; const binds: (string|number)[] = []
        if (st) { sql += ` WHERE etl_status = ?`; binds.push(st) }
        sql += ` ORDER BY last_processed_at DESC LIMIT ? OFFSET ?`; binds.push(limit, offset)
        console.log('[API /admin/jobs] SQL:', sql, 'binds:', binds)
        const { results } = await env.DB.prepare(sql).bind(...binds).all()
        let countSql = `SELECT COUNT(*) as c FROM raw_apps`; const countBinds: (string|number)[] = []
        if (st) { countSql += ` WHERE etl_status = ?`; countBinds.push(st) }
        console.log('[API /admin/jobs] countSQL:', countSql, 'countBinds:', countBinds)
        const { c } = await env.DB.prepare(countSql).bind(...countBinds).first<{c:number}>() || {c:0}
        return jsonResponse({ data: results||[], total: c||0, page, limit })
      }

      if (path === '/admin/translations' && adminAuth(request)) {
        const st = url.searchParams.get('status')
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = 30; const offset = (page - 1) * limit
        let sql = `SELECT * FROM translation_tasks`; const binds: (string|number)[] = []
        if (st) { sql += ` WHERE status = ?`; binds.push(st) }
        sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`; binds.push(limit, offset)
        const { results } = await env.DB.prepare(sql).bind(...binds).all()
        let countSql = `SELECT COUNT(*) as c FROM translation_tasks`; const countBinds: (string|number)[] = []
        if (st) { countSql += ` WHERE status = ?`; countBinds.push(st) }
        const { c } = await env.DB.prepare(countSql).bind(...countBinds).first<{c:number}>() || {c:0}
        return jsonResponse({ data: results||[], total: c||0, page, limit })
      }

      if (path === '/admin/daily-stats' && adminAuth(request)) {
        const today = `datetime('now', 'start of day')`
        const [newApps, etlDone, etlFailed, transDone, transFailed] = await Promise.all([
          env.DB.prepare(`SELECT COUNT(*) as c FROM apps WHERE etl_processed_at >= ${today} AND status='active'`).first<{c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM raw_apps WHERE last_processed_at >= ${today} AND etl_status='completed'`).first<{c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM raw_apps WHERE last_processed_at >= ${today} AND etl_status='failed'`).first<{c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM translation_tasks WHERE updated_at >= ${today} AND status='done'`).first<{c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM translation_tasks WHERE updated_at >= ${today} AND status='failed'`).first<{c:number}>(),
        ])
        return jsonResponse({
          newApps: newApps?.c||0, etlDone: etlDone?.c||0, etlFailed: etlFailed?.c||0,
          transDone: transDone?.c||0, transFailed: transFailed?.c||0,
        })
      }

      if (path === '/admin/faq-stats' && adminAuth(request)) {
        const [raw, faqs, trTasks, todayHarvested, todayEtlDone] = await Promise.all([
          env.DB.prepare(`SELECT etl_status, COUNT(*) as c FROM raw_faqs GROUP BY etl_status`).all<{etl_status:string;c:number}>(),
          env.DB.prepare(`SELECT status, COUNT(*) as c FROM app_faqs GROUP BY status`).all<{status:string;c:number}>(),
          env.DB.prepare(`SELECT target_locale, status, COUNT(*) as c FROM translation_tasks WHERE source_table='app_faqs' GROUP BY target_locale, status ORDER BY target_locale, status`).all<{target_locale:string;status:string;c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM raw_faqs WHERE fetched_at >= datetime('now', 'start of day')`).first<{c:number}>(),
          env.DB.prepare(`SELECT COUNT(*) as c FROM raw_faqs WHERE etl_processed_at >= datetime('now', 'start of day')`).first<{c:number}>(),
        ])
        const rawMap: Record<string,number> = {}; (raw.results||[]).forEach(r => rawMap[r.etl_status]=r.c)
        const faqMap: Record<string,number> = {}; (faqs.results||[]).forEach(r => faqMap[r.status]=r.c)
        const trMap: Record<string, Record<string,number>> = {}
        ;(trTasks.results||[]).forEach(r => {
          if (!trMap[r.target_locale]) trMap[r.target_locale] = {}
          trMap[r.target_locale][r.status] = r.c
        })
        return jsonResponse({
          raw: rawMap, faqs: faqMap, translations: trMap,
          todayHarvested: todayHarvested?.c || 0, todayEtlDone: todayEtlDone?.c || 0,
        })
      }

      if (path === '/admin/submissions' && adminAuth(request)) {
        const st = url.searchParams.get('status') || 'pending'
        const page = parseInt(url.searchParams.get('page') || '1')
        const limit = 20; const offset = (page - 1) * limit
        const { results } = await env.DB.prepare(
          `SELECT * FROM user_submissions WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        ).bind(st, limit, offset).all()
        const { c } = await env.DB.prepare(`SELECT COUNT(*) as c FROM user_submissions WHERE status = ?`).bind(st).first<{c:number}>() || {c:0}
        return jsonResponse({ data: results||[], total: c||0, page, limit })
      }

      // ---- Admin 触发 ETL/Translator 端点 ----
      if (path === '/admin/trigger-etl' && adminAuth(request)) {
        ctx.waitUntil(fetch('https://opensource-hub-etl.358042175.workers.dev/etl/trigger', {
          method: 'POST', headers: { 'Authorization': `Bearer ${env.TRIGGER_TOKEN}` },
        }))
        return jsonResponse({ ok: true })
      }
      if (path === '/admin/trigger-translate' && adminAuth(request)) {
        ctx.waitUntil(fetch('https://opensource-hub-translator.358042175.workers.dev/translate/trigger', {
          method: 'POST', headers: { 'Authorization': `Bearer ${env.TRIGGER_TOKEN}` },
        }))
        return jsonResponse({ ok: true })
      }

      // 404
      return errorResponse('Not found', 404)
    } catch (error) {
      console.error('Unhandled error:', error)
      return errorResponse('Internal server error', 500)
    }
  },
}
