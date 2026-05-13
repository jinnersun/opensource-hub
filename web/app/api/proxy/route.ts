/**
 * API 代理路由
 * 通过 ?path= 参数转发到 API Worker（支持 GET + POST）
 *
 * Cloudflare Pages 生产环境：通过 Service Binding 内网直连
 * 开发环境：fallback 到 localhost:8787
 */

async function forward(request: Request, method: string, body?: string) {
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

    console.log('[API Proxy] apiPath:', apiPath)
    console.log('[API Proxy] method:', method)

    try {
      const cloudflareContext = (globalThis as any)[Symbol.for("__cloudflare-context__")]
      const apiBinding = cloudflareContext?.env?.API
      if (apiBinding && typeof apiBinding.fetch === 'function') {
        const init: RequestInit = {
          method,
          headers: { 'Content-Type': 'application/json' },
        }
        if (body) init.body = body
        // 转发 Authorization 头（admin 鉴权需要）
        const auth = request.headers.get('Authorization')
        if (auth) (init.headers as Record<string,string>)['Authorization'] = auth
        const apiRequest = new Request(`http://internal${apiPath}`, init)
        console.log('[API Proxy] Service Binding request URL:', apiRequest.url)
        response = await apiBinding.fetch(apiRequest)
      } else {
        throw new Error(`Service binding not available`)
      }
    } catch (sbErr: any) {
      console.warn('[API Proxy] Service Binding failed:', sbErr?.message || sbErr)
      const devUrl = `http://localhost:8787${apiPath}`
      console.log('[API Proxy] Dev fallback URL:', devUrl)
      const devInit: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
      if (body) devInit.body = body
      const devAuth = request.headers.get('Authorization')
      if (devAuth) (devInit.headers as Record<string,string>)['Authorization'] = devAuth
      response = await fetch(devUrl, devInit)
    }

    const data = await response.text()
    return new Response(data, {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': apiPath.startsWith('/admin/') ? 'no-store' : 'public, max-age=60',
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
  return forward(request, 'GET')
}

export async function POST(request: Request) {
  const body = await request.text().catch(() => undefined)
  return forward(request, 'POST', body)
}
