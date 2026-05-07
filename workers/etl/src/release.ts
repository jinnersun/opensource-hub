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
 * 解析 SHA256SUMS / checksums 文件内容，返回文件名→sha256 映射
 * 常见格式:
 *   abc123def...  filename.exe
 *   abc123def...  ./path/to/filename.exe
 *   SHA256(filename.exe)= abc123def...
 */
function parseChecksumFile(content: string): Map<string, string> {
  const result = new Map<string, string>()
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    // 格式1: <hash>  <filename>  (sha256sum 标准格式)
    const standardMatch = trimmed.match(/^([a-fA-F0-9]{64})\s+(.+)/)
    if (standardMatch) {
      const hash = standardMatch[1].toLowerCase()
      let filename = standardMatch[2].trim()
      // 去除可能的 ./  前缀和 * 前缀（binary mode marker）
      filename = filename.replace(/^[.\/]+/, '').replace(/^\*/, '')
      if (filename) result.set(filename, hash)
      continue
    }

    // 格式2: SHA256(filename)= hash  (BSD 格式)
    const bsdMatch = trimmed.match(/^SHA256\((.+)\)\s*=\s*([a-fA-F0-9]{64})/i)
    if (bsdMatch) {
      const filename = bsdMatch[1].trim()
      const hash = bsdMatch[2].toLowerCase()
      if (filename) result.set(filename, hash)
      continue
    }

    // 格式3: MD5/SHA1 行，跳过
    if (/^(MD5|SHA1|SHA384|SHA512)/i.test(trimmed)) continue
  }
  return result
}

/**
 * 在 checksum 映射中查找与 asset name 匹配的 sha256
 * 优先精确匹配，再尝试 basename 匹配
 */
function findChecksum(assetName: string, checksums: Map<string, string>): string | null {
  // 精确匹配
  if (checksums.has(assetName)) return checksums.get(assetName)!

  // 尝试 basename 匹配（checksums 文件中的文件名可能带路径前缀）
  const basename = assetName.split('/').pop()!
  for (const [filename, hash] of checksums) {
    const fileBasename = filename.split('/').pop()!
    if (fileBasename === basename || fileBasename === assetName) return hash
  }

  return null
}

/**
 * 判断 asset 是否为 checksums 文件（SHA256SUMS, .sha256, checksums.txt 等）
 */
function isChecksumAsset(name: string): boolean {
  return /^(SHA256SUMS|SHA256SUMS\.txt|sha256sums|checksums\.txt|checksums|\.sha256|\.sha256sum)$/i.test(name)
    || /\.(sha256|sha256sum)$/i.test(name)
    || /^CHECKSUMS?(\.txt)?$/i.test(name)
}

/**
 * 把单个 release 拍平成“每平台一个最优 asset”的结构
 * 选取规则：同平台内优先 stable + size 大（通常是完整安装包而非更新包）
 * 改进：额外解析 SHA256SUMS 类 asset（在 enrichAssetsWithChecksums 中走 HTTP GET）
 */
export function pickAssetsByPlatform(release: GitHubReleaseInfo): ReleaseAssetView[] {
  // 拍平到每个平台（checksums 文件不属于任何平台，跳过）
  const byOs = new Map<string, ReleaseAssetView>()
  for (const asset of release.assets || []) {
    if (isChecksumAsset(asset.name)) continue

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

    // 如果 asset.digest 没有提供 sha256，先尝试从 release body 中解析（无网络成本）
    if (!view.sha256 && release.body) {
      view.sha256 = extractShaFromReleaseBody(release.body, asset.name)
    }

    const existing = byOs.get(os)
    if (!existing || view.file_size > existing.file_size) {
      byOs.set(os, view)
    }
  }
  return Array.from(byOs.values())
}

/**
 * 拉取单个 checksum asset 的文本内容
 * 注意：
 *   - browser_download_url 会 302 到 CDN，fetch 默认 follow redirect
 *   - checksum 文件通常很小（< 10KB），这里限制 64KB 保底
 *   - 失败静默返回 null，不阻断主流程
 */
async function fetchChecksumFile(url: string, token?: string): Promise<string | null> {
  const headers: Record<string, string> = {
    Accept: 'text/plain, application/octet-stream, */*',
    'User-Agent': 'OpenSource-Hub-ETL/1.0',
  }
  if (token) headers.Authorization = `Bearer ${token}`

  try {
    const resp = await fetch(url, { headers })
    if (!resp.ok) return null
    const contentLength = Number(resp.headers.get('content-length') || '0')
    if (contentLength > 64 * 1024) return null // 过大的文件不是真的 checksum 清单
    const text = await resp.text()
    if (text.length > 64 * 1024) return null
    return text
  } catch {
    return null
  }
}

/**
 * 拉取 release 中的 SHA256SUMS 类 asset 文件内容，回填 views 缺失的 sha256
 * 子请求预算考虑：最多拉 2 个 checksum 文件（绝大多数 repo 只有1个）
 */
export async function enrichAssetsWithChecksums(
  release: GitHubReleaseInfo,
  views: ReleaseAssetView[],
  token?: string,
): Promise<ReleaseAssetView[]> {
  // 没有缺 sha256 的 view，直接返回
  const missing = views.filter(v => !v.sha256)
  if (missing.length === 0) return views

  const checksumAssets = (release.assets || [])
    .filter(a => isChecksumAsset(a.name))
    .slice(0, 2) // 限流：最多拉 2 个
  if (checksumAssets.length === 0) return views

  // 并发拉取并合并 checksum map
  const merged = new Map<string, string>()
  const results = await Promise.all(
    checksumAssets.map(a => fetchChecksumFile(a.browser_download_url, token)),
  )
  for (const text of results) {
    if (!text) continue
    const parsed = parseChecksumFile(text)
    for (const [k, v] of parsed) merged.set(k, v)
  }
  if (merged.size === 0) return views

  // 回填
  for (const view of views) {
    if (view.sha256) continue
    const hash = findChecksum(view.file_name, merged)
    if (hash) view.sha256 = hash
  }
  return views
}

/**
 * 从 release body (markdown) 中提取指定文件的 SHA256
 * 常见格式:
 *   - `filename.exe`: abc123def...
 *   - filename.exe | abc123def...
 *   - | filename.exe | abc123def... |  (markdown table)
 */
function extractShaFromReleaseBody(body: string, assetName: string): string | null {
  if (!body) return null
  const basename = assetName.split('/').pop()!
  // 转义正则特殊字符
  const escaped = basename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // 尝试多种格式
  const patterns = [
    // markdown table: | filename | hash |
    new RegExp(`\\|\\s*${escaped}\\s*\\|\\s*([a-fA-F0-9]{64})\\s*\\|`, 'i'),
    // filename: hash  或 filename hash
    new RegExp(`${escaped}[:\\s]+([a-fA-F0-9]{64})`, 'i'),
    // backtick filename: hash
    new RegExp('`' + escaped + '`[:\\s]+([a-fA-F0-9]{64})', 'i'),
  ]

  for (const pattern of patterns) {
    const match = body.match(pattern)
    if (match) return match[1].toLowerCase()
  }
  return null
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
  let assets = pickAssetsByPlatform(release)
  // 对于缺 sha256 的 view，尝试拉取 SHA256SUMS 类文件回填
  assets = await enrichAssetsWithChecksums(release, assets, token)
  return { status: 'ok', release, assets }
}

// re-export 工具供 persistence 层使用
export type { GitHubReleaseAsset, GitHubReleaseInfo, ReleaseAssetView }
