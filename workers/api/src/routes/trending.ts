/**
 * 热门应用路由
 */

import { jsonResponse, errorResponse } from '../utils/response'
import { TRANSLATION_JOIN, TRANSLATION_SELECT } from '../sql/constants'

// 获取热门应用
export async function getTrending(db: D1Database, params: URLSearchParams): Promise<Response> {
  const period = params.get('period') || 'week' // day, week, alltime
  const limit = Math.min(parseInt(params.get('limit') || '10'), 50)
  const lang = params.get('lang') || 'zh'

  try {
    const selectFields = `
      a.id, a.name, a.slug, a.description, a.full_description, a.category,
      a.stars_count, a.last_updated,
      c.name as category_name,
      ${TRANSLATION_SELECT}`
    const joinClause = `
      LEFT JOIN categories c ON a.category = c.slug
      ${TRANSLATION_JOIN}`

    let query: string

    if (period === 'day') {
      query = `SELECT ${selectFields} FROM apps a ${joinClause}
               WHERE a.status = 'active' AND a.etl_processed_at >= datetime('now', 'start of day')
               ORDER BY a.stars_count DESC LIMIT ?`
    } else if (period === 'week') {
      query = `SELECT ${selectFields} FROM apps a ${joinClause}
               WHERE a.status = 'active' AND a.etl_processed_at >= datetime('now', '-7 days')
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
