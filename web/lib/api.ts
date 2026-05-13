/**
 * OpenSource-Hub API 客户端
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
    windows?: { url: string; version: string; size: string; sha256?: string | null }
    mac?: { url: string; version: string; size: string; sha256?: string | null }
    linux?: { url: string; version: string; size: string; sha256?: string | null }
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
  sha256?: string | null
  release_date: string
  is_stable: number
}

export interface AIContent {
  id?: string
  summary: string
  // 来自 app_translations.features（JSON 数组字符串）或旧 app_ai_content.what_it_does
  features?: string | string[]
  what_it_does?: string
  // 来自 app_translations.caveats（数组或字符串）或旧 app_ai_content.what_it_cant_do
  caveats?: string | string[]
  what_it_cant_do?: string
  use_cases: string | string[]
  quick_start_guide: string | string[]
  is_portable?: number
  requirements?: string
  requirement_links?: string   // JSON: [{ name: string, url?: string }]
  uninstall_guide: string
  has_registry_residual?: number
  confidence_score?: number
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

async function apiRequest<T>(path: string, params?: Record<string,string>, options: RequestInit = {}): Promise<T> {
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

// ==========================================
// API 方法
// ==========================================

/**
 * 获取首页数据
 */
export async function getHomeData(locale?: string): Promise<HomeData> {
  return apiRequest<HomeData>('/api/home', locale ? { lang: locale } : undefined)
}

/**
 * 获取应用列表
 */
export async function getApps(params?: {
  category?: string; limit?: number; offset?: number; featured?: boolean; q?: string; locale?: string
}): Promise<PaginatedResponse<App[]>> {
  const sp: Record<string,string> = {}
  if (params?.category) sp.category = params.category
  if (params?.limit) sp.limit = String(params.limit)
  if (params?.offset) sp.offset = String(params.offset)
  if (params?.featured) sp.featured = 'true'
  if (params?.q) sp.q = params.q
  if (params?.locale) sp.lang = params.locale
  return apiRequest<PaginatedResponse<App[]>>('/api/apps', Object.keys(sp).length > 0 ? sp : undefined)
}

/**
 * 获取应用详情
 */
export async function getApp(id: string, locale?: string): Promise<App> {
  return apiRequest<App>(`/api/apps/${id}`, locale ? { lang: locale } : undefined)
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
export async function getTrending(period: 'day' | 'week' | 'alltime' = 'week', limit = 10, locale?: string): Promise<App[]> {
  const p: Record<string,string> = { period, limit: String(limit) }
  if (locale) p.lang = locale
  const response = await apiRequest<{ data: App[] }>('/api/trending', p)
  return response.data
}

/**
 * 搜索应用
 */
export async function searchApps(query: string, limit = 20, locale?: string): Promise<{ data: App[]; count: number }> {
  const p: Record<string,string> = { q: query, limit: String(limit) }
  if (locale) p.lang = locale
  return apiRequest<{ data: App[]; count: number }>('/api/search', p)
}

/**
 * 健康检查
 */
export async function healthCheck(): Promise<{ status: string; timestamp: string; version: string }> {
  return apiRequest('/api/health')
}

// ==========================================
// 代码宝库 (Code Library)
// ==========================================

export interface LibraryItem {
  id: number
  github_repo_id: number
  slug: string
  name: string
  full_name: string
  description: string | null
  summary: string | null
  full_description: string | null
  readme_preview: string | null
  tags: string | null              // JSON array string
  language: string | null
  project_type: 'framework' | 'library' | 'cli-tool' | 'application' | 'tutorial' | 'awesome-list' | 'dataset-model' | 'other'
  category: string | null
  category_name?: string
  stars_count: number
  html_url: string
  homepage: string | null
  license: string | null
  last_updated: string | null
  status: 'active' | 'archived' | 'removed'
}

export interface LibraryFacets {
  projectTypes: { project_type: string; count: number }[]
  languages: { language: string; count: number }[]
}

/**
 * 获取代码宝库列表
 */
export async function getLibrary(params?: {
  projectType?: string
  category?: string
  language?: string
  q?: string
  limit?: number
  offset?: number
  sort?: 'stars' | 'updated'
  locale?: string
}): Promise<PaginatedResponse<LibraryItem[]>> {
  const sp = new URLSearchParams()
  if (params?.projectType) sp.set('project_type', params.projectType)
  if (params?.category) sp.set('category', params.category)
  if (params?.language) sp.set('language', params.language)
  if (params?.q) sp.set('q', params.q)
  if (params?.limit) sp.set('limit', String(params.limit))
  if (params?.offset) sp.set('offset', String(params.offset))
  if (params?.sort) sp.set('sort', params.sort)
  if (params?.locale) sp.set('lang', params.locale)
  const entries = Object.fromEntries(sp.entries())
  return apiRequest<PaginatedResponse<LibraryItem[]>>('/api/library', Object.keys(entries).length > 0 ? entries : undefined)
}

export async function getLibraryItem(idOrSlug: string, locale?: string): Promise<LibraryItem> {
  return apiRequest<LibraryItem>(`/api/library/${idOrSlug}`, locale ? { lang: locale } : undefined)
}

/**
 * 获取代码宝库筛选 facets (project_type / language 分布)
 */
export async function getLibraryFacets(): Promise<LibraryFacets> {
  return apiRequest<LibraryFacets>('/api/library/facets')
}

/**
 * 解析 LibraryItem.tags (JSON 字符串) 为 string[]
 */
export function parseLibraryTags(tags: string | null): string[] {
  if (!tags) return []
  try {
    const arr = JSON.parse(tags)
    return Array.isArray(arr) ? arr.map(t => String(t)) : []
  } catch {
    return []
  }
}

// ==========================================
// 数据转换辅助函数
// ==========================================

/**
 * 把可能是数组 / JSON 字符串数组 / 多行文本的字段统一解析为 string[]
 * 返回 null 表示原值为空（调用方可走 fallback 分支）
 */
function parseStringArray(value: unknown): string[] | null {
  if (value == null || value === '') return null
  if (Array.isArray(value)) {
    const arr = value.map(v => String(v).trim()).filter(Boolean)
    return arr.length ? arr : null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    // 优先尝试 JSON 数组解析
    if (trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) {
          const arr = parsed.map(v => String(v).trim()).filter(Boolean)
          return arr.length ? arr : null
        }
      } catch {
        // 落到换行解析
      }
    }
    // 按换行切分，剥离常见列表前缀（数字./-/*/•）
    const arr = trimmed.split('\n')
      .map(l => l.replace(/^\s*(?:\d+\.|[-*•])\s*/, '').trim())
      .filter(Boolean)
    return arr.length ? arr : null
  }
  return null
}

/**
 * 将 API 返回的应用数据转换为前端组件需要的格式
 */
export function transformAppForDisplay(app: App) {
  const versions = app.versions || []
  
  // 按操作系统分组版本（含 sha256）
  const platforms: Record<string, { url: string; version: string; size: string; sha256?: string | null }> = {}

  for (const ver of versions) {
    const key = ver.os_type === 'macos' ? 'mac' : ver.os_type
    if (!platforms[key]) {
      platforms[key] = {
        url: ver.download_url,
        version: ver.version,
        size: formatFileSize(ver.file_size),
        sha256: ver.sha256 || null,
      }
    }
  }

  // 解析 AI 内容
  const aiContent = app.ai_content

  const features = parseStringArray(aiContent?.features) ??
    (aiContent?.what_it_does
      ? aiContent.what_it_does.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-*•]\s*/, '').trim())
      : [])

  const gettingStarted = parseStringArray(aiContent?.quick_start_guide) ?? []

  const caveats = parseStringArray(aiContent?.caveats) ??
    (aiContent?.what_it_cant_do
      ? aiContent.what_it_cant_do.split('\n').filter(l => l.trim()).map(l => l.replace(/^[-*•]\s*/, '').trim())
      : [])

  const useCases = parseStringArray(aiContent?.use_cases) ?? []

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
    verified: !!platforms.windows?.sha256 || !!platforms.mac?.sha256 || !!platforms.linux?.sha256,
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
    // 必填字段补全
    platforms,
    // SHA-256 校验码：优先取版本中的 sha256 → 其次 app_security 表 → 再次版本中的 sha256
    checksum:
      platforms.windows?.sha256 ||
      platforms.mac?.sha256 ||
      platforms.linux?.sha256 ||
      app.security?.sha256 ||
      '',
    sourceUrl: app.github_url || '',
    lastUpdated: app.last_updated || '',
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
