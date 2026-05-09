/**
 * OpenSource-Hub API Workers
 * Cloudflare Workers 后端 API 服务
 */

export interface Env {
  DB: D1Database
}

// CORS 响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

// 创建 JSON 响应
function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
  })
}

// 创建错误响应
function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

// 处理 OPTIONS 请求（CORS 预检）
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}

// ==========================================
// locale fallback SQL 片段（参数化，严禁拼接 lang）
// 语义：优先命中请求语言的翻译；若该语言没有记录，COALESCE 回退到 'zh'
// 安全要点：使用 ? 占位符，由调用方 bind(lang, ...) 传入，防 SQL 注入
// ==========================================
const LOCALE_FALLBACK_SQL =
  `COALESCE((SELECT locale FROM app_translations WHERE app_id = a.id AND locale = ? LIMIT 1), 'zh')`

// ==========================================
// API 路由处理
// ==========================================

// 获取应用列表
async function getApps(db: D1Database, params: URLSearchParams): Promise<Response> {
  const category = params.get('category')
  const limit = Math.min(parseInt(params.get('limit') || '20'), 100)
  const offset = parseInt(params.get('offset') || '0')
  const featured = params.get('featured')
  const search = params.get('q')
  const lang = params.get('lang') || 'zh'

  try {
    let query = `
      SELECT
        a.id, a.name, a.slug, a.description, a.category, a.tags,
        a.github_url, a.license, a.homepage_url, a.is_featured,
        a.status, a.stars_count, a.last_updated, a.created_at,
        c.name as category_name,
        t.summary, t.description as trans_desc, t.full_description as trans_full_desc, t.features, t.use_cases, t.quick_start_guide, t.uninstall_guide, t.caveats
      FROM apps a
      LEFT JOIN categories c ON a.category = c.slug
      LEFT JOIN app_translations t ON t.app_id = a.id AND t.locale = ${LOCALE_FALLBACK_SQL}
      WHERE a.status = 'active'
    `
    // 第一个绑定参数始终是 locale fallback 子查询使用的 lang
    const bindings: (string | number)[] = [lang]

    if (category) {
      query += ` AND a.category = ?`
      bindings.push(category)
    }

    if (featured === 'true') {
      query += ` AND a.is_featured = 1`
    }

    if (search) {
      query += ` AND (a.name LIKE ? OR a.description LIKE ? OR a.tags LIKE ?)`
      const searchPattern = `%${search}%`
      bindings.push(searchPattern, searchPattern, searchPattern)
    }

    query += ` ORDER BY a.stars_count DESC LIMIT ? OFFSET ?`
    bindings.push(limit, offset)

    const { results } = await db.prepare(query).bind(...bindings).all()

    // 获取每个应用的版本信息
    const appsWithVersions = await Promise.all(
      (results || []).map(async (app: Record<string, unknown>) => {
        const { results: versions } = await db
          .prepare(`
            SELECT id, version, os_type, arch, file_type, file_name,
                   file_size, download_url, sha256, release_date, is_stable
            FROM app_versions
            WHERE app_id = ?
            ORDER BY release_date DESC
          `)
          .bind(app.id)
          .all()

        return {
          ...app,
          description: app.trans_desc || app.description,
          full_description: app.trans_full_desc || app.full_description,
          ai_content: {
            summary: app.summary,
            features: app.features,
            use_cases: app.use_cases,
            quick_start_guide: app.quick_start_guide,
            uninstall_guide: app.uninstall_guide,
            caveats: app.caveats,
          },
          versions: versions || [],
        }
      })
    )

    return jsonResponse({
      data: appsWithVersions,
      pagination: {
        limit,
        offset,
        hasMore: appsWithVersions.length === limit,
      },
    })
  } catch (error) {
    console.error('Error fetching apps:', error)
    return errorResponse('Failed to fetch apps', 500)
  }
}

// 获取应用详情
async function getAppById(db: D1Database, id: string, lang: string): Promise<Response> {
  try {
    // 获取应用基本信息
    const app = await db
      .prepare(`
        SELECT
          a.*,
          c.name as category_name
        FROM apps a
        LEFT JOIN categories c ON a.category = c.slug
        WHERE a.id = ? OR a.slug = ?
      `)
      .bind(id, id)
      .first()

    if (!app) {
      return errorResponse('App not found', 404)
    }

    // 获取版本信息
    const { results: versions } = await db
      .prepare(`
        SELECT * FROM app_versions
        WHERE app_id = ?
        ORDER BY release_date DESC
      `)
      .bind(app.id)
      .all()

    // 获取 AI 内容：优先请求的语言，fallback 到 zh，再 fallback 到 app_ai_content
    let aiContent = await db
      .prepare(`SELECT * FROM app_translations WHERE app_id = ? AND locale = ?`)
      .bind(app.id, lang)
      .first()

    // 如果请求的语言翻译不存在，fallback 到中文
    if (!aiContent && lang !== 'zh') {
      aiContent = await db
        .prepare(`SELECT * FROM app_translations WHERE app_id = ? AND locale = 'zh'`)
        .bind(app.id)
        .first()
    }

    // 如果 app_translations 完全没有记录，fallback 到 app_ai_content 表
    if (!aiContent) {
      const legacyAi = await db
        .prepare(`SELECT * FROM app_ai_content WHERE app_id = ?`)
        .bind(app.id)
        .first()
      if (legacyAi) {
        // 将 app_ai_content 格式映射为 app_translations 格式
        aiContent = {
          id: (legacyAi as any).id,
          app_id: app.id,
          locale: 'zh',
          summary: (legacyAi as any).summary,
          description: app.description,
          full_description: (app as any).full_description,
          features: (legacyAi as any).what_it_does,
          use_cases: (legacyAi as any).use_cases,
          quick_start_guide: (legacyAi as any).quick_start_guide,
          uninstall_guide: (legacyAi as any).uninstall_guide,
          caveats: (legacyAi as any).what_it_cant_do,
          is_portable: (legacyAi as any).is_portable,
          requirements: (legacyAi as any).requirements,
          requirement_links: (legacyAi as any).requirement_links,
          has_registry_residual: (legacyAi as any).has_registry_residual,
          translated_by: 'legacy',
          ai_model_version: (legacyAi as any).ai_model_version,
          quality_score: (legacyAi as any).confidence_score,
        }
      }
    }

    // 获取安全信息
    const security = await db
      .prepare(`SELECT * FROM app_security WHERE app_id = ?`)
      .bind(app.id)
      .first()

    return jsonResponse({
      ...app,
      description: (aiContent as any)?.description || app.description,
      full_description: (aiContent as any)?.full_description || (app as any).full_description,
      versions: versions || [],
      ai_content: aiContent,
      security,
    })
  } catch (error) {
    console.error('Error fetching app:', error)
    return errorResponse('Failed to fetch app', 500)
  }
}

// 获取分类列表
async function getCategories(db: D1Database): Promise<Response> {
  try {
    const { results } = await db
      .prepare(`
        SELECT 
          c.*,
          COUNT(a.id) as app_count
        FROM categories c
        LEFT JOIN apps a ON a.category = c.slug AND a.status = 'active'
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY c.sort_order ASC
      `)
      .all()

    return jsonResponse({ data: results || [] })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return errorResponse('Failed to fetch categories', 500)
  }
}

// 获取热门应用
async function getTrending(db: D1Database, params: URLSearchParams): Promise<Response> {
  const period = params.get('period') || 'week' // day, week, alltime
  const limit = Math.min(parseInt(params.get('limit') || '10'), 50)
  const lang = params.get('lang') || 'zh'

  try {
    const selectFields = `
      a.id, a.name, a.slug, a.description, a.full_description, a.category,
      a.stars_count, a.last_updated,
      c.name as category_name,
      t.summary, t.description as trans_desc, t.full_description as trans_full_desc, t.features, t.use_cases, t.quick_start_guide, t.uninstall_guide, t.caveats`
    const joinClause = `
      LEFT JOIN categories c ON a.category = c.slug
      LEFT JOIN app_translations t ON t.app_id = a.id AND t.locale = ${LOCALE_FALLBACK_SQL}`

    let query: string

    // 时间窗口过滤：day=最近1天更新过的，week=最近7天更新过的，alltime=不限
    // 兼容安全：若时间窗口内数据不足，涉及测试期数据稀疏的场景，可以回退为无窗口排序
    if (period === 'day') {
      query = `SELECT ${selectFields} FROM apps a ${joinClause}
               WHERE a.status = 'active' AND a.last_updated >= datetime('now', '-1 day')
               ORDER BY a.last_updated DESC LIMIT ?`
    } else if (period === 'week') {
      query = `SELECT ${selectFields} FROM apps a ${joinClause}
               WHERE a.status = 'active' AND a.last_updated >= datetime('now', '-7 days')
               ORDER BY a.stars_count DESC LIMIT ?`
    } else {
      query = `SELECT ${selectFields} FROM apps a ${joinClause} WHERE a.status = 'active' ORDER BY a.stars_count DESC LIMIT ?`
    }

    // 绑定顺序：locale fallback 的 lang，然后是 limit
    const { results } = await db.prepare(query).bind(lang, limit).all()

    const mappedResults = (results || []).map((app: any) => ({
      ...app,
      description: app.trans_desc || app.description,
      full_description: app.trans_full_desc || app.full_description,
      ai_content: {
        summary: app.summary,
        features: app.features,
        use_cases: app.use_cases,
        quick_start_guide: app.quick_start_guide,
        uninstall_guide: app.uninstall_guide,
        caveats: app.caveats,
      }
    }))

    return jsonResponse({
      data: mappedResults,
      period,
    })
  } catch (error) {
    console.error('Error fetching trending:', error)
    return errorResponse('Failed to fetch trending apps', 500)
  }
}

// 搜索应用
async function searchApps(db: D1Database, params: URLSearchParams): Promise<Response> {
  const query = params.get('q')
  const limit = Math.min(parseInt(params.get('limit') || '20'), 50)
  const lang = params.get('lang') || 'zh'

  if (!query || query.trim().length < 2) {
    return errorResponse('Search query must be at least 2 characters', 400)
  }

  try {
    const searchPattern = `%${query}%`

    // 搜索修复：
    // 1. COLLATE NOCASE 解决英文大小写敏感（Node LIKE node）
    // 2. 同时搜索翻译表的 description/full_description/summary，覆盖多语言内容
    // 3. 增加 full_description 和 category_name 匹配，扩大命中面
    // 4. 排序优先：name 完全匹配 > name 包含 > tags 包含 > stars 高
    const { results } = await db
      .prepare(`
        SELECT
          a.id, a.name, a.slug, a.description, a.full_description, a.category, a.tags,
          a.github_url, a.license, a.stars_count, a.last_updated,
          c.name as category_name,
          t.summary, t.description as trans_desc, t.full_description as trans_full_desc, t.features, t.use_cases, t.quick_start_guide, t.uninstall_guide, t.caveats
        FROM apps a
        LEFT JOIN categories c ON a.category = c.slug
        LEFT JOIN app_translations t ON t.app_id = a.id AND t.locale = ${LOCALE_FALLBACK_SQL}
        WHERE a.status = 'active'
          AND (
            a.name LIKE ? COLLATE NOCASE
            OR a.description LIKE ? COLLATE NOCASE
            OR a.full_description LIKE ? COLLATE NOCASE
            OR a.tags LIKE ? COLLATE NOCASE
            OR t.description LIKE ? COLLATE NOCASE
            OR t.full_description LIKE ? COLLATE NOCASE
            OR t.summary LIKE ? COLLATE NOCASE
            OR c.name LIKE ? COLLATE NOCASE
          )
        ORDER BY
          CASE WHEN a.name = ? COLLATE NOCASE THEN 0
               WHEN a.name LIKE ? COLLATE NOCASE THEN 1
               WHEN a.tags LIKE ? COLLATE NOCASE THEN 2
               ELSE 3 END,
          a.stars_count DESC
        LIMIT ?
      `)
      // 绑定顺序：locale、8个 WHERE LIKE、ORDER BY 中的 name精准/name模糊/tags模糊、limit
      .bind(
        lang,
        searchPattern, searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern, searchPattern,
        query, searchPattern, searchPattern,
        limit,
      )
      .all()

    // 记录搜索分析
    await db
      .prepare(`
        INSERT INTO search_analytics (id, search_query, result_count, has_results, search_count, last_searched)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, 1, datetime('now'))
        ON CONFLICT(search_query) DO UPDATE SET
          result_count = excluded.result_count,
          has_results = excluded.has_results,
          search_count = search_count + 1,
          last_searched = datetime('now')
      `)
      .bind(query, results?.length || 0, results && results.length > 0 ? 1 : 0)
      .run()

    const mappedResults = (results || []).map((app: any) => ({
      ...app,
      description: app.trans_desc || app.description,
      full_description: app.trans_full_desc || app.full_description,
      ai_content: {
        summary: app.summary,
        features: app.features,
        use_cases: app.use_cases,
        quick_start_guide: app.quick_start_guide,
        uninstall_guide: app.uninstall_guide,
        caveats: app.caveats,
      }
    }))

    return jsonResponse({
      data: mappedResults,
      query,
      count: results?.length || 0,
    })
  } catch (error) {
    console.error('Error searching apps:', error)
    return errorResponse('Failed to search apps', 500)
  }
}

// 用户提交（提交软件 / 提交需求）— 写入 user_submissions，不自动进入采集队列
async function createSubmission(db: D1Database, request: Request): Promise<Response> {
  let body: Record<string, unknown>
  try {
    body = await request.json() as Record<string, unknown>
  } catch {
    return errorResponse('Invalid JSON body', 400)
  }

  const source = String(body.source || '').trim()
  if (source !== 'software' && source !== 'request') {
    return errorResponse('source must be software or request', 400)
  }

  const description = String(body.description || '').trim()
  if (!description || description.length < 5) {
    return errorResponse('description is required (>= 5 chars)', 400)
  }
  if (description.length > 2000) {
    return errorResponse('description too long (<= 2000 chars)', 400)
  }

  const email = body.email ? String(body.email).trim() : null
  if (email && (!email.includes('@') || email.length > 200)) {
    return errorResponse('invalid email', 400)
  }

  let name: string | null = null
  let repoUrl: string | null = null
  let scenario: string | null = null

  if (source === 'software') {
    name = body.name ? String(body.name).trim().slice(0, 200) : null
    repoUrl = String(body.repoUrl || '').trim()
    if (!name) return errorResponse('name is required for software submission', 400)
    if (!repoUrl || !repoUrl.includes('github.com')) {
      return errorResponse('valid github repo URL is required', 400)
    }
    if (repoUrl.length > 300) return errorResponse('repoUrl too long', 400)
  } else {
    scenario = body.scenario ? String(body.scenario).trim().slice(0, 200) : null
  }

  // 生成 UUID（D1 无 gen_random_uuid，用 hex(randomblob)）或 crypto.randomUUID
  const id = crypto.randomUUID()

  // 访客信息（防滥用，IP hash）
  const ipRaw = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || ''
  const ipHash = ipRaw ? await sha256Hex(ipRaw).then(h => h.slice(0, 16)) : null
  const ua = (request.headers.get('User-Agent') || '').slice(0, 200)

  try {
    // 通过 repo_url 去重：同一 GitHub 仓库 24h 内仅接受 1 次提交
    if (source === 'software' && repoUrl) {
      const dup = await db.prepare(
        `SELECT id FROM user_submissions
         WHERE source = 'software' AND repo_url = ?
           AND created_at > datetime('now', '-1 day')
         LIMIT 1`,
      ).bind(repoUrl).first()
      if (dup) {
        return jsonResponse({
          success: true,
          id: (dup as { id: string }).id,
          message: 'already submitted recently, pending review',
          deduplicated: true,
        }, 200)
      }
    }

    await db.prepare(
      `INSERT INTO user_submissions
         (id, source, name, repo_url, description, scenario, email, status, ip_hash, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
    ).bind(id, source, name, repoUrl, description, scenario, email, ipHash, ua).run()

    return jsonResponse({ success: true, id, status: 'pending' }, 201)
  } catch (error) {
    console.error('createSubmission error:', error)
    return errorResponse('Failed to save submission', 500)
  }
}

// SHA-256 十六进制（Workers runtime 原生支持 WebCrypto）
async function sha256Hex(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

// 获取首页数据
async function getHomeData(db: D1Database, params: URLSearchParams): Promise<Response> {
  const lang = params.get('lang') || 'zh'
  try {
    const appSelectFields = `
      a.id, a.name, a.slug, a.description, a.full_description, a.category, a.stars_count,
      t.summary, t.description as trans_desc, t.full_description as trans_full_desc, t.features, t.use_cases, t.quick_start_guide, t.uninstall_guide, t.caveats`
    const appJoinClause = `
      LEFT JOIN app_translations t ON t.app_id = a.id AND t.locale = ${LOCALE_FALLBACK_SQL}`

    // 并行获取各类数据（每条含 locale fallback 的 SQL 都必须 bind(lang)）
    const [
      featuredApps,
      categories,
      trendingApps,
      newApps,
    ] = await Promise.all([
      // 精选推荐 v1 评分模型：
      //   featured_score =
      //       stars_norm  * 0.5   // 星数平滑归一：x/(x+5000)，避免超大仓库排方独占
      //     + recency    * 0.3   // 距今更新：近30天近1.0，180天后接近0
      //     + quality    * 0.2   // 质量信号：有 AI 摘要（summary 非空且 >20 字）+1
      //   硬性准入：stars≥200 + 最近 180 天内更新 + status='active'
      //   排序关键字：is_featured(人工置顶) DESC, featured_score DESC
      db.prepare(`
        SELECT ${appSelectFields}, a.is_featured,
          (
            (CAST(a.stars_count AS REAL) / (a.stars_count + 5000.0)) * 0.5 +
            (1.0 / (1.0 + MAX(0.0, julianday('now') - julianday(COALESCE(a.last_updated, a.created_at))) / 30.0)) * 0.3 +
            (CASE WHEN t.summary IS NOT NULL AND LENGTH(t.summary) > 20 THEN 1.0 ELSE 0.0 END) * 0.2
          ) AS featured_score
        FROM apps a
        ${appJoinClause}
        WHERE a.status = 'active'
          AND a.stars_count >= 200
          AND COALESCE(a.last_updated, a.created_at) >= datetime('now', '-180 days')
        ORDER BY a.is_featured DESC, featured_score DESC
        LIMIT 6
      `).bind(lang).all(),

      // 分类列表（无 locale JOIN，不需要绑定）
      db.prepare(`
        SELECT c.*, COUNT(a.id) as app_count
        FROM categories c
        LEFT JOIN apps a ON a.category = c.slug AND a.status = 'active'
        WHERE c.is_active = 1
        GROUP BY c.id
        ORDER BY c.sort_order ASC
      `).all(),

      // 热门应用
      db.prepare(`
        SELECT ${appSelectFields}
        FROM apps a
        ${appJoinClause}
        WHERE a.status = 'active'
        ORDER BY a.stars_count DESC
        LIMIT 10
      `).bind(lang).all(),

      // 最新添加
      db.prepare(`
        SELECT ${appSelectFields}
        FROM apps a
        ${appJoinClause}
        WHERE a.status = 'active'
        ORDER BY a.created_at DESC
        LIMIT 6
      `).bind(lang).all(),
    ])

    const mapApp = (app: any) => ({
      ...app,
      description: app.trans_desc || app.description,
      full_description: app.trans_full_desc || app.full_description,
      ai_content: {
        summary: app.summary,
        features: app.features,
        use_cases: app.use_cases,
        quick_start_guide: app.quick_start_guide,
        uninstall_guide: app.uninstall_guide,
        caveats: app.caveats,
      }
    })

    return jsonResponse({
      featured: (featuredApps.results || []).map(mapApp),
      categories: categories.results || [],
      trending: (trendingApps.results || []).map(mapApp),
      newArrivals: (newApps.results || []).map(mapApp),
    })
  } catch (error) {
    console.error('Error fetching home data:', error)
    return errorResponse('Failed to fetch home data', 500)
  }
}

// ==========================================
// 代码宝库 (apps_library) 路由
// ==========================================

// 获取代码宝库列表
// 翻译策略：优先请求 locale 的翻译 → 回back 到 zh 翻译 → 最后回back 到主表原始字段
// 不用 correlated subquery（D1/SQLite 对 JOIN ON 里的相关子查询处理不稳定，会静默 fallback）
async function getLibrary(db: D1Database, params: URLSearchParams): Promise<Response> {
  const projectType = params.get('project_type')
  const category = params.get('category')
  const language = params.get('language')
  const limit = Math.min(parseInt(params.get('limit') || '24'), 100)
  const offset = parseInt(params.get('offset') || '0')
  const sort = params.get('sort') || 'stars'   // stars | updated
  const lang = params.get('lang') || 'zh'

  try {
    let query = `
      SELECT
        l.id, l.github_repo_id, l.slug, l.name, l.full_name,
        l.description, l.summary, l.full_description, l.readme_preview,
        l.tags, l.language, l.project_type, l.category,
        l.stars_count, l.html_url, l.homepage, l.license, l.last_updated, l.status,
        c.name as category_name,
        t_req.summary as trans_summary_req,
        t_req.full_description as trans_full_description_req,
        t_zh.summary as trans_summary_zh,
        t_zh.full_description as trans_full_description_zh
      FROM apps_library l
      LEFT JOIN categories c ON l.category = c.slug
      LEFT JOIN apps_library_translations t_req
        ON t_req.library_id = l.id AND t_req.locale = ?
      LEFT JOIN apps_library_translations t_zh
        ON t_zh.library_id = l.id AND t_zh.locale = 'zh'
      WHERE l.status = 'active'
    `
    const bindings: (string | number)[] = [lang]

    if (projectType) {
      query += ` AND l.project_type = ?`
      bindings.push(projectType)
    }
    if (category) {
      query += ` AND l.category = ?`
      bindings.push(category)
    }
    if (language) {
      query += ` AND l.language = ?`
      bindings.push(language)
    }

    const orderBy = sort === 'updated'
      ? `l.last_updated DESC`
      : `l.stars_count DESC`
    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`
    bindings.push(limit, offset)

    const { results } = await db.prepare(query).bind(...bindings).all()

    const mapped = (results || []).map((r: any) => {
      // 修复: 与详情页逻辑保持一致
      // 优先级: 请求语言翻译 > 主表原始值(英文) > 中文翻译
      // 原逻辑错误: t_req 为 NULL 时直接选 t_zh(中文),导致英文页面显示中文
      const hasReqTranslation = r.trans_summary_req !== null || r.trans_full_description_req !== null
      
      return {
        ...r,
        summary: hasReqTranslation
          ? (r.trans_summary_req || r.summary)  // 有请求语言翻译就用,否则用主表
          : (lang === 'zh' ? r.trans_summary_zh || r.summary : r.summary),  // 非中文请求且无翻译时,不用中文
        full_description: hasReqTranslation
          ? (r.trans_full_description_req || r.full_description)
          : (lang === 'zh' ? r.trans_full_description_zh || r.full_description : r.full_description),
        // 堆减内部字段,避免泄露给前端
        trans_summary_req: undefined,
        trans_summary_zh: undefined,
        trans_full_description_req: undefined,
        trans_full_description_zh: undefined,
      }
    })

    return jsonResponse({
      data: mapped,
      pagination: { limit, offset, hasMore: mapped.length === limit },
    })
  } catch (error) {
    console.error('Error fetching library:', error)
    return errorResponse('Failed to fetch library', 500)
  }
}

// 获取代码宝库项目详情
async function getLibraryItem(db: D1Database, idOrSlug: string, lang: string): Promise<Response> {
  try {
    const item = await db.prepare(
      `SELECT l.*, c.name as category_name
       FROM apps_library l
       LEFT JOIN categories c ON l.category = c.slug
       WHERE l.slug = ? OR l.id = ?`,
    ).bind(idOrSlug, idOrSlug).first()
    if (!item) return errorResponse('Library item not found', 404)

    let tr = await db.prepare(
      `SELECT summary, full_description FROM apps_library_translations WHERE library_id = ? AND locale = ?`,
    ).bind((item as any).id, lang).first()
    if (!tr && lang !== 'zh') {
      tr = await db.prepare(
        `SELECT summary, full_description FROM apps_library_translations WHERE library_id = ? AND locale = 'zh'`,
      ).bind((item as any).id).first()
    }

    return jsonResponse({
      ...item,
      summary: (tr as any)?.summary || (item as any).summary,
      full_description: (tr as any)?.full_description || (item as any).full_description,
    })
  } catch (error) {
    console.error('Error fetching library item:', error)
    return errorResponse('Failed to fetch library item', 500)
  }
}

// 获取代码宝库的 project_type 分布 (用于前端筛选器)
async function getLibraryFacets(db: D1Database): Promise<Response> {
  try {
    const [types, languages] = await Promise.all([
      db.prepare(
        `SELECT project_type, COUNT(*) as count FROM apps_library
         WHERE status = 'active' GROUP BY project_type ORDER BY count DESC`,
      ).all(),
      db.prepare(
        `SELECT language, COUNT(*) as count FROM apps_library
         WHERE status = 'active' AND language IS NOT NULL
         GROUP BY language ORDER BY count DESC LIMIT 20`,
      ).all(),
    ])
    return jsonResponse({
      projectTypes: types.results || [],
      languages: languages.results || [],
    })
  } catch (error) {
    console.error('Error fetching library facets:', error)
    return errorResponse('Failed to fetch facets', 500)
  }
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
        return errorResponse('Not found', 404)
      }

      // 其余方法仅允许 GET
      if (method !== 'GET') {
        return errorResponse('Method not allowed', 405)
      }

      // ---- GET 路由 ----
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
        return await searchApps(env.DB, url.searchParams)
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

      // 404
      return errorResponse('Not found', 404)
    } catch (error) {
      console.error('Unhandled error:', error)
      return errorResponse('Internal server error', 500)
    }
  },
}
