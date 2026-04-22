import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = 'edge'

/**
 * API 代理路由 (catch-all)
 * 将 /api/proxy/{path} 转发到 API Worker
 *
 * Cloudflare Pages 生产环境：通过 Service Binding 内网直连
 * 开发环境：fallback 到 localhost:8787
 */
async function proxyHandler(request: Request) {
  const url = new URL(request.url)

  // 直接从 URL 解析目标 API 路径，不依赖 context.params
  // /api/proxy/api/home?period=week → /api/home?period=week
  const apiPath = url.pathname.replace(/^\/api\/proxy/, '') + url.search

  try {
    let response: Response

    // 优先尝试 Service Binding 内网直连
    try {
      const { env } = getCloudflareContext()
      const apiBinding = (env as any).API
      if (apiBinding && typeof apiBinding.fetch === 'function') {
        const apiRequest = new Request(`http://internal${apiPath}`, {
          method: request.method,
          headers: {
            'Content-Type': 'application/json',
          },
        })
        response = await apiBinding.fetch(apiRequest)
      } else {
        throw new Error('Service binding not available')
      }
    } catch (sbErr: any) {
      // Fallback: 开发环境直连本地 API Worker
      console.warn('Service Binding failed:', sbErr?.message || sbErr)
      const devUrl = `http://localhost:8787${apiPath}`
      response = await fetch(devUrl, {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60',
      },
    })
  } catch (error: any) {
    console.error('API proxy error:', error)
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(request: Request) {
  return proxyHandler(request)
}

export async function POST(request: Request) {
  return proxyHandler(request)
}
