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
// API 路由处理
// ==========================================

// 获取应用列表
async function getApps(db: D1Database, params: URLSearchParams): Promise<Response> {
  const category = params.get('category')
  const limit = Math.min(parseInt(params.get('limit') || '20'), 100)
  const offset = parseInt(params.get('offset') || '0')
  const featured = params.get('featured')
  const search = params.get('q')

  try {
    let query = `
      SELECT 
        a.id, a.name, a.slug, a.description, a.category, a.tags,
        a.github_url, a.license, a.homepage_url, a.is_featured,
        a.status, a.stars_count, a.last_updated, a.created_at,
        c.name as category_name
      FROM apps a
      LEFT JOIN categories c ON a.category = c.slug
      WHERE a.status = 'active'
    `
    const bindings: (string | number)[] = []

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
                   file_size, download_url, release_date, is_stable
            FROM app_versions 
            WHERE app_id = ? 
            ORDER BY release_date DESC
          `)
          .bind(app.id)
          .all()
        
        return {
          ...app,
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
async function getAppById(db: D1Database, id: string): Promise<Response> {
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

    // 获取 AI 内容
    const aiContent = await db
      .prepare(`SELECT * FROM app_ai_content WHERE app_id = ?`)
      .bind(app.id)
      .first()

    // 获取安全信息
    const security = await db
      .prepare(`SELECT * FROM app_security WHERE app_id = ?`)
      .bind(app.id)
      .first()

    return jsonResponse({
      ...app,
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

  try {
    let query: string
    
    if (period === 'day') {
      // 按24小时增长排序（这里用 stars_count 模拟）
      query = `
        SELECT a.id, a.name, a.slug, a.description, a.category, 
               a.stars_count, a.last_updated,
               c.name as category_name
        FROM apps a
        LEFT JOIN categories c ON a.category = '#' || c.slug
        WHERE a.status = 'active'
        ORDER BY a.last_updated DESC
        LIMIT ?
      `
    } else if (period === 'week') {
      // 按周增长排序
      query = `
        SELECT a.id, a.name, a.slug, a.description, a.category,
               a.stars_count, a.last_updated,
               c.name as category_name
        FROM apps a
        LEFT JOIN categories c ON a.category = '#' || c.slug
        WHERE a.status = 'active'
        ORDER BY a.stars_count DESC
        LIMIT ?
      `
    } else {
      // alltime - 按总 stars 排序
      query = `
        SELECT a.id, a.name, a.slug, a.description, a.category,
               a.stars_count, a.last_updated,
               c.name as category_name
        FROM apps a
        LEFT JOIN categories c ON a.category = '#' || c.slug
        WHERE a.status = 'active'
        ORDER BY a.stars_count DESC
        LIMIT ?
      `
    }

    const { results } = await db.prepare(query).bind(limit).all()

    return jsonResponse({
      data: results || [],
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

  if (!query || query.trim().length < 2) {
    return errorResponse('Search query must be at least 2 characters', 400)
  }

  try {
    const searchPattern = `%${query}%`
    
    const { results } = await db
      .prepare(`
        SELECT 
          a.id, a.name, a.slug, a.description, a.category, a.tags,
          a.github_url, a.license, a.stars_count, a.last_updated,
          c.name as category_name
        FROM apps a
        LEFT JOIN categories c ON a.category = '#' || c.slug
        WHERE a.status = 'active'
          AND (a.name LIKE ? OR a.description LIKE ? OR a.tags LIKE ?)
        ORDER BY 
          CASE WHEN a.name LIKE ? THEN 0 ELSE 1 END,
          a.stars_count DESC
        LIMIT ?
      `)
      .bind(searchPattern, searchPattern, searchPattern, `%${query}%`, limit)
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

    return jsonResponse({
      data: results || [],
      query,
      count: results?.length || 0,
    })
  } catch (error) {
    console.error('Error searching apps:', error)
    return errorResponse('Failed to search apps', 500)
  }
}

// 获取首页数据
async function getHomeData(db: D1Database): Promise<Response> {
  try {
    // 并行获取各类数据
    const [
      featuredApps,
      categories,
      trendingApps,
      newApps,
    ] = await Promise.all([
      // 推荐应用
      db.prepare(`
        SELECT a.id, a.name, a.slug, a.description, a.category, a.stars_count
        FROM apps a
        WHERE a.status = 'active' AND a.is_featured = 1
        ORDER BY a.stars_count DESC
        LIMIT 6
      `).all(),
      
      // 分类列表
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
        SELECT a.id, a.name, a.slug, a.description, a.category, a.stars_count
        FROM apps a
        WHERE a.status = 'active'
        ORDER BY a.stars_count DESC
        LIMIT 10
      `).all(),
      
      // 最新添加
      db.prepare(`
        SELECT a.id, a.name, a.slug, a.description, a.category, a.stars_count
        FROM apps a
        WHERE a.status = 'active'
        ORDER BY a.created_at DESC
        LIMIT 6
      `).all(),
    ])

    return jsonResponse({
      featured: featuredApps.results || [],
      categories: categories.results || [],
      trending: trendingApps.results || [],
      newArrivals: newApps.results || [],
    })
  } catch (error) {
    console.error('Error fetching home data:', error)
    return errorResponse('Failed to fetch home data', 500)
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

    // 只允许 GET 请求
    if (method !== 'GET') {
      return errorResponse('Method not allowed', 405)
    }

    // 路由匹配
    try {
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
        return await getHomeData(env.DB)
      }

      // 应用列表
      if (path === '/api/apps') {
        return await getApps(env.DB, url.searchParams)
      }

      // 应用详情
      const appDetailMatch = path.match(/^\/api\/apps\/([^/]+)$/)
      if (appDetailMatch) {
        return await getAppById(env.DB, appDetailMatch[1])
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

      // 404
      return errorResponse('Not found', 404)
    } catch (error) {
      console.error('Unhandled error:', error)
      return errorResponse('Internal server error', 500)
    }
  },
}
