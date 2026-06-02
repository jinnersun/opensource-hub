/**
 * 分类列表路由
 */

import { jsonResponse, errorResponse } from '../utils/response'

// 获取分类列表
export async function getCategories(db: D1Database): Promise<Response> {
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
