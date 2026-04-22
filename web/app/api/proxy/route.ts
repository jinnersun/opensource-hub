export const runtime = 'edge'

/**
 * API 代理路由
 * 通过 ?path= 参数转发到 API Worker
 *
 * Cloudflare Pages 生产环境：通过 Service Binding 内网直连
 * 开发环境：fallback 到 localhost:8787
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

    // 优先尝试 Service Binding 内网直连
    try {
      const cloudflareContext = (globalThis as any)[Symbol.for("__cloudflare-context__")]
      const apiBinding = cloudflareContext?.env?.API
      if (apiBinding && typeof apiBinding.fetch === 'function') {
        const apiRequest = new Request(`http://internal${apiPath}`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        })
        response = await apiBinding.fetch(apiRequest)
      } else {
        throw new Error(`Service binding not available, context=${typeof cloudflareContext}, api=${typeof apiBinding}`)
      }
    } catch (sbErr: any) {
      // Fallback: 开发环境直连本地 API Worker
      console.warn('Service Binding failed:', sbErr?.message || sbErr)
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
