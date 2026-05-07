/**
 * 共享类型定义
 */

export interface Env {
  DB: D1Database
  KV: KVNamespace
  OPENAI_API_KEY: string
  GITHUB_TOKEN?: string
  ALERT_WEBHOOK_URL?: string
}

export interface RawApp {
  github_repo_id: number
  full_name: string
  raw_api_data: string | null
  readme_content: string | null
  github_etag: string | null
  last_pushed_at: string | null
  next_check_at: string | null
  is_archived: number
  etl_status: string
  retry_count: number
  max_retries: number
  source: string | null
}

export interface GitHubRepoInfo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  homepage: string | null
  stargazers_count: number
  language: string | null
  license: { spdx_id: string | null; name?: string } | null
  topics: string[]
  pushed_at: string
  updated_at: string
  created_at: string
  fork: boolean
  archived: boolean
  default_branch: string
}

export type GitHubFetchStatus =
  | 'ok'
  | 'not_modified'
  | 'not_found'
  | 'rate_limited'
  | 'error'

export interface GitHubFetchResult {
  status: GitHubFetchStatus
  etag?: string
  repo?: GitHubRepoInfo
  errorMessage?: string
  rateLimitResetAt?: number
}

export interface AIResult {
  name: string
  slug: string
  description: string
  fullDescription: string
  fullDescriptionZh: string
  fullDescriptionEn: string
  descriptionZh: string
  category: string
  tags: string[]
  license: string
  homepage: string

  summaryZh: string
  featuresZh: string[]
  useCasesZh: string[]
  quickStartGuideZh: string[]
  uninstallGuideZh: string
  caveatsZh: string

  summaryEn: string
  descriptionEn: string
  featuresEn: string[]
  useCasesEn: string[]
  quickStartGuideEn: string[]
  uninstallGuideEn: string
  caveatsEn: string

  qualityScore: number
  modelVersion: string
}

export interface QualityGateResult {
  passed: boolean
  reason?: string
}

export interface BatchStats {
  fetched: number
  notModified: number
  skipped: number
  succeeded: number
  failed: number
  rateLimited: number
}

export interface GitHubReleaseAsset {
  name: string
  size: number
  browser_download_url: string
  content_type?: string
  digest?: string | null   // 2024-08 起 GitHub 在 release asset 上提供 "sha256:xxx"
}

export interface GitHubReleaseInfo {
  tag_name: string
  name: string | null
  published_at: string | null
  body: string | null
  prerelease: boolean
  draft: boolean
  assets: GitHubReleaseAsset[]
}

export interface ReleaseAssetView {
  os: 'windows' | 'macos' | 'linux'
  arch: string
  file_type: string
  file_name: string
  file_size: number
  download_url: string
  sha256: string | null
  version: string
  release_date: string | null
  release_notes: string | null
  is_stable: number
}
