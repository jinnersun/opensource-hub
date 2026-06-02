/**
 * 代码宝库相关 API
 */

import { apiRequest } from './client'
import type { LibraryItem, LibraryFacets, PaginatedResponse } from './types'

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

/**
 * 获取代码宝库项目详情
 */
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
