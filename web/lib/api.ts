/**
 * OpenSource-Hub API 客户端
 *
 * 数据流架构：
 * - 开发环境：直接 fetch 本地 Workers API (localhost:8787)
 * - 生产环境：直接 fetch API Worker 公网 URL
 *
 * TODO: 在 CF Pages Dashboard 配置 Service Binding 后，可改为内网直连
 */

// API 基础 URL
// 生产环境：直接请求 API Worker 公网 URL
// 开发环境：请求本地 Workers API
// TODO: 在 CF Pages Dashboard 配置 Service Binding 后，可改为内网直连
const API_BASE = process.env.NEXT_PUBLIC_API_URL || (process.env.NODE_ENV === 'production'
  ? 'https://opensource-hub-api.358042175.workers.dev'
  : 'http://localhost:8787')

// 请求超时时间
const TIMEOUT = 30000

// ==========================================
// 类型定义
// ==========================================

// ---------- 前端展示层类型 (对应 data.ts 旧类型) ----------

export interface Category {
  id: string
  label: string
  description: string
  emoji: string
  keywords: string[]
  color: string
  projectCount?: number
}

export interface Project {
  id: string
  name: string
  humanTitle: string
  description: string
  longDescription: string
  stars: number
  category: string
  categoryLabel: string
  verified: boolean
  features: string[]
  gettingStarted: string[]
  uninstallNote: string
  dependsOn?: string
  platforms: {
    windows?: { url: string; version: string; size: string }
    mac?: { url: string; version: string; size: string }
    linux?: { url: string; version: string; size: string }
  }
  checksum: string
  sourceUrl: string
  lastUpdated: string
  securityScan: "passed" | "pending" | "failed"
  license?: string
  docsUrl?: string
  homepage?: string
  starGrowth24h?: number
  starGrowthWeek?: number
  sparklineData?: number[]
  trendingScore?: number
  allTimeRank?: number
  controversy?: boolean
  hasIssues?: boolean
  tags?: string[]
}

// ---------- API 层类型 (D1 数据库返回) ----------

export interface App {
  id: string
  name: string
  slug: string
  description: string
  category: string
  category_name?: string
  tags: string | string[]
  github_url: string
  license: string
  homepage_url: string | null
  stars_count: number
  last_updated: string
  versions?: AppVersion[]
  ai_content?: AIContent
  security?: SecurityInfo
}

export interface AppVersion {
  id: string
  version: string
  os_type: string
  arch: string
  file_type: string
  file_name: string
  file_size: number
  download_url: string
  release_date: string
  is_stable: number
}

export interface AIContent {
  id: string
  summary: string
  what_it_does: string
  what_it_cant_do: string
  use_cases: string | string[]
  quick_start_guide: string
  is_portable: number
  requirements: string
  uninstall_guide: string
  has_registry_residual: number
  confidence_score: number
}

export interface SecurityInfo {
  id: string
  sha256: string | null
  virustotal_url: string | null
  virustotal_score: number | null
  audit_status: string
}

export interface ApiCategory {
  id: string
  name: string
  slug: string
  description: string
  icon: string
  app_count: number
}

export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T
  pagination?: {
    limit: number
    offset: number
    hasMore: boolean
  }
}

export interface HomeData {
  featured: App[]
  categories: ApiCategory[]
  trending: App[]
  newArrivals: App[]
}

// ==========================================
// 工具函数
// ==========================================

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeout = TIMEOUT): Promise<Response> {
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

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`
  
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

// ==========================================
// API 方法
// ==========================================

/**
 * 获取首页数据
 */
export async function getHomeData(): Promise<HomeData> {
  return apiRequest<HomeData>('/api/home')
}

/**
 * 获取应用列表
 */
export async function getApps(params?: {
  category?: string
  limit?: number
  offset?: number
  featured?: boolean
  q?: string
}): Promise<PaginatedResponse<App[]>> {
  const searchParams = new URLSearchParams()
  
  if (params?.category) searchParams.set('category', params.category)
  if (params?.limit) searchParams.set('limit', params.limit.toString())
  if (params?.offset) searchParams.set('offset', params.offset.toString())
  if (params?.featured) searchParams.set('featured', 'true')
  if (params?.q) searchParams.set('q', params.q)
  
  const query = searchParams.toString()
  return apiRequest<PaginatedResponse<App[]>>(`/api/apps${query ? `?${query}` : ''}`)
}

/**
 * 获取应用详情
 */
export async function getApp(id: string): Promise<App> {
  return apiRequest<App>(`/api/apps/${id}`)
}

/**
 * 获取分类列表
 */
export async function getCategories(): Promise<ApiCategory[]> {
  const response = await apiRequest<{ data: ApiCategory[] }>('/api/categories')
  return response.data
}

/**
 * 获取热门应用
 */
export async function getTrending(period: 'day' | 'week' | 'alltime' = 'week', limit = 10): Promise<App[]> {
  const response = await apiRequest<{ data: App[] }>(`/api/trending?period=${period}&limit=${limit}`)
  return response.data
}

/**
 * 搜索应用
 */
export async function searchApps(query: string, limit = 20): Promise<{ data: App[]; count: number }> {
  return apiRequest<{ data: App[]; count: number }>(`/api/search?q=${encodeURIComponent(query)}&limit=${limit}`)
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
  return apiRequest('/api/health')
}

// ==========================================
// 数据转换辅助函数
// ==========================================

/**
 * 将 API 返回的应用数据转换为前端组件需要的格式
 */
export function transformAppForDisplay(app: App) {
  const versions = app.versions || []
  
  // 按操作系统分组版本
  const platforms: Record<string, { url: string; version: string; size: string }> = {}
  
  for (const ver of versions) {
    const key = ver.os_type === 'macos' ? 'mac' : ver.os_type
    if (!platforms[key]) {
      platforms[key] = {
        url: ver.download_url,
        version: ver.version,
        size: formatFileSize(ver.file_size),
      }
    }
  }

  // 解析 AI 内容
  const aiContent = app.ai_content
  const features = aiContent?.what_it_does
    ? aiContent.what_it_does.split('\n').filter(line => line.startsWith('-')).map(line => line.slice(2).trim())
    : []
  
  const gettingStarted = aiContent?.quick_start_guide
    ? aiContent.quick_start_guide.split('\n').filter(line => /^\d+\./.test(line)).map(line => line.replace(/^\d+\.\s*/, ''))
    : []

  // 解析标签
  let tags: string[] = []
  try {
    if (typeof app.tags === 'string') {
      tags = JSON.parse(app.tags)
    } else if (Array.isArray(app.tags)) {
      tags = app.tags
    }
  } catch {
    tags = []
  }

  return {
    id: app.slug || app.id,
    name: app.name,
    humanTitle: `${app.name} — ${app.description?.slice(0, 30) || '开源工具'}`,
    description: app.description,
    longDescription: app.description,
    stars: app.stars_count,
    category: app.category || 'system',
    categoryLabel: app.category_name || app.category || '系统调教',
    verified: true,
    features: features.slice(0, 5),
    gettingStarted: gettingStarted.slice(0, 3),
    uninstallNote: aiContent?.uninstall_guide?.split('\n')[0] || '卸载干净，不留系统痕迹',
    dependsOn: undefined,
    platforms,
    checksum: app.security?.sha256 || 'sha256:pending',
    sourceUrl: app.github_url,
    lastUpdated: app.last_updated?.split('T')[0] || '',
    securityScan: (app.security?.audit_status as 'passed' | 'pending' | 'failed') || 'pending',
    tags,
    trendingScore: Math.min(Math.floor(app.stars_count / 1000), 100),
    // 以下字段兼容 data.ts 的 Project 类型
    license: app.license || undefined,
    homepage: app.homepage_url || undefined,
  }
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

/**
 * 将 API 分类转换为前端分类格式
 */
export function transformCategoryForDisplay(category: ApiCategory) {
  const colorMap: Record<string, string> = {
    'system': 'from-slate-500 to-zinc-600',
    'ai': 'from-violet-500 to-purple-600',
    'video': 'from-red-500 to-orange-500',
    'clean-install': 'from-blue-500 to-cyan-500',
    'dev-tools': 'from-emerald-500 to-teal-600',
    'privacy': 'from-green-500 to-emerald-600',
    'file-management': 'from-pink-500 to-rose-500',
    'office': 'from-indigo-500 to-blue-600',
    'design': 'from-fuchsia-500 to-pink-600',
  }

  const iconMap: Record<string, string> = {
    'system': 'settings',
    'ai': 'sparkles',
    'video': 'play',
    'clean-install': 'monitor',
    'dev-tools': 'code',
    'privacy': 'lock',
    'file-management': 'folder',
    'office': 'file-text',
    'design': 'palette',
  }

  return {
    id: category.slug,
    label: category.name,
    description: category.description,
    emoji: iconMap[category.slug] || 'star',
    keywords: [category.name, category.description],
    color: colorMap[category.slug] || 'from-gray-500 to-slate-600',
    projectCount: category.app_count,
  }
}
