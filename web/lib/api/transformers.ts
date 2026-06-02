/**
 * 数据转换辅助函数
 * 将 API 返回的数据转换为前端组件需要的格式
 */

import type { App, ApiCategory, AIContent } from './types'
import type { Project, Category } from './types'

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
 * 将 API 返回的应用数据转换为前端组件需要的格式
 */
export function transformAppForDisplay(app: App): Project {
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
    humanTitle: app.name,
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
    securityScan: app.security?.audit_status as Project['securityScan'] || 'pending',
    tags: tags.length > 0 ? tags : undefined,
    // 兼容字段
    docsUrl: (app as any).documentation_url || undefined,
    license: app.license || undefined,
    homepage: app.homepage_url || undefined,
  }
}

/**
 * 将 API 分类转换为前端分类格式
 */
export function transformCategoryForDisplay(category: ApiCategory): Category {
  return {
    id: category.slug,
    label: category.name,  // 数据库原始名称，i18n fallback
    description: category.description,
    emoji: category.lucide_icon || category.icon || 'star',
    keywords: [category.name, category.description],
    color: category.color || 'from-gray-500 to-slate-600',
    projectCount: category.app_count,
  }
}
