/**
 * 搜索路由 — FTS5 Trigram 主搜索 + LIKE 回退 + Vectorize 语义补充
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

function isMultiWord(q: string): boolean {
  return q.includes(' ') || q.length > 15  // 空格分词或超长字符串
}

async function ftsSearchApps(db: D1Database, query: string, lang: string, limit: number): Promise<any[]> {
  // FTS5 trigram: 仅单 token 使用（不按空格分词），多词走 LIKE
  if (isMultiWord(query)) return []
  try {
    const { results } = await db.prepare(`
      SELECT a.id, a.name, a.slug, a.description, a.full_description, a.category, a.tags,
             a.github_url, a.license, a.stars_count, a.last_updated,
             c.name as category_name, ${TRANSLATION_SELECT}
      FROM apps a
      JOIN apps_search_idx f ON a.id = f.app_id
      LEFT JOIN categories c ON a.category = c.slug
      ${TRANSLATION_JOIN}
      WHERE a.status = 'active' AND apps_search_idx MATCH ?
      ORDER BY rank LIMIT ?
    `).bind(lang, query, limit).all()
    return (results || [])
  } catch {
    return []  // FTS5 查询失败时返回空
  }
}

async function ftsSearchLibs(db: D1Database, query: string, lang: string): Promise<any[]> {
  if (isMultiWord(query)) return []
  try {
    const { results } = await db.prepare(`
      SELECT l.id, l.github_repo_id, l.slug, l.name, l.full_name,
             l.description, l.summary, l.full_description,
             l.tags, l.language, l.project_type, l.category,
             l.stars_count, l.html_url, l.homepage, l.license, l.last_updated, l.status,
             c.name as category_name,
             t_req.summary as trans_summary_req, t_req.full_description as trans_full_description_req,
             t_zh.summary as trans_summary_zh, t_zh.full_description as trans_full_description_zh
      FROM apps_library l
      JOIN libs_search_idx f ON CAST(l.github_repo_id AS TEXT) = f.lib_id
      LEFT JOIN categories c ON l.category = c.slug
      LEFT JOIN apps_library_translations t_req ON t_req.library_id = l.id AND t_req.locale = ?
      LEFT JOIN apps_library_translations t_zh ON t_zh.library_id = l.id AND t_zh.locale = 'zh'
      WHERE l.status = 'active' AND libs_search_idx MATCH ?
      ORDER BY rank LIMIT 10
    `).bind(lang, query).all()
    return ((results || []) as any[]).map(normalizeLibraryResult)
  } catch {
    return []
  }
}

function normalizeLibraryResult(r: any) {
  const hasReq = r.trans_summary_req !== null || r.trans_full_description_req !== null
  return {
    ...r, _source: 'library' as const,
    summary: hasReq ? (r.trans_summary_req || r.summary) : (r.trans_summary_zh || r.summary),
    full_description: hasReq ? (r.trans_full_description_req || r.full_description) : (r.trans_full_description_zh || r.full_description),
    trans_summary_req: undefined, trans_summary_zh: undefined,
    trans_full_description_req: undefined, trans_full_description_zh: undefined,
  }
}

function likeSearchApps(db: D1Database, query: string, lang: string, limit: number, excludeIds: Set<string>): Promise<any[]> {
  const pattern = `%${query}%`
  // 排除 FTS5 已命中项
  const excludeClause = excludeIds.size > 0
    ? `AND a.id NOT IN (${[...excludeIds].map(() => '?').join(',')})`
    : ''
  const binds: any[] = [lang]
  for (let i = 0; i < 10; i++) binds.push(pattern)
  binds.push(query, pattern, pattern)
  excludeIds.forEach(id => binds.push(id))
  binds.push(limit)

  return db.prepare(`
    SELECT a.id, a.name, a.slug, a.description, a.full_description, a.category, a.tags,
           a.github_url, a.license, a.stars_count, a.last_updated,
           c.name as category_name, ${TRANSLATION_SELECT}
    FROM apps a
    LEFT JOIN categories c ON a.category = c.slug
    ${TRANSLATION_JOIN}
    WHERE a.status = 'active' ${excludeClause}
      AND (a.name LIKE ? COLLATE NOCASE OR a.description LIKE ? COLLATE NOCASE
           OR a.full_description LIKE ? COLLATE NOCASE OR a.tags LIKE ? COLLATE NOCASE
           OR t_req.description LIKE ? COLLATE NOCASE OR t_req.full_description LIKE ? COLLATE NOCASE
           OR t_req.summary LIKE ? COLLATE NOCASE
           OR t_zh.description LIKE ? COLLATE NOCASE OR t_zh.full_description LIKE ? COLLATE NOCASE
           OR t_zh.summary LIKE ? COLLATE NOCASE OR c.name LIKE ? COLLATE NOCASE)
    ORDER BY CASE WHEN a.name = ? COLLATE NOCASE THEN 0
             WHEN a.name LIKE ? COLLATE NOCASE THEN 1
             WHEN a.tags LIKE ? COLLATE NOCASE THEN 2 ELSE 3 END,
    a.stars_count DESC LIMIT ?
  `).bind(...binds).all<any>().then(r => r.results || [])
}

async function vectorSearchApps(env: Env, db: D1Database, query: string, lang: string, excludeIds: Set<string>): Promise<any[]> {
  if (!env.VECTORIZE || !env.AI) return []
  try {
    const embResult = await env.AI.run('@cf/baai/bge-small-en-v1.5', { text: [query] }) as { data: number[][] }
    const qv = embResult.data?.[0]
    if (!qv || qv.length === 0) return []

    const vecMatches = await env.VECTORIZE.query(qv, { topK: 10, returnMetadata: false })
    const ids = (vecMatches.matches || []).map((m: { id: string }) => m.id).filter(Boolean)
    const newIds = ids.filter(id => id.startsWith('app_') && !excludeIds.has(id))
    if (newIds.length === 0) return []

    const ph = newIds.map(() => '?').join(',')
    const { results } = await db.prepare(`
      SELECT a.id, a.name, a.slug, a.description, a.full_description, a.category, a.tags,
             a.github_url, a.license, a.stars_count, a.last_updated,
             c.name as category_name, ${TRANSLATION_SELECT}
      FROM apps a LEFT JOIN categories c ON a.category = c.slug
      ${TRANSLATION_JOIN}
      WHERE a.status = 'active' AND a.id IN (${ph})
    `).bind(lang, ...newIds).all()
    return (results || [])
  } catch { return [] }
}

export async function searchApps(db: D1Database, params: URLSearchParams, env: Env): Promise<Response> {
  const query = params.get('q')
  const limit = Math.min(parseInt(params.get('limit') || '20'), 50)
  const lang = params.get('lang') || 'zh'

  if (!query || query.trim().length < 2) {
    return errorResponse('Search query must be at least 2 characters', 400)
  }

  try {
    // 1. FTS5 主搜索 (apps + library 并发)
    const [ftsApps, ftsLibs] = await Promise.all([
      ftsSearchApps(db, query, lang, limit),
      ftsSearchLibs(db, query, lang),
    ])

    const ftsAppIds = new Set(ftsApps.map((r: any) => r.id))

    // 2. LIKE 回退：FTS5 结果 < 5 时补搜
    let likeApps: any[] = []
    if (ftsApps.length < 5) {
      likeApps = await likeSearchApps(db, query, lang, limit - ftsApps.length, ftsAppIds)
    }

    // 3. Vectorize 语义补充
    const allExistingIds = new Set([...ftsAppIds, ...likeApps.map((r: any) => r.id)])
    const vectorApps = await vectorSearchApps(env, db, query, lang, allExistingIds)

    // 4. 合并
    const allResults = [
      ...ftsApps.map((r: any) => ({ ...r, _source: 'app' as const })),
      ...ftsLibs,
      ...likeApps.map((r: any) => ({ ...r, _source: 'app' as const })),
      ...vectorApps.map((r: any) => ({ ...r, _source: 'app' as const })),
    ]

    // 5. 记录搜索分析
    await db.prepare(`
      INSERT INTO search_analytics (id, search_query, result_count, has_results, search_count, last_searched)
      VALUES (lower(hex(randomblob(16))), ?, ?, ?, 1, datetime('now'))
      ON CONFLICT(search_query) DO UPDATE SET
        result_count = excluded.result_count, has_results = excluded.has_results,
        search_count = search_count + 1, last_searched = datetime('now')
    `).bind(query, allResults.length, allResults.length > 0 ? 1 : 0).run()

    // 6. 格式化输出
    return jsonResponse({
      data: allResults.map((item: any) => {
        if (item._source === 'library') {
          return { ...item, description: item.summary || item.description }
        }
        return {
          ...item,
          description: item.trans_desc || item.description,
          full_description: item.trans_full_desc || item.full_description,
          ai_content: { summary: item.summary, features: item.features, use_cases: item.use_cases, quick_start_guide: item.quick_start_guide, uninstall_guide: item.uninstall_guide, caveats: item.caveats },
        }
      }),
      query, count: allResults.length,
    })
  } catch (error) {
    console.error('Error searching apps:', error)
    return errorResponse('Failed to search apps', 500)
  }
}
