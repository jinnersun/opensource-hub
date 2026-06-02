/**
 * OpenSource-Hub API 客户端
 * 
 * Barrel export - 保持向后兼容性
 * 所有原有 export 都可通过此文件导入
 */

// 导出类型
export type {
  Category,
  Project,
  App,
  AppVersion,
  AIContent,
  SecurityInfo,
  ApiCategory,
  ApiResponse,
  PaginatedResponse,
  HomeData,
  LibraryItem,
  LibraryFacets,
} from './types'

// 导出网络层
export { apiRequest, fetchWithTimeout } from './client'

// 导出应用 API
export { getApps, getApp } from './apps'

// 导出分类、热门、搜索 API
export { getHomeData, getCategories, getTrending, searchApps, healthCheck } from './categories'

// 导出代码宝库 API
export { getLibrary, getLibraryItem, getLibraryFacets, parseLibraryTags } from './library'

// 导出数据转换函数
export { transformAppForDisplay, transformCategoryForDisplay } from './transformers'
