export const runtime = 'edge'

/**
 * API 代理路由
 * 在 Cloudflare Workers 上：通过 Service Binding 内网直连 API Worker
 * 在开发环境：直接 fetch 本地 API Worker
 * 
 * Service Binding 获取方式：
 * OpenNext for Cloudflare 通过 getCloudflareContext() 获取 env
 * env 存储在 globalThis[Symbol.for('__cloudflare-context__')] 的 AsyncLocalStorage 中
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

    // 尝试获取 Cloudflare Worker env（Service Binding）
    let apiBinding: any = null
    try {
      // OpenNext for Cloudflare: 通过 getCloudflareContext 获取 env
      const { getCloudflareContext } = await import('@opennextjs/cloudflare')
      const ctx = getCloudflareContext() as any
      if (ctx?.env?.API) {
        apiBinding = ctx.env.API
      }
    } catch {}

    try {
      // 备用方式: 通过 AsyncLocalStorage 直接读取
      if (!apiBinding) {
        const contextSymbol = Symbol.for('__cloudflare-context__')
        const cfContext = (globalThis as any)[contextSymbol]
        if (cfContext?.env?.API) {
          apiBinding = cfContext.env.API
        }
      }
    } catch {}

    if (apiBinding && typeof apiBinding.fetch === 'function') {
      // 生产环境：走 Service Binding 内网直连
      const apiRequest = new Request(`http://internal${apiPath}`, {
        method: 'GET',
        headers: request.headers,
      })
      response = await apiBinding.fetch(apiRequest)
    } else {
      // 开发环境：直接 fetch 本地 Workers API
      const devApiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
      const devUrl = `${devApiBase}${apiPath}`
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
