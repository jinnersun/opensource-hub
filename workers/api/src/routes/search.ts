/**
 * 搜索路由
 */

import { jsonResponse, errorResponse } from '../utils/response'
import { TRANSLATION_JOIN, TRANSLATION_SELECT } from '../sql/constants'

export interface Env {
  DB: D1Database
  VECTORIZE?: VectorizeIndex
  AI?: Ai
  ADMIN_TOKEN?: string
  TRIGGER_TOKEN?: string
}

// 搜索应用
export async function searchApps(db: D1Database, params: URLSearchParams, env: Env): Promise<Response> {
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
          ${TRANSLATION_SELECT}
        FROM apps a
        LEFT JOIN categories c ON a.category = c.slug
        ${TRANSLATION_JOIN}
        WHERE a.status = 'active'
          AND (
            a.name LIKE ? COLLATE NOCASE
            OR a.description LIKE ? COLLATE NOCASE
            OR a.full_description LIKE ? COLLATE NOCASE
            OR a.tags LIKE ? COLLATE NOCASE
            OR t_req.description LIKE ? COLLATE NOCASE
            OR t_req.full_description LIKE ? COLLATE NOCASE
            OR t_req.summary LIKE ? COLLATE NOCASE
            OR t_zh.description LIKE ? COLLATE NOCASE
            OR t_zh.full_description LIKE ? COLLATE NOCASE
            OR t_zh.summary LIKE ? COLLATE NOCASE
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
      // 绑定顺序：locale、10个 WHERE LIKE、ORDER BY 中的 name精准/name模糊/tags模糊、limit
      .bind(
        lang,
        searchPattern, searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern,
        searchPattern, searchPattern, searchPattern,
        searchPattern,
        query, searchPattern, searchPattern,
        limit,
      )
      .all()

    // SQL 搜索代码宝库（与 apps 并行）
    let libResults: any[] = []
    {
      const { results: lr } = await db.prepare(
        `SELECT l.id, l.github_repo_id, l.slug, l.name, l.full_name,
                l.description, l.summary, l.full_description,
                l.tags, l.language, l.project_type, l.category,
                l.stars_count, l.html_url, l.homepage, l.license, l.last_updated, l.status,
                c.name as category_name,
                t_req.summary as trans_summary_req, t_req.full_description as trans_full_description_req,
                t_zh.summary as trans_summary_zh, t_zh.full_description as trans_full_description_zh
         FROM apps_library l
         LEFT JOIN categories c ON l.category = c.slug
         LEFT JOIN apps_library_translations t_req ON t_req.library_id = l.id AND t_req.locale = ?
         LEFT JOIN apps_library_translations t_zh ON t_zh.library_id = l.id AND t_zh.locale = 'zh'
         WHERE l.status = 'active'
           AND (l.name LIKE ? OR l.full_name LIKE ? OR l.description LIKE ?
                OR l.summary LIKE ? OR l.full_description LIKE ?
                OR l.tags LIKE ? OR l.language LIKE ?
                OR t_req.summary LIKE ? OR t_req.full_description LIKE ?
                OR t_zh.summary LIKE ? OR t_zh.full_description LIKE ?)
         ORDER BY l.stars_count DESC LIMIT 10`,
      ).bind(lang,
        searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern,
      ).all()
      libResults = (lr || []).map((r: any) => {
        const hasReq = r.trans_summary_req !== null || r.trans_full_description_req !== null
        return {
          ...r,
          _source: 'library' as const,
          summary: hasReq ? (r.trans_summary_req || r.summary) : (lang === 'zh' ? r.trans_summary_zh || r.summary : r.summary),
          full_description: hasReq ? (r.trans_full_description_req || r.full_description) : (lang === 'zh' ? r.trans_full_description_zh || r.full_description : r.full_description),
          trans_summary_req: undefined, trans_summary_zh: undefined,
          trans_full_description_req: undefined, trans_full_description_zh: undefined,
        }
      })
    }

    // 向量搜索（有 Vectorize + AI 绑定时自动启用，失败静默回退）
    let vectorAppIds: string[] = []
    let vectorLibIds: string[] = []
    if (env.VECTORIZE && env.AI) {
      try {
        const embResult = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [query] }) as { data: number[][] }
        const qv = embResult.data?.[0]
        if (qv && qv.length > 0) {
          const vecMatches = await env.VECTORIZE.query(qv, { topK: 10, returnMetadata: false })
          const ids = (vecMatches.matches || []).map((m: { id: string }) => m.id).filter(Boolean)
          vectorAppIds = ids.filter(id => id.startsWith('app_'))
          vectorLibIds = ids.filter(id => id.startsWith('lib_'))
        }
      } catch (err) { console.warn('[Vectorize] query failed:', (err as Error).message) }
    }

    // 向量命中但 SQL 未命中的 app，补查 D1
    let vectorApps: any[] = []
    {
      const newIds = vectorAppIds.filter(id => !(results || []).some((r: any) => r.id === id))
      if (newIds.length > 0) {
        const vp = newIds.map(() => '?').join(',')
        const { results: vResults } = await db.prepare(
          `SELECT a.id, a.name, a.slug, a.description, a.full_description, a.category, a.tags,
                  a.github_url, a.license, a.stars_count, a.last_updated,
                  c.name as category_name, ${TRANSLATION_SELECT}
           FROM apps a LEFT JOIN categories c ON a.category = c.slug
           ${TRANSLATION_JOIN}
           WHERE a.status = 'active' AND a.id IN (${vp})`,
        ).bind(lang, ...newIds).all()
        vectorApps = (vResults || [])
      }
    }

    // 向量命中但 SQL 未命中的 library，补查 D1
    let vectorLibs: any[] = []
    {
      const libIdNums = vectorLibIds.map(id => parseInt(id.replace('lib_', ''))).filter(n => !isNaN(n))
      const existingLibIds = new Set((libResults || []).map((r: any) => r.github_repo_id))
      const newLibNums = libIdNums.filter(n => !existingLibIds.has(n))
      if (newLibNums.length > 0) {
        const vp = newLibNums.map(() => '?').join(',')
        const { results: vResults } = await db.prepare(
          `SELECT l.id, l.github_repo_id, l.slug, l.name, l.full_name,
                  l.description, l.summary, l.full_description,
                  l.tags, l.language, l.project_type, l.category,
                  l.stars_count, l.html_url, l.homepage, l.license, l.last_updated, l.status,
                  c.name as category_name,
                  t_req.summary as trans_summary_req, t_req.full_description as trans_full_description_req,
                  t_zh.summary as trans_summary_zh, t_zh.full_description as trans_full_description_zh
           FROM apps_library l
           LEFT JOIN categories c ON l.category = c.slug
           LEFT JOIN apps_library_translations t_req ON t_req.library_id = l.id AND t_req.locale = ?
           LEFT JOIN apps_library_translations t_zh ON t_zh.library_id = l.id AND t_zh.locale = 'zh'
           WHERE l.status = 'active' AND l.github_repo_id IN (${vp})`,
        ).bind(lang, ...newLibNums).all()
        vectorLibs = ((vResults || []) as any[]).map((r: any) => {
          const hasReq = r.trans_summary_req !== null || r.trans_full_description_req !== null
          return {
            ...r,
            _source: 'library' as const,
            summary: hasReq ? (r.trans_summary_req || r.summary) : (lang === 'zh' ? r.trans_summary_zh || r.summary : r.summary),
            full_description: hasReq ? (r.trans_full_description_req || r.full_description) : (lang === 'zh' ? r.trans_full_description_zh || r.full_description : r.full_description),
            trans_summary_req: undefined, trans_summary_zh: undefined,
            trans_full_description_req: undefined, trans_full_description_zh: undefined,
          }
        })
      }
    }

    // 合并结果：apps 在前、library 在后
    const allResults = [...(results || []), ...vectorApps, ...libResults, ...vectorLibs]

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
      .bind(query, allResults.length, allResults.length > 0 ? 1 : 0)
      .run()

    const mappedResults = allResults.map((item: any) => {
      if (item._source === 'library') {
        return {
          ...item,
          _source: 'library',
          description: item.summary || item.description,
        }
      }
      return {
        ...item,
        _source: 'app',
        description: item.trans_desc || item.description,
        full_description: item.trans_full_desc || item.full_description,
        ai_content: {
          summary: item.summary,
          features: item.features,
          use_cases: item.use_cases,
          quick_start_guide: item.quick_start_guide,
          uninstall_guide: item.uninstall_guide,
          caveats: item.caveats,
        },
      }
    })

    return jsonResponse({
      data: mappedResults,
      query,
      count: mappedResults.length,
    })
  } catch (error) {
    console.error('Error searching apps:', error)
    return errorResponse('Failed to search apps', 500)
  }
}
