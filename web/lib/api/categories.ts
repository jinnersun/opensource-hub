/**
 * 分类、热门、搜索、首页相关 API
 */

import { apiRequest } from './client'
import type { ApiCategory, App, HomeData } from './types'

/**
 * 获取首页数据
 */
export async function getHomeData(locale?: string): Promise<HomeData> {
  return apiRequest<HomeData>('/api/home', locale ? { lang: locale } : undefined)
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
