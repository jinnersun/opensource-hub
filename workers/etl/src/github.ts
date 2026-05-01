/**
 * GitHub API 客户端（支持 ETag / If-None-Match 304 缓存）
 *
 * 关键点：
 *   - 命中 304 不计入主限流配额（5000/h）
 *   - 同时透出 X-RateLimit-Remaining / Reset 供调用方做退避
 */

import type { GitHubFetchResult, GitHubRepoInfo } from './types'

const API_BASE = 'https://api.github.com'

export class GitHubClient {
  private token: string | undefined
  private remaining = 5000
  private resetAt = 0

  constructor(token?: string) {
    this.token = token
  }

  get rateLimitRemaining(): number {
    return this.remaining
  }

  get rateLimitResetAt(): number {
    return this.resetAt
  }

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'OpenSource-Hub-ETL/1.0',
      ...(extra || {}),
    }
    if (this.token) headers.Authorization = `Bearer ${this.token}`
    return headers
  }

  private updateRateLimit(resp: Response) {
    const remaining = resp.headers.get('x-ratelimit-remaining')
    const reset = resp.headers.get('x-ratelimit-reset')
    if (remaining) this.remaining = parseInt(remaining)
    if (reset) this.resetAt = parseInt(reset)
  }

  /**
   * 拉取仓库元信息。
   * 如果传入 etag，会带 If-None-Match，命中时返回 status='not_modified'
   */
  async fetchRepo(fullName: string, etag?: string | null): Promise<GitHubFetchResult> {
    const url = `${API_BASE}/repos/${fullName}`
    const extra: Record<string, string> = {}
    if (etag) extra['If-None-Match'] = etag

    let resp: Response
    try {
      resp = await fetch(url, { headers: this.buildHeaders(extra) })
    } catch (err) {
      return { status: 'error', errorMessage: `network: ${(err as Error).message}` }
    }

    this.updateRateLimit(resp)

    if (resp.status === 304) {
      return { status: 'not_modified', etag: etag || undefined }
    }

    if (resp.status === 404) {
      return { status: 'not_found', errorMessage: 'repo not found' }
    }

    if (resp.status === 403 || resp.status === 429) {
      const isRateLimit = (resp.headers.get('x-ratelimit-remaining') === '0') || resp.status === 429
      return {
        status: isRateLimit ? 'rate_limited' : 'error',
        errorMessage: `${resp.status} ${resp.statusText}`,
        rateLimitResetAt: this.resetAt,
      }
    }

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      return {
        status: 'error',
        errorMessage: `${resp.status} ${resp.statusText} ${text.slice(0, 200)}`,
      }
    }

    const newEtag = resp.headers.get('etag') || undefined
    const repo = (await resp.json()) as GitHubRepoInfo

    return { status: 'ok', etag: newEtag, repo }
  }

  /**
   * 拉取 README。失败返回空串而非抛错，避免阻塞主流程。
   */
  async fetchReadme(fullName: string): Promise<string> {
    const url = `${API_BASE}/repos/${fullName}/readme`
    try {
      const resp = await fetch(url, {
        headers: this.buildHeaders({ Accept: 'application/vnd.github.raw' }),
      })
      this.updateRateLimit(resp)
      if (!resp.ok) return ''
      const text = await resp.text()
      return text.slice(0, 50000)
    } catch {
      return ''
    }
  }
}
