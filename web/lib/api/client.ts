/**
 * API 客户端网络层
 * 
 * 数据流架构：
 * - 开发环境：直接 fetch 本地 Workers API (localhost:8787)
 * - 生产环境：通过 /api/proxy → Service Binding 内网直连 API Worker
 */

// API 基础 URL
// 生产环境客户端：走代理路由 /api/proxy?path=，由 Edge Runtime 通过 Service Binding 内网转发
// 生产环境 SSR：优先用 NEXT_PUBLIC_API_URL 直连（如有），否则也走代理
// 开发环境：直接请求本地 Workers API
function buildApiUrl(path: string, params?: Record<string,string>): string {
  const isServer = typeof window === 'undefined'
  if (process.env.NODE_ENV === 'production') {
    if (!isServer || !process.env.NEXT_PUBLIC_API_URL) {
      const sp = new URLSearchParams({ path })
      if (params) Object.entries(params).forEach(([k,v]) => sp.set(k, String(v)))
      return `/api/proxy?${sp.toString()}`
    }
  }
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
  const qs = params ? '?' + new URLSearchParams(params).toString() : ''
  return `${base}${path}${qs}`
}

// 请求超时时间
const TIMEOUT = 30000

/**
 * 带超时的 fetch 封装
 */
export async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = TIMEOUT): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    throw error
  }
}

/**
 * 通用 API 请求函数
 */
export async function apiRequest<T>(path: string, params?: Record<string,string>, options: RequestInit = {}): Promise<T> {
  const url = buildApiUrl(path, params)
  
  try {
    const response = await fetchWithTimeout(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`API request failed: ${url}`, error)
    throw error
  }
}
