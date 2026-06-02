/**
 * API 类型定义
 */

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

// 代码宝库类型

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
