export interface Env {
  DB: D1Database
  VECTORIZE?: VectorizeIndex
  AI?: Ai
  ADMIN_TOKEN?: string
  TRIGGER_TOKEN?: string
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
}

export function jsonResponse(data: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
      ...extraHeaders,
    },
  })
}

export function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status)
}

function slugifyTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿぀-ゟ゠-ヿ가-힯]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
}

export async function extractTags(db: D1Database): Promise<Map<string, string>> {
  const [appsRes, libsRes] = await Promise.all([
    db.prepare(`SELECT DISTINCT tags FROM apps WHERE status = 'active' AND tags IS NOT NULL`).all<{ tags: string }>(),
    db.prepare(`SELECT DISTINCT tags FROM apps_library WHERE status = 'active' AND tags IS NOT NULL`).all<{ tags: string }>(),
  ])
  const tagMap = new Map<string, string>()
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

export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}
