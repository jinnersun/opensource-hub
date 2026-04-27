/**
 * OpenSource-Hub API 客户端
 *
 * 数据流架构：
 * - 开发环境：直接 fetch 本地 Workers API (localhost:8787)
 * - 生产环境：通过 /api/proxy → Service Binding 内网直连 API Worker
 */

// API 基础 URL
// 生产环境：走代理路由 /api/proxy?path=，由 Edge Runtime 通过 Service Binding 内网转发
// 开发环境：直接请求本地 Workers API
function buildApiUrl(endpoint: string): string {
  if (process.env.NODE_ENV === 'production' && !process.env.NEXT_PUBLIC_API_URL) {
    return `/api/proxy?path=${encodeURIComponent(endpoint)}`
  }
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
  return `${base}${endpoint}`
}

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
  dependencies?: { name: string; url?: string }[]  // ENHANCE-02: 依赖详情（含下载链接）
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
  // AI 内容字段
  summary: string                           // 一句话白话总结
  caveats: string[]                         // 避坑指南
  useCases: string[]                        // 适用场景
  isPortable: boolean                       // 绿色版标识
  latestReleaseNotes: string                // 最新更新说明
  // 安全信息
  virustotalUrl?: string
  virustotalScore?: number
  // 趋势/排行
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
  requirement_links?: string   // JSON: [{ name: string, url?: string }]
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
  color?: string          // DB categories.color
  lucide_icon?: string   // DB categories.lucide_icon
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
  const url = buildApiUrl(endpoint)
  
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

  // 解析避坑指南 (what_it_cant_do)
  const caveats = aiContent?.what_it_cant_do
    ? aiContent.what_it_cant_do.split('\n').filter(line => line.startsWith('-')).map(line => line.slice(2).trim())
    : []

  // 解析适用场景 (use_cases)
  let useCases: string[] = []
  if (aiContent?.use_cases) {
    if (Array.isArray(aiContent.use_cases)) {
      useCases = aiContent.use_cases
    } else if (typeof aiContent.use_cases === 'string') {
      try {
        const parsed = JSON.parse(aiContent.use_cases)
        useCases = Array.isArray(parsed) ? parsed : []
      } catch {
        useCases = (aiContent.use_cases as string).split('\n').filter((l: string) => l.trim()).map((l: string) => l.replace(/^[-*]\s*/, '').trim())
      }
    }
  }

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
    longDescription: (app as any).full_description || app.description,
    stars: app.stars_count,
    category: app.category || 'system',
    categoryLabel: app.category_name || app.category || '系统调教',
    verified: true,
    features: features.slice(0, 5),
    gettingStarted: gettingStarted.slice(0, 3),
    uninstallNote: aiContent?.uninstall_guide?.split('\n')[0] || '卸载干净，不留系统痕迹',
    dependsOn: aiContent?.requirements
      ? extractFirstDependency(aiContent.requirements)
      : undefined,
    dependencies: parseDependencyLinks(aiContent?.requirement_links),
    // AI 内容字段
    summary: aiContent?.summary || '',
    caveats,
    useCases,
    isPortable: !!aiContent?.is_portable,
    latestReleaseNotes: (app.versions && app.versions.length > 0)
      ? (app.versions[0] as any).release_notes || ''
      : '',
    // 安全信息
    virustotalUrl: app.security?.virustotal_url || undefined,
    virustotalScore: app.security?.virustotal_score ?? undefined,
    // 必填字段补全
    platforms,
    checksum: app.security?.sha256 || '—',
    sourceUrl: app.github_url || '',
    lastUpdated: app.last_updated || '',
    securityScan: (app.security?.audit_status === 'passed' ? 'passed' : (app.security?.audit_status === 'pending' ? 'pending' : 'passed')) as 'passed' | 'pending' | 'failed',
    // 兼容字段
    docsUrl: (app as any).documentation_url || undefined,
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
 * 从 ai_content.requirements 提取第一个依赖项
 * requirements 可能是纯文本（"需要 .NET 6 运行时"）或 JSON 数组
 */
function extractFirstDependency(requirements: string): string | undefined {
  try {
    // 尝试 JSON 解析
    const parsed = JSON.parse(requirements)
    if (Array.isArray(parsed) && parsed.length > 0) {
      const first = parsed[0]
      return typeof first === 'string' ? first : first.name || String(first)
    }
  } catch {
    // 不是 JSON，按纯文本处理
  }
  // 取第一行非空文本
  const firstLine = requirements.split('\n').map(l => l.replace(/^[-*]\s*/, '').trim()).find(l => l.length > 0)
  return firstLine || undefined
}

/**
 * 解析 ai_content.requirement_links 为依赖详情数组
 * requirement_links 格式: JSON 数组 [{ name: string, url?: string }]
 */
function parseDependencyLinks(requirementLinks?: string): { name: string; url?: string }[] | undefined {
  if (!requirementLinks) return undefined
  try {
    const parsed = JSON.parse(requirementLinks)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.filter((item: any) => item && item.name).map((item: any) => ({
        name: String(item.name),
        url: item.url ? String(item.url) : undefined,
      }))
    }
  } catch {
    // not valid JSON
  }
  return undefined
}

/**
 * 将 API 分类转换为前端分类格式
 */
export function transformCategoryForDisplay(category: ApiCategory) {
  return {
    id: category.slug,
    label: category.name,
    description: category.description,
    emoji: category.lucide_icon || category.icon || 'star',
    keywords: [category.name, category.description],
    color: category.color || 'from-gray-500 to-slate-600',
    projectCount: category.app_count,
  }
}
