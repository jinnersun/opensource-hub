import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = 'edge'

/**
 * API 代理路由
 * 在 Cloudflare Workers 上：通过 Service Binding 内网直连 API Worker
 * 在开发环境：直接 fetch 本地 API Worker
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const apiPath = url.searchParams.get('path')
  
  if (!apiPath) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    let response: Response

    // 尝试通过 Service Binding 内网直连 API Worker
    try {
      const { env } = getCloudflareContext()
      const apiBinding = (env as any).API
      if (apiBinding && typeof apiBinding.fetch === 'function') {
        const apiRequest = new Request(`http://internal${apiPath}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        response = await apiBinding.fetch(apiRequest)
      } else {
        // 开发环境：直接 fetch 本地 Workers API
        const devUrl = `http://localhost:8787${apiPath}`
        response = await fetch(devUrl, {
          headers: { 'Content-Type': 'application/json' },
        })
      }
    } catch {
      // Service Binding 不可用（开发环境或未配置），fallback 到直连
      const devUrl = `http://localhost:8787${apiPath}`
      response = await fetch(devUrl, {
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
