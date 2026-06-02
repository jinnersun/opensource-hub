/**
 * 首页数据路由
 */

import { jsonResponse, errorResponse } from '../utils/response'
import { TRANSLATION_JOIN, TRANSLATION_SELECT } from '../sql/constants'

// 获取首页数据
export async function getHomeData(db: D1Database, params: URLSearchParams): Promise<Response> {
  const lang = params.get('lang') || 'zh'
  try {
    const appSelectFields = `
      a.id, a.name, a.slug, a.description, a.full_description, a.category, a.stars_count,
      ${TRANSLATION_SELECT}`
    const appJoinClause = `
      ${TRANSLATION_JOIN}`

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
            (CASE WHEN COALESCE(t_req.summary, t_zh.summary) IS NOT NULL AND LENGTH(COALESCE(t_req.summary, t_zh.summary)) > 20 THEN 1.0 ELSE 0.0 END) * 0.2
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
