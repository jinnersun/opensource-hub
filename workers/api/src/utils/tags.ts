/**
 * 标签处理工具函数
 */

// 标签 slug 化：处理 URL 非法字符（空格、斜杠、加号等）
export function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿぀-ゟ゠-ヿ가-힯]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

// 共享函数：从 apps + apps_library 提取并去重所有 tags，返回 slug → original 映射
export async function extractTags(db: D1Database): Promise<Map<string, string>> {
  const [appsRes, libsRes] = await Promise.all([
    db.prepare(`SELECT DISTINCT tags FROM apps WHERE status = 'active' AND tags IS NOT NULL`).all<{ tags: string }>(),
    db.prepare(`SELECT DISTINCT tags FROM apps_library WHERE status = 'active' AND tags IS NOT NULL`).all<{ tags: string }>(),
  ])
  const tagMap = new Map<string, string>() // slug → original
  for (const res of [appsRes, libsRes]) {
    for (const row of res.results || []) {
      try {
        const parsed = JSON.parse(row.tags)
        if (Array.isArray(parsed)) {
          for (const t of parsed) {
            const tag = String(t).trim()
            if (!tag) continue
            const slug = slugifyTag(tag)
            if (slug && !tagMap.has(slug)) tagMap.set(slug, tag)
          }
        }
      } catch { /* skip malformed JSON */ }
    }
  }
  return tagMap
}
