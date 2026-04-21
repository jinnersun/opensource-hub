#!/usr/bin/env tsx
/**
 * GitHub 数据采集脚本
 * 从 GitHub 获取开源软件的基础数据，转换为 D1 数据库格式
 *
 * 使用方法:
 *   tsx scripts/github-harvester.ts --repos repos.json --output output.json
 *   或
 *   npm run harvest -- --repos repos.json --output output.json
 */

import * as fs from 'fs/promises'
import * as path from 'path'

// ==========================================
// 类型定义
// ==========================================

interface GitHubRepo {
  owner: string
  repo: string
  category?: string
  tags?: string[]
}

interface GitHubRelease {
  tag_name: string
  published_at: string
  assets: Array<{
    name: string
    size: number
    browser_download_url: string
  }>
}

interface GitHubRepoInfo {
  id: number
  name: string
  full_name: string
  description: string | null
  html_url: string
  stargazers_count: number
  license: { spdx_id: string | null } | null
  updated_at: string
  pushed_at: string
  topics: string[]
  homepage: string | null
}

interface HarvestedApp {
  id: string
  name: string
  slug: string
  description: string
  full_description: string
  category: string
  tags: string
  github_url: string
  github_owner: string
  github_repo: string
  license: string
  homepage_url: string | null
  documentation_url: string | null
  is_featured: number
  status: string
  stars_count: number
  last_updated: string
  versions: HarvestedVersion[]
  ai_content: HarvestedAIContent
  security: HarvestedSecurity
}

interface HarvestedVersion {
  id: string
  app_id: string
  version: string
  os_type: string
  arch: string
  file_type: string
  file_name: string
  file_size: number
  download_url: string
  sha256: string | null
  release_date: string
  is_stable: number
}

interface HarvestedAIContent {
  id: string
  app_id: string
  summary: string
  what_it_does: string
  what_it_cant_do: string
  use_cases: string
  quick_start_guide: string
  is_portable: number
  requirements: string
  requirement_links: string | null
  uninstall_guide: string
  has_registry_residual: number
  ai_model_version: string
  confidence_score: number
  needs_human_review: number
}

interface HarvestedSecurity {
  id: string
  app_id: string
  version_id: string | null
  sha256: string | null
  virustotal_url: string | null
  virustotal_score: number | null
  audit_status: string
  audit_notes: string | null
}

interface HarvestResult {
  apps: HarvestedApp[]
  stats: {
    total: number
    success: number
    failed: number
    skipped: number
    reasons: Record<string, number>
  }
}

// ==========================================
// 配置常量
// ==========================================

const GITHUB_API_BASE = 'https://api.github.com'
const MIN_STARS = 1000
const MAX_AGE_DAYS = 365

// 文件扩展名到操作系统和文件类型的映射
const FILE_PATTERNS: Array<{
  pattern: RegExp
  os_type: string
  arch: string
  file_type: string
}> = [
  // Windows
  { pattern: /\.exe$/i, os_type: 'windows', arch: 'x64', file_type: 'exe' },
  { pattern: /\.msi$/i, os_type: 'windows', arch: 'x64', file_type: 'msi' },
  { pattern: /\.zip$/i, os_type: 'windows', arch: 'x64', file_type: 'zip' },
  { pattern: /win.*\.zip$/i, os_type: 'windows', arch: 'x64', file_type: 'zip' },
  { pattern: /windows.*\.zip$/i, os_type: 'windows', arch: 'x64', file_type: 'zip' },
  { pattern: /win32.*\.zip$/i, os_type: 'windows', arch: 'x64', file_type: 'zip' },
  { pattern: /win64.*\.zip$/i, os_type: 'windows', arch: 'x64', file_type: 'zip' },
  { pattern: /x64.*\.exe$/i, os_type: 'windows', arch: 'x64', file_type: 'exe' },
  { pattern: /x86.*\.exe$/i, os_type: 'windows', arch: 'x86', file_type: 'exe' },
  { pattern: /arm64.*\.exe$/i, os_type: 'windows', arch: 'arm64', file_type: 'exe' },
  { pattern: /portable.*\.exe$/i, os_type: 'windows', arch: 'x64', file_type: 'exe' },
  { pattern: /portable.*\.zip$/i, os_type: 'windows', arch: 'x64', file_type: 'zip' },
  
  // macOS
  { pattern: /\.dmg$/i, os_type: 'macos', arch: 'universal', file_type: 'dmg' },
  { pattern: /\.pkg$/i, os_type: 'macos', arch: 'universal', file_type: 'pkg' },
  { pattern: /mac.*\.zip$/i, os_type: 'macos', arch: 'universal', file_type: 'zip' },
  { pattern: /macos.*\.zip$/i, os_type: 'macos', arch: 'universal', file_type: 'zip' },
  { pattern: /darwin.*\.zip$/i, os_type: 'macos', arch: 'universal', file_type: 'zip' },
  { pattern: /osx.*\.zip$/i, os_type: 'macos', arch: 'universal', file_type: 'zip' },
  { pattern: /arm64.*\.dmg$/i, os_type: 'macos', arch: 'arm64', file_type: 'dmg' },
  { pattern: /x64.*\.dmg$/i, os_type: 'macos', arch: 'x64', file_type: 'dmg' },
  
  // Linux
  { pattern: /\.appimage$/i, os_type: 'linux', arch: 'x64', file_type: 'appimage' },
  { pattern: /\.deb$/i, os_type: 'linux', arch: 'x64', file_type: 'deb' },
  { pattern: /\.rpm$/i, os_type: 'linux', arch: 'x64', file_type: 'rpm' },
  { pattern: /\.tar\.gz$/i, os_type: 'linux', arch: 'x64', file_type: 'tar.gz' },
  { pattern: /\.tar\.xz$/i, os_type: 'linux', arch: 'x64', file_type: 'tar.xz' },
  { pattern: /linux.*\.tar\.gz$/i, os_type: 'linux', arch: 'x64', file_type: 'tar.gz' },
  { pattern: /linux.*\.zip$/i, os_type: 'linux', arch: 'x64', file_type: 'zip' },
]

// 分类映射 (key: D1 categories.slug, value: 同 slug)
// apps.category 直接存储 slug，与 categories.slug 对齐
const CATEGORY_MAP: Record<string, string> = {
  'system': 'system',
  'ai': 'ai',
  'video': 'video',
  'clean-install': 'clean-install',
  'dev-tools': 'dev-tools',
  'privacy': 'privacy',
  'file-management': 'file-management',
  'design': 'design',
  'office': 'office',
}

// ==========================================
// GitHub API 客户端
// ==========================================

class GitHubClient {
  private token: string | null
  private rateLimitRemaining: number = 5000
  private rateLimitReset: number = 0

  constructor(token?: string) {
    this.token = token || process.env.GITHUB_TOKEN || null
  }

  private async request<T>(url: string): Promise<T | null> {
    // 检查速率限制
    if (this.rateLimitRemaining <= 0) {
      const now = Math.floor(Date.now() / 1000)
      if (now < this.rateLimitReset) {
        const waitSeconds = this.rateLimitReset - now
        console.warn(`⏳ GitHub API 速率限制，等待 ${waitSeconds} 秒...`)
        await sleep(waitSeconds * 1000)
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OpenSource-Hub-Harvester/1.0',
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    try {
      const response = await fetch(url, { headers })

      // 更新速率限制信息
      this.rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '0')
      this.rateLimitReset = parseInt(response.headers.get('X-RateLimit-Reset') || '0')

      if (response.status === 404) {
        console.warn(`⚠️ 仓库不存在: ${url}`)
        return null
      }

      if (response.status === 403) {
        console.error(`❌ GitHub API 限制或禁止访问: ${url}`)
        return null
      }

      if (!response.ok) {
        console.error(`❌ GitHub API 错误: ${response.status} - ${await response.text()}`)
        return null
      }

      return await response.json() as T
    } catch (error) {
      console.error(`❌ 请求失败: ${url}`, error)
      return null
    }
  }

  async getRepoInfo(owner: string, repo: string): Promise<GitHubRepoInfo | null> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}`
    return this.request<GitHubRepoInfo>(url)
  }

  async getLatestRelease(owner: string, repo: string): Promise<GitHubRelease | null> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`
    return this.request<GitHubRelease>(url)
  }

  async getReleases(owner: string, repo: string, perPage: number = 5): Promise<GitHubRelease[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?per_page=${perPage}`
    const releases = await this.request<GitHubRelease[]>(url)
    return releases || []
  }
}

// ==========================================
// 数据采集器
// ==========================================

class GitHubHarvester {
  private client: GitHubClient
  private stats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    reasons: {} as Record<string, number>,
  }

  constructor(token?: string) {
    this.client = new GitHubClient(token)
  }

  private generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  private parseAsset(asset: { name: string; size: number; browser_download_url: string }): Partial<HarvestedVersion> | null {
    const name = asset.name.toLowerCase()
    
    for (const pattern of FILE_PATTERNS) {
      if (pattern.pattern.test(name)) {
        return {
          file_name: asset.name,
          file_size: asset.size,
          download_url: asset.browser_download_url,
          os_type: pattern.os_type,
          arch: pattern.arch,
          file_type: pattern.file_type,
        }
      }
    }
    
    return null
  }

  private generateAIContent(app: HarvestedApp): HarvestedAIContent {
    const description = app.description || ''
    const name = app.name
    
    // 基于描述生成功能列表
    const features = this.extractFeatures(description)
    const useCases = this.guessUseCases(app.category, description)
    
    return {
      id: this.generateId('ai'),
      app_id: app.id,
      summary: `一句话: ${description.slice(0, 50)}${description.length > 50 ? '...' : ''}`,
      what_it_does: features.length > 0 
        ? `能帮你做什么:\n${features.map(f => `- ${f}`).join('\n')}`
        : `能帮你做什么:\n- ${name} 是一款实用的开源工具`,
      what_it_cant_do: `不能做什么:\n- 具体功能限制请参考官方文档`,
      use_cases: JSON.stringify(useCases),
      quick_start_guide: `一分钟上手:\n1. 从上方下载适合你系统的版本\n2. 安装并打开软件\n3. 按照界面提示开始使用`,
      is_portable: 0,
      requirements: '{"runtime": "请查看官方文档了解运行要求"}',
      requirement_links: null,
      uninstall_guide: `卸载方法:\n1. Windows: 控制面板 → 程序 → 卸载\n2. macOS: 将应用拖到废纸篓\n3. Linux: 使用包管理器卸载`,
      has_registry_residual: 0,
      ai_model_version: 'template-v1',
      confidence_score: 0.6,
      needs_human_review: 1,
    }
  }

  private extractFeatures(description: string): string[] {
    const features: string[] = []
    const keywords = [
      ['record', 'record screen', '录屏', '录制'],
      ['stream', 'streaming', '直播', '推流'],
      ['edit', 'editing', 'editor', '编辑'],
      ['convert', 'conversion', '转换', '转码'],
      ['download', '下载'],
      ['manage', 'management', '管理'],
      ['protect', 'protection', '保护', '安全'],
      ['optimize', 'optimization', '优化'],
      ['backup', '备份'],
      ['sync', 'synchronization', '同步'],
    ]
    
    const desc = description.toLowerCase()
    
    for (const [keyword] of keywords) {
      if (desc.includes(keyword)) {
        features.push(keyword)
      }
    }
    
    return features.slice(0, 5)
  }

  private guessUseCases(category: string, description: string): string[] {
    const useCases: Record<string, string[]> = {
      'system': ['系统优化', '性能提升', '启动管理'],
      'ai': ['智能办公', '内容创作', '自动化处理'],
      'video': ['视频录制', '直播推流', '格式转换'],
      'clean-install': ['系统安装', 'U盘制作', 'PE急救'],
      'dev-tools': ['代码编写', '调试测试', '版本控制'],
      'privacy': ['隐私保护', '广告拦截', '安全检测'],
      'file-management': ['文件同步', '备份恢复', '批量处理'],
      'office': ['文档处理', '格式转换', '效率提升'],
      'design': ['图像编辑', 'UI设计', '矢量绘图'],
    }
    
    return useCases[category] || ['日常办公', '效率提升']
  }

  async harvestRepo(repo: GitHubRepo): Promise<HarvestedApp | null> {
    this.stats.total++
    
    console.log(`\n🔍 采集: ${repo.owner}/${repo.repo}`)

    // 1. 获取仓库信息
    const repoInfo = await this.client.getRepoInfo(repo.owner, repo.repo)
    if (!repoInfo) {
      this.recordSkip('repo_not_found')
      return null
    }

    // 2. 验证规则：Stars 数量
    if (repoInfo.stargazers_count < MIN_STARS) {
      console.warn(`⚠️ 跳过: Stars 数量不足 (${repoInfo.stargazers_count} < ${MIN_STARS})`)
      this.recordSkip('insufficient_stars')
      return null
    }

    // 3. 验证规则：最近更新
    const lastPush = new Date(repoInfo.pushed_at)
    const daysSincePush = (Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24)
    if (daysSincePush > MAX_AGE_DAYS) {
      console.warn(`⚠️ 跳过: 超过 ${MAX_AGE_DAYS} 天未更新 (${Math.floor(daysSincePush)} 天)`)
      this.recordSkip('outdated')
      return null
    }

    // 4. 验证规则：开源协议
    const license = repoInfo.license?.spdx_id || 'Unknown'
    if (license === 'Unknown' || license === null) {
      console.warn(`⚠️ 跳过: 未明确开源协议`)
      this.recordSkip('no_license')
      return null
    }

    // 5. 获取最新 Release
    const release = await this.client.getLatestRelease(repo.owner, repo.repo)
    if (!release) {
      console.warn(`⚠️ 跳过: 没有 Release`)
      this.recordSkip('no_release')
      return null
    }

    // 6. 解析 Assets
    const versions: HarvestedVersion[] = []
    for (const asset of release.assets) {
      const parsed = this.parseAsset(asset)
      if (parsed) {
        versions.push({
          id: this.generateId('ver'),
          app_id: '', // 稍后填充
          version: release.tag_name.replace(/^v/, ''),
          os_type: parsed.os_type!,
          arch: parsed.arch!,
          file_type: parsed.file_type!,
          file_name: parsed.file_name!,
          file_size: parsed.file_size!,
          download_url: parsed.download_url!,
          sha256: null, // 需要从 GitHub 获取 checksum
          release_date: release.published_at,
          is_stable: 1,
        } as HarvestedVersion)
      }
    }

    if (versions.length === 0) {
      console.warn(`⚠️ 跳过: 没有可识别的安装包`)
      this.recordSkip('no_valid_assets')
      return null
    }

    // 7. 构建应用数据
    const appId = this.generateId('app')
    const category = CATEGORY_MAP[repo.category || ''] || '#系统调教'
    
    const app: HarvestedApp = {
      id: appId,
      name: repoInfo.name,
      slug: this.slugify(repoInfo.name),
      description: repoInfo.description || `${repoInfo.name} - 开源工具`,
      full_description: repoInfo.description || `${repoInfo.name} 是一款优秀的开源软件`,
      category,
      tags: JSON.stringify(repo.tags || repoInfo.topics.slice(0, 5)),
      github_url: repoInfo.html_url,
      github_owner: repo.owner,
      github_repo: repo.repo,
      license: license,
      homepage_url: repoInfo.homepage,
      documentation_url: `${repoInfo.html_url}/wiki`,
      is_featured: 0,
      status: 'active',
      stars_count: repoInfo.stargazers_count,
      last_updated: repoInfo.pushed_at,
      versions: versions.map(v => ({ ...v, app_id: appId })),
      ai_content: null as any,
      security: null as any,
    }

    // 8. 生成 AI 内容
    app.ai_content = this.generateAIContent(app)
    app.ai_content.app_id = appId

    // 9. 生成安全信息
    app.security = {
      id: this.generateId('sec'),
      app_id: appId,
      version_id: versions[0]?.id || null,
      sha256: null,
      virustotal_url: null,
      virustotal_score: null,
      audit_status: 'pending',
      audit_notes: '自动采集，待人工审核',
    }

    this.stats.success++
    console.log(`✅ 成功采集: ${app.name} (${versions.length} 个版本)`)
    
    return app
  }

  private recordSkip(reason: string) {
    this.stats.skipped++
    this.stats.reasons[reason] = (this.stats.reasons[reason] || 0) + 1
  }

  async harvestFromList(repos: GitHubRepo[]): Promise<HarvestResult> {
    const apps: HarvestedApp[] = []

    console.log(`\n🚀 开始采集 ${repos.length} 个仓库...\n`)

    for (const repo of repos) {
      try {
        const app = await this.harvestRepo(repo)
        if (app) {
          apps.push(app)
        }
      } catch (error) {
        console.error(`❌ 采集失败: ${repo.owner}/${repo.repo}`, error)
        this.stats.failed++
      }

      // 避免触发速率限制
      await sleep(1000)
    }

    return {
      apps,
      stats: this.stats,
    }
  }
}

// ==========================================
// 工具函数
// ==========================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function loadReposFromFile(filePath: string): Promise<GitHubRepo[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content)
  
  if (Array.isArray(data)) {
    return data
  }
  
  if (data.repos && Array.isArray(data.repos)) {
    return data.repos
  }
  
  throw new Error('无效的仓库列表格式，期望是数组或 { repos: [] }')
}

async function saveResults(result: HarvestResult, outputPath: string) {
  // 保存完整结果
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf-8')
  
  // 同时生成 SQL 导入文件
  const sqlPath = outputPath.replace('.json', '.sql')
  const sql = generateSQL(result.apps)
  await fs.writeFile(sqlPath, sql, 'utf-8')
  
  console.log(`\n💾 结果已保存:`)
  console.log(`   JSON: ${outputPath}`)
  console.log(`   SQL:  ${sqlPath}`)
}

function generateSQL(apps: HarvestedApp[]): string {
  const lines: string[] = []
  lines.push('-- ==========================================')
  lines.push('-- GitHub 采集数据导入脚本')
  lines.push('-- 生成时间:', new Date().toISOString())
  lines.push('-- ==========================================')
  lines.push('')
  lines.push('BEGIN TRANSACTION;')
  lines.push('')

  for (const app of apps) {
    // 插入 apps 表
    lines.push(`-- ${app.name}`)
    lines.push(`INSERT OR IGNORE INTO apps (id, name, slug, description, full_description, category, tags, github_url, github_owner, github_repo, license, homepage_url, documentation_url, is_featured, status, stars_count, last_updated) VALUES (`)
    lines.push(`    '${app.id}',`)
    lines.push(`    '${escapeSQL(app.name)}',`)
    lines.push(`    '${app.slug}',`)
    lines.push(`    '${escapeSQL(app.description)}',`)
    lines.push(`    '${escapeSQL(app.full_description)}',`)
    lines.push(`    '${app.category}',`)
    lines.push(`    '${escapeSQL(app.tags)}',`)
    lines.push(`    '${app.github_url}',`)
    lines.push(`    '${app.github_owner}',`)
    lines.push(`    '${app.github_repo}',`)
    lines.push(`    '${app.license}',`)
    lines.push(`    ${app.homepage_url ? `'${app.homepage_url}'` : 'NULL'},`)
    lines.push(`    ${app.documentation_url ? `'${app.documentation_url}'` : 'NULL'},`)
    lines.push(`    ${app.is_featured},`)
    lines.push(`    '${app.status}',`)
    lines.push(`    ${app.stars_count},`)
    lines.push(`    '${app.last_updated}'`)
    lines.push(`);`)
    lines.push('')

    // 插入版本
    for (const ver of app.versions) {
      lines.push(`INSERT OR IGNORE INTO app_versions (id, app_id, version, os_type, arch, file_type, file_name, file_size, download_url, sha256, release_date, is_stable) VALUES (`)
      lines.push(`    '${ver.id}',`)
      lines.push(`    '${ver.app_id}',`)
      lines.push(`    '${ver.version}',`)
      lines.push(`    '${ver.os_type}',`)
      lines.push(`    '${ver.arch}',`)
      lines.push(`    '${ver.file_type}',`)
      lines.push(`    '${escapeSQL(ver.file_name)}',`)
      lines.push(`    ${ver.file_size},`)
      lines.push(`    '${ver.download_url}',`)
      lines.push(`    ${ver.sha256 ? `'${ver.sha256}'` : 'NULL'},`)
      lines.push(`    '${ver.release_date}',`)
      lines.push(`    ${ver.is_stable}`)
      lines.push(`);`)
      lines.push('')
    }

    // 插入 AI 内容
    const ai = app.ai_content
    lines.push(`INSERT OR IGNORE INTO app_ai_content (id, app_id, summary, what_it_does, what_it_cant_do, use_cases, quick_start_guide, is_portable, requirements, requirement_links, uninstall_guide, has_registry_residual, ai_model_version, confidence_score, needs_human_review) VALUES (`)
    lines.push(`    '${ai.id}',`)
    lines.push(`    '${ai.app_id}',`)
    lines.push(`    '${escapeSQL(ai.summary)}',`)
    lines.push(`    '${escapeSQL(ai.what_it_does)}',`)
    lines.push(`    '${escapeSQL(ai.what_it_cant_do)}',`)
    lines.push(`    '${escapeSQL(ai.use_cases)}',`)
    lines.push(`    '${escapeSQL(ai.quick_start_guide)}',`)
    lines.push(`    ${ai.is_portable},`)
    lines.push(`    '${escapeSQL(ai.requirements)}',`)
    lines.push(`    ${ai.requirement_links ? `'${escapeSQL(ai.requirement_links)}'` : 'NULL'},`)
    lines.push(`    '${escapeSQL(ai.uninstall_guide)}',`)
    lines.push(`    ${ai.has_registry_residual},`)
    lines.push(`    '${ai.ai_model_version}',`)
    lines.push(`    ${ai.confidence_score},`)
    lines.push(`    ${ai.needs_human_review}`)
    lines.push(`);`)
    lines.push('')

    // 插入安全信息
    const sec = app.security
    lines.push(`INSERT OR IGNORE INTO app_security (id, app_id, version_id, sha256, virustotal_url, virustotal_score, audit_status, audit_notes) VALUES (`)
    lines.push(`    '${sec.id}',`)
    lines.push(`    '${sec.app_id}',`)
    lines.push(`    ${sec.version_id ? `'${sec.version_id}'` : 'NULL'},`)
    lines.push(`    ${sec.sha256 ? `'${sec.sha256}'` : 'NULL'},`)
    lines.push(`    ${sec.virustotal_url ? `'${sec.virustotal_url}'` : 'NULL'},`)
    lines.push(`    ${sec.virustotal_score ?? 'NULL'},`)
    lines.push(`    '${sec.audit_status}',`)
    lines.push(`    ${sec.audit_notes ? `'${escapeSQL(sec.audit_notes)}'` : 'NULL'}`)
    lines.push(`);`)
    lines.push('')
    lines.push('-- ----------------------------------------')
    lines.push('')
  }

  lines.push('COMMIT;')
  lines.push('')
  
  return lines.join('\n')
}

function escapeSQL(str: string): string {
  return str
    .replace(/'/g, "''")
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
}

// ==========================================
// 预设仓库列表
// ==========================================

const DEFAULT_REPOS: GitHubRepo[] = [
  // 系统调教
  { owner: 'microsoft', repo: 'PowerToys', category: 'system-tuning', tags: ['效率工具', '窗口管理', '快捷键'] },
  { owner: 'files-community', repo: 'Files', category: 'system-tuning', tags: ['文件管理器', '现代化', '标签页'] },
  { owner: 'TranslucentTB', repo: 'TranslucentTB', category: 'system-tuning', tags: ['任务栏', '美化', '透明'] },
  { owner: 'QL-Win', repo: 'QuickLook', category: 'system-tuning', tags: ['快速预览', '空格键', '效率'] },
  
  // AI 生产力
  { owner: 'chat2db', repo: 'Chat2DB', category: 'ai-productivity', tags: ['数据库', 'AI', 'SQL'] },
  { owner: 'lobehub', repo: 'lobe-chat', category: 'ai-productivity', tags: ['AI聊天', 'ChatGPT', '开源'] },
  
  // 影音处理
  { owner: 'obsproject', repo: 'obs-studio', category: 'media-processing', tags: ['直播', '录屏', '视频'] },
  { owner: 'HandBrake', repo: 'HandBrake', category: 'media-processing', tags: ['视频转码', '压缩', '格式转换'] },
  { owner: 'yt-dlp', repo: 'yt-dlp', category: 'media-processing', tags: ['视频下载', 'YouTube', '命令行'] },
  { owner: 'blender', repo: 'blender', category: 'media-processing', tags: ['3D建模', '动画', '渲染'] },
  
  // 纯净装机
  { owner: 'ventoy', repo: 'Ventoy', category: 'clean-install', tags: ['U盘启动', '多系统', '装机'] },
  { owner: 'pbatard', repo: 'rufus', category: 'clean-install', tags: ['U盘启动', 'Windows安装', '格式化'] },
  
  // 开发工具
  { owner: 'microsoft', repo: 'vscode', category: 'dev-tools', tags: ['代码编辑器', 'IDE', '微软'] },
  { owner: 'notepad-plus-plus', repo: 'notepad-plus-plus', category: 'dev-tools', tags: ['文本编辑器', '轻量', '代码'] },
  { owner: 'GitHub', repo: 'Atom', category: 'dev-tools', tags: ['代码编辑器', 'GitHub', '可定制'] },
  
  // 网络安全
  { owner: '2dust', repo: 'v2rayN', category: 'network-security', tags: ['代理', '科学上网', '网络'] },
  { owner: 'FiloSottile', repo: 'mkcert', category: 'network-security', tags: ['证书', 'HTTPS', '开发'] },
  { owner: 'bitwarden', repo: 'clients', category: 'network-security', tags: ['密码管理', '安全', '跨平台'] },
  
  // 文件管理
  { owner: 'syncthing', repo: 'syncthing', category: 'file-management', tags: ['文件同步', 'P2P', '备份'] },
  { owner: 'rclone', repo: 'rclone', category: 'file-management', tags: ['云存储', '同步', '命令行'] },
  { owner: 'halo-dev', repo: 'halo', category: 'file-management', tags: ['博客', 'CMS', '建站'] },
  
  // 办公提效
  { owner: 'logseq', repo: 'logseq', category: 'productivity', tags: ['笔记', '知识管理', '大纲'] },
  { owner: 'obsidianmd', repo: 'obsidian-releases', category: 'productivity', tags: ['笔记', '知识图谱', 'Markdown'] },
  { owner: 'joplin', repo: 'joplin', category: 'productivity', tags: ['笔记', '开源', '跨平台'] },
  { owner: ' laurent22', repo: 'joplin', category: 'productivity', tags: ['笔记', '同步', '加密'] },
  
  // 设计工具
  { owner: 'GIMP', repo: 'GIMP', category: 'design', tags: ['图像编辑', 'Photoshop替代品', '开源'] },
  { owner: 'inkscape', repo: 'inkscape', category: 'design', tags: ['矢量绘图', 'Illustrator替代品', 'SVG'] },
  { owner: 'KDE', repo: 'krita', category: 'design', tags: ['数字绘画', '插画', '专业'] },
  { owner: 'penpot', repo: 'penpot', category: 'design', tags: ['UI设计', 'Figma替代品', '协作'] },
  
  // 隐私保护
  { owner: 'uBlockOrigin', repo: 'uBlock', category: 'privacy', tags: ['广告拦截', '浏览器扩展', '隐私'] },
  { owner: 'PrivacyBadger', repo: 'PrivacyBadger', category: 'privacy', tags: ['追踪阻止', '隐私保护', 'EFF'] },
  { owner: 'gorhill', repo: 'uBlock', category: 'privacy', tags: ['广告拦截', '轻量', '高效'] },
]

// ==========================================
// 主函数
// ==========================================

async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2)
  const reposIndex = args.indexOf('--repos')
  const outputIndex = args.indexOf('--output')
  const tokenIndex = args.indexOf('--token')
  
  const reposFile = reposIndex !== -1 ? args[reposIndex + 1] : null
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : 'data/harvested-apps.json'
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : undefined

  // 加载仓库列表
  let repos: GitHubRepo[]
  if (reposFile) {
    console.log(`📂 从文件加载仓库列表: ${reposFile}`)
    repos = await loadReposFromFile(reposFile)
  } else {
    console.log('📋 使用预设仓库列表')
    repos = DEFAULT_REPOS
  }

  console.log(`🎯 共 ${repos.length} 个仓库待采集`)

  // 创建输出目录
  const outputDir = path.dirname(outputFile)
  try {
    await fs.mkdir(outputDir, { recursive: true })
  } catch {
    // 目录可能已存在
  }

  // 执行采集
  const harvester = new GitHubHarvester(token)
  const result = await harvester.harvestFromList(repos)

  // 保存结果
  await saveResults(result, outputFile)

  // 打印统计
  console.log('\n📊 采集统计:')
  console.log(`   总计: ${result.stats.total}`)
  console.log(`   成功: ${result.stats.success}`)
  console.log(`   失败: ${result.stats.failed}`)
  console.log(`   跳过: ${result.stats.skipped}`)
  console.log('\n跳过原因:')
  for (const [reason, count] of Object.entries(result.stats.reasons)) {
    console.log(`   ${reason}: ${count}`)
  }

  // 保存统计报告
  const reportPath = outputFile.replace('.json', '-report.json')
  await fs.writeFile(reportPath, JSON.stringify(result.stats, null, 2), 'utf-8')
  console.log(`\n📄 统计报告: ${reportPath}`)
}

// 运行
main().catch(console.error)
