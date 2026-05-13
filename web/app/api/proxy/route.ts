/**
 * API 代理路由 — 把浏览器请求转发到 API Worker (Service Binding)
 * 用法: /api/proxy?path=/api/home&lang=zh&other=...
 *   path 是 API 路径，其余参数原样转发到 API Worker 的 query string
 */

async function forward(request: Request, method: string, body?: string) {
  const url = new URL(request.url)
  const apiPath = url.searchParams.get('path')

  if (!apiPath) {
    return new Response(JSON.stringify({ error: 'Missing path parameter' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  }

  // 收集除 path 外的所有参数，拼回 API Worker 的 query string
  const apiParams = new URLSearchParams()
  url.searchParams.forEach((v, k) => { if (k !== 'path') apiParams.set(k, v) })
  const apiQS = apiParams.toString()
  const apiUrl = `http://internal${apiPath}${apiQS ? '?' + apiQS : ''}`

  try {
    let response: Response
    try {
      const cloudflareContext = (globalThis as any)[Symbol.for("__cloudflare-context__")]
      const apiBinding = cloudflareContext?.env?.API
      if (apiBinding && typeof apiBinding.fetch === 'function') {
        const init: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
        if (body) init.body = body
        const auth = request.headers.get('Authorization')
        if (auth) (init.headers as Record<string,string>)['Authorization'] = auth
        response = await apiBinding.fetch(new Request(apiUrl, init))
      } else {
        throw new Error('Service binding not available')
      }
    } catch (sbErr: any) {
      console.warn('Service Binding failed:', sbErr?.message || sbErr)
      const devUrl = `http://localhost:8787${apiPath}${apiQS ? '?' + apiQS : ''}`
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
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function GET(request: Request) { return forward(request, 'GET') }
export async function POST(request: Request) {
  const body = await request.text().catch(() => undefined)
  return forward(request, 'POST', body)
}
