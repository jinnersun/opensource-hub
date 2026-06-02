/**
 * 代码宝库路由
 */

import { jsonResponse, errorResponse } from '../utils/response'

// 获取代码宝库列表
// 翻译策略：优先请求 locale 的翻译 → 回back 到 zh 翻译 → 最后回back 到主表原始字段
// 不用 correlated subquery（D1/SQLite 对 JOIN ON 里的相关子查询处理不稳定，会静默 fallback）
export async function getLibrary(db: D1Database, params: URLSearchParams): Promise<Response> {
  const projectType = params.get('project_type')
  const category = params.get('category')
  const language = params.get('language')
  const limit = Math.min(parseInt(params.get('limit') || '24'), 100)
  const offset = parseInt(params.get('offset') || '0')
  const sort = params.get('sort') || 'stars'   // stars | updated
  const lang = params.get('lang') || 'zh'
  const q = params.get('q')

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

    if (q && q.trim().length >= 2) {
      const qPattern = `%${q.trim()}%`
      query += ` AND (l.name LIKE ? OR l.full_name LIKE ? OR l.description LIKE ?
                OR l.summary LIKE ? OR l.full_description LIKE ?
                OR l.tags LIKE ? OR l.language LIKE ?
                OR t_req.summary LIKE ? OR t_req.full_description LIKE ?
                OR t_zh.summary LIKE ? OR t_zh.full_description LIKE ?)`
      bindings.push(qPattern, qPattern, qPattern, qPattern, qPattern, qPattern, qPattern, qPattern, qPattern, qPattern, qPattern)
    }

    if (projectType) {
      query += ` AND l.project_type = ?`
      bindings.push(projectType)
    }
    if (category) {
      query += ` AND l.category = ?`
      bindings.push(category)
    }
    if (language && !q) {  // 有搜索词时 language 由 LIKE 覆盖，不再精确过滤
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
export async function getLibraryItem(db: D1Database, idOrSlug: string, lang: string): Promise<Response> {
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
export async function getLibraryFacets(db: D1Database): Promise<Response> {
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
