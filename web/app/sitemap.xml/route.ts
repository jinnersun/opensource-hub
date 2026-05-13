import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const cloudflareContext = (globalThis as any)[Symbol.for("__cloudflare-context__")]
    const apiBinding = cloudflareContext?.env?.API
    if (apiBinding && typeof apiBinding.fetch === 'function') {
      const resp = await apiBinding.fetch(new Request('http://internal/api/sitemap'))
      const xml = await resp.text()
      return new Response(xml, {
        headers: { 'Content-Type': 'application/xml', 'Cache-Control': 'public, max-age=3600' },
      })
    }
  } catch { /* fallback */ }
  // 开发环境：直接返回空 sitemap
  return new Response(
    '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>',
    { headers: { 'Content-Type': 'application/xml' } },
  )
}
