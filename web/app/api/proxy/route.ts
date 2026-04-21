export const runtime = 'edge'

/**
 * API 代理路由
 * 在 Cloudflare Workers 上：通过 Service Binding 内网直连 API Worker
 * 在开发环境：直接 fetch 本地 API Worker
 * 
 * Service Binding 获取方式：
 * OpenNext for Cloudflare 将 wrangler.toml 的 bindings 注入到 globalThis.__OPENNEXT_API__
 * 或通过 cloudflare:workers 模块（仅在 CF runtime 可用）
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
    // OpenNext for Cloudflare 将 env 挂载在 globalThis.__cloudflare_env__
    let apiBinding: any = null
    try {
      // 方式 1: 通过 globalThis 获取（OpenNext 运行时注入）
      const cfEnv = (globalThis as any).__cloudflare_env__
      if (cfEnv?.API) {
        apiBinding = cfEnv.API
      }
    } catch {}

    try {
      // 方式 2: 通过 cloudflare:workers 模块获取
      if (!apiBinding) {
        // @ts-ignore
        const { env } = await import('cloudflare:workers')
        if (env?.API) {
          apiBinding = env.API
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
