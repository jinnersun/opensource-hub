/**
 * 应用相关 API
 */

import { apiRequest } from './client'
import type { App, PaginatedResponse } from './types'

/**
 * 获取应用列表
 */
export async function getApps(params?: {
  category?: string; limit?: number; offset?: number; featured?: boolean; q?: string; tag?: string; locale?: string
}): Promise<PaginatedResponse<App[]>> {
  const sp: Record<string,string> = {}
  if (params?.category) sp.category = params.category
  if (params?.limit) sp.limit = String(params.limit)
  if (params?.offset) sp.offset = String(params.offset)
  if (params?.featured) sp.featured = 'true'
  if (params?.q) sp.q = params.q
  if (params?.tag) sp.tag = params.tag
  if (params?.locale) sp.lang = params.locale
  return apiRequest<PaginatedResponse<App[]>>('/api/apps', Object.keys(sp).length > 0 ? sp : undefined)
}

/**
 * 获取应用详情
 */
export async function getApp(id: string, locale?: string): Promise<App> {
  return apiRequest<App>(`/api/apps/${id}`, locale ? { lang: locale } : undefined)
}
