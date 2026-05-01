/**
 * GitHub Releases 抓取
 *
 * 关键点：
 *   - 只抓 latest release（满足首页/详情页"智能下载"展示需求）
 *   - 借助 release asset 的 digest 字段拿 SHA256，无需下载文件
 *   - 按 asset 文件名/扩展名识别 windows/macos/linux 平台
 */

import type { GitHubReleaseAsset, GitHubReleaseInfo, ReleaseAssetView } from './types'

const API_BASE = 'https://api.github.com'

const PLATFORM_PATTERNS: Array<{ os: 'windows' | 'macos' | 'linux'; pattern: RegExp }> = [
  { os: 'windows', pattern: /\.(exe|msi|msix|appx)$/i },
  { os: 'macos', pattern: /\.(dmg|pkg)$/i },
  { os: 'linux', pattern: /\.(deb|rpm|appimage|snap|flatpak)$/i },
]

const NAME_HINTS: Array<{ os: 'windows' | 'macos' | 'linux'; pattern: RegExp }> = [
  { os: 'windows', pattern: /win(dows)?|x64|x86_64|amd64/i },
  { os: 'macos', pattern: /mac(os)?|darwin|osx|apple/i },
  { os: 'linux', pattern: /linux|ubuntu|debian|fedora|arch/i },
]

function detectOs(name: string, contentType: string | undefined): 'windows' | 'macos' | 'linux' | null {
  for (const { os, pattern } of PLATFORM_PATTERNS) {
    if (pattern.test(name)) return os
  }
  if (contentType?.includes('msdownload')) return 'windows'
  for (const { os, pattern } of NAME_HINTS) {
    if (pattern.test(name)) return os
  }
  return null
}

function detectArch(name: string): string {
  if (/arm64|aarch64/i.test(name)) return 'arm64'
  if (/universal/i.test(name)) return 'universal'
  if (/x86_64|x64|amd64/i.test(name)) return 'x64'
  if (/x86|i386|ia32/i.test(name)) return 'x86'
  return 'x64'
}

function fileExt(name: string): string {
  const idx = name.lastIndexOf('.')
  return idx === -1 ? '' : name.slice(idx + 1).toLowerCase()
}

function digestToSha256(digest: string | undefined | null): string | null {
  if (!digest) return null
  // GitHub format: "sha256:abc..." 或纯 hex
  const m = digest.match(/^sha256:([a-fA-F0-9]{64})$/)
  if (m) return m[1].toLowerCase()
  if (/^[a-fA-F0-9]{64}$/.test(digest)) return digest.toLowerCase()
  return null
}

/**
 * 把单个 release 拍平成"每平台一个最优 asset"的结构
 * 选取规则：同平台内优先 stable + size 大（通常是完整安装包而非更新包）
 */
export function pickAssetsByPlatform(release: GitHubReleaseInfo): ReleaseAssetView[] {
  const byOs = new Map<string, ReleaseAssetView>()
  for (const asset of release.assets || []) {
    const os = detectOs(asset.name, asset.content_type)
    if (!os) continue
    const view: ReleaseAssetView = {
      os,
      arch: detectArch(asset.name),
      file_type: fileExt(asset.name),
      file_name: asset.name,
      file_size: asset.size || 0,
      download_url: asset.browser_download_url,
      sha256: digestToSha256(asset.digest),
      version: release.tag_name?.replace(/^v/, '') || release.name || '',
      release_date: release.published_at || null,
      release_notes: release.body || null,
      is_stable: release.prerelease ? 0 : 1,
    }
    const existing = byOs.get(os)
    if (!existing || view.file_size > existing.file_size) {
      byOs.set(os, view)
    }
  }
  return Array.from(byOs.values())
}

export interface FetchLatestReleaseResult {
  status: 'ok' | 'no_release' | 'error'
  release?: GitHubReleaseInfo
  assets?: ReleaseAssetView[]
  errorMessage?: string
}

/**
 * 拉取 repo 的 latest release。404 表示该项目从未发版。
 */
export async function fetchLatestRelease(
  fullName: string,
  token?: string,
): Promise<FetchLatestReleaseResult> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'OpenSource-Hub-ETL/1.0',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let resp: Response
  try {
    resp = await fetch(`${API_BASE}/repos/${fullName}/releases/latest`, { headers })
  } catch (err) {
    return { status: 'error', errorMessage: `network: ${(err as Error).message}` }
  }

  if (resp.status === 404) {
    return { status: 'no_release' }
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    return {
      status: 'error',
      errorMessage: `${resp.status} ${resp.statusText} ${text.slice(0, 200)}`,
    }
  }

  const release = (await resp.json()) as GitHubReleaseInfo
  const assets = pickAssetsByPlatform(release)
  return { status: 'ok', release, assets }
}

// re-export 工具供 persistence 层使用
export type { GitHubReleaseAsset, GitHubReleaseInfo, ReleaseAssetView }
