/**
 * 应用列表和详情路由
 */

import { jsonResponse, errorResponse } from '../utils/response'
import { TRANSLATION_JOIN, TRANSLATION_SELECT } from '../sql/constants'

// 获取应用列表
export async function getApps(db: D1Database, params: URLSearchParams): Promise<Response> {
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
        ${TRANSLATION_SELECT}
      FROM apps a
      LEFT JOIN categories c ON a.category = c.slug
      ${TRANSLATION_JOIN}
      WHERE a.status = 'active'
    `
    // TRANSLATION_JOIN 中 t_req.locale = ? 需要绑定的 lang
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

    // 标签过滤（支持单标签和多标签逗号分隔 OR 查询）
    const tag = params.get('tag')
    if (tag) {
      const tags = tag.split(',').map(t => t.trim()).filter(Boolean)
      if (tags.length === 1) {
        query += ` AND a.tags LIKE ?`
        bindings.push(`%"${tags[0]}"%`)
      } else if (tags.length > 1) {
        const orClauses = tags.map(() => `a.tags LIKE ?`).join(' OR ')
        query += ` AND (${orClauses})`
        for (const t of tags) bindings.push(`%"${t}"%`)
      }
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
export async function getAppById(db: D1Database, id: string, lang: string): Promise<Response> {
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
