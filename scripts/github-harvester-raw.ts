#!/usr/bin/env tsx
/**
 * GitHub 原始数据采集脚本
 * 仅采集原始数据（仓库信息、README、Releases），不做 AI 处理
 * 数据写入 D1 raw_apps 表，由 ETL Worker 异步处理
 *
 * 使用方法:
 *   tsx scripts/github-harvester-raw.ts --repos repos.json
 *   或
 *   npm run harvest:raw -- --repos repos.json
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

interface GitHubRelease {
  tag_name: string
  published_at: string
  assets: Array<{
    name: string
    size: number
    browser_download_url: string
  }>
}

interface HarvestStats {
  total: number
  success: number
  failed: number
  skipped: number
  reasons: Record<string, number>
}

// ==========================================
// 配置常量
// ==========================================

const GITHUB_API_BASE = 'https://api.github.com'
const MIN_STARS = 1000
const MAX_AGE_DAYS = 365
const API_DELAY_MS = 500  // 每次 API 调用后延迟 500ms

// ==========================================
// 工具函数
// ==========================================

const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

function escapeSQL(str: string | null): string {
  if (!str) return 'NULL'
  return `'${str.replace(/'/g, "''").replace(/\n/g, '\\n').replace(/\r/g, '\\r')}'`
}

// ==========================================
// GitHub API 客户端
// ==========================================

class GitHubClient {
  private token: string | null
  private rateLimitRemaining: number = 5000
  private rateLimitReset: number = 0

  constructor(token?: string) {
    this.token = token || process.env.GH_TOKEN || null
  }

  private async request<T>(url: string): Promise<T | null> {
    // 检查速率限制
    if (this.rateLimitRemaining <= 10) {  // 保留 10 次余量
      const now = Math.floor(Date.now() / 1000)
      if (now < this.rateLimitReset) {
        const waitSeconds = this.rateLimitReset - now + 5  // 额外等待 5 秒
        console.warn(`⏳ GitHub API 速率限制，等待 ${waitSeconds} 秒...`)
        await delay(waitSeconds * 1000)
      }
    }

    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OpenSource-Hub-Harvester/2.0',
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

  async getReadme(owner: string, repo: string): Promise<{ content: string } | null> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme`
    const data = await this.request<{ content: string }>(url)
    if (data) {
      // GitHub API 返回 base64 编码的内容
      data.content = Buffer.from(data.content, 'base64').toString('utf-8')
    }
    return data
  }

  async getReleases(owner: string, repo: string, perPage: number = 3): Promise<GitHubRelease[]> {
    const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases?per_page=${perPage}`
    const releases = await this.request<GitHubRelease[]>(url)
    return releases || []
  }
}

// ==========================================
// D1 数据库客户端（通过 Cloudflare API）
// ==========================================

class D1Client {
  private accountId: string
  private databaseId: string
  private apiToken: string

  constructor() {
    this.accountId = process.env.CLOUDFLARE_ACCOUNT_ID || ''
    this.databaseId = process.env.D1_DATABASE_ID || ''
    this.apiToken = process.env.CLOUDFLARE_API_TOKEN || ''

    if (!this.accountId || !this.databaseId || !this.apiToken) {
      console.warn('⚠️ 未配置 D1 环境变量，将仅输出 SQL 文件')
    }
  }

  async execute(sql: string, params: any[] = []): Promise<any> {
    if (!this.accountId || !this.databaseId || !this.apiToken) {
      console.log(`   SQL: ${sql}`)
      return null
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/d1/database/${this.databaseId}/query`
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql, params })
    })

    if (!response.ok) {
      throw new Error(`D1 API error: ${response.status} - ${await response.text()}`)
    }

    return await response.json()
  }

  async first(sql: string, params: any[] = []): Promise<any> {
    const result = await this.execute(sql, params)
    // Cloudflare D1 API 返回格式: result.result[0].results[0]
    const rows = result?.result?.[0]?.results
    return rows && rows.length > 0 ? rows[0] : null
  }
}

// ==========================================
// 数据采集器
// ==========================================

class RawDataHarvester {
  private github: GitHubClient
  private d1: D1Client
  private stats: HarvestStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
    reasons: {}
  }
  private sqlStatements: string[] = []

  constructor(token?: string) {
    this.github = new GitHubClient(token)
    this.d1 = new D1Client()
  }

  /**
   * 采集单个仓库的原始数据
   */
  async harvestRepo(repo: GitHubRepo): Promise<boolean> {
    this.stats.total++
    const fullName = `${repo.owner}/${repo.repo}`
    
    console.log(`\n🔍 采集: ${fullName}`)

    try {
      // 1. 检查是否已存在（增量更新）
      const existing = await this.d1.first(
        'SELECT github_repo_id FROM raw_apps WHERE full_name = ?',
        [fullName]
      )

      if (existing) {
        console.log(`⏭️  跳过: ${fullName} 已存在`)
        this.stats.skipped++
        this.stats.reasons['already_exists'] = (this.stats.reasons['already_exists'] || 0) + 1
        return false
      }

      // 2. 获取仓库信息
      console.log(`   📦 获取仓库信息...`)
      const repoInfo = await this.github.getRepoInfo(repo.owner, repo.repo)
      await delay(API_DELAY_MS)

      if (!repoInfo) {
        console.warn(`   ❌ 跳过: 仓库不存在`)
        this.recordSkip('repo_not_found')
        return false
      }

      // 3. 验证规则：Stars 数量
      if (repoInfo.stargazers_count < MIN_STARS) {
        console.warn(`   ⚠️ 跳过: Stars 不足 (${repoInfo.stargazers_count} < ${MIN_STARS})`)
        this.recordSkip('insufficient_stars')
        return false
      }

      // 4. 验证规则：最近更新
      const lastPush = new Date(repoInfo.pushed_at)
      const daysSincePush = (Date.now() - lastPush.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSincePush > MAX_AGE_DAYS) {
        console.warn(`   ⚠️ 跳过: 超过 ${MAX_AGE_DAYS} 天未更新 (${Math.floor(daysSincePush)} 天)`)
        this.recordSkip('outdated')
        return false
      }

      // 5. 验证规则：开源协议
      const license = repoInfo.license?.spdx_id || 'Unknown'
      if (license === 'Unknown' || license === null) {
        console.warn(`   ⚠️ 跳过: 未明确开源协议`)
        this.recordSkip('no_license')
        return false
      }

      // 6. 获取 README
      console.log(`   📄 获取 README...`)
      const readme = await this.github.getReadme(repo.owner, repo.repo)
      await delay(API_DELAY_MS)

      // 7. 获取 Releases
      console.log(`   📦 获取 Releases...`)
      const releases = await this.github.getReleases(repo.owner, repo.repo)
      await delay(API_DELAY_MS)

      const hasReleases = releases.length > 0 ? 1 : 0

      // 8. 写入 raw_apps 表
      console.log(`   💾 写入 raw_apps...`)
      
      // 截断 raw_api_data 避免 SQL 过长（D1 限制）
      const rawApiData = JSON.stringify({
        id: repoInfo.id,
        name: repoInfo.name,
        full_name: repoInfo.full_name,
        description: repoInfo.description,
        stargazers_count: repoInfo.stargazers_count,
        language: repoInfo.language,
        license: repoInfo.license,
        topics: repoInfo.topics,
        pushed_at: repoInfo.pushed_at,
        created_at: repoInfo.created_at,
        html_url: repoInfo.html_url,
        homepage: repoInfo.homepage
      })
      
      // 截断 README 避免 SQL 过长（限制 50000 字符）
      const readmeContent = (readme?.content || '').substring(0, 50000)
      
      const insertSQL = `
        INSERT INTO raw_apps (
          github_repo_id, full_name, raw_api_data, readme_content,
          has_releases, release_count, readme_length, etl_status
        ) VALUES (
          ${repoInfo.id},
          '${fullName.replace(/'/g, "''")}',
          ${escapeSQL(rawApiData)},
          ${escapeSQL(readmeContent)},
          ${hasReleases},
          ${releases.length},
          ${readmeContent.length},
          'pending'
        )
      `

      this.sqlStatements.push(insertSQL)
      await this.d1.execute(insertSQL)

      this.stats.success++
      console.log(`   ✅ 成功: ${fullName} (Stars: ${repoInfo.stargazers_count})`)
      return true

    } catch (error) {
      console.error(`   ❌ 失败: ${fullName}`, error)
      this.stats.failed++
      return false
    }
  }

  private recordSkip(reason: string) {
    this.stats.skipped++
    this.stats.reasons[reason] = (this.stats.reasons[reason] || 0) + 1
  }

  /**
   * 批量采集仓库列表
   */
  async harvestFromList(repos: GitHubRepo[]): Promise<HarvestStats> {
    console.log(`\n🚀 开始采集 ${repos.length} 个仓库...\n`)

    for (const repo of repos) {
      await this.harvestRepo(repo)
    }

    return this.stats
  }

  /**
   * 生成 SQL 文件
   */
  async saveSQLFile(outputPath: string) {
    if (this.sqlStatements.length === 0) {
      console.log('\n💾 无 SQL 语句需要保存')
      return
    }

    const lines: string[] = [
      '-- ==========================================',
      '-- GitHub 原始数据采集 SQL',
      `-- 生成时间: ${new Date().toISOString()}`,
      '-- ==========================================',
      '',
      'BEGIN TRANSACTION;',
      ''
    ]

    lines.push(...this.sqlStatements)
    lines.push('')
    lines.push('COMMIT;')
    lines.push('')

    await fs.writeFile(outputPath, lines.join('\n'), 'utf-8')
    console.log(`\n💾 SQL 文件已保存: ${outputPath}`)
  }
}

// ==========================================
// 仓库发现与加载
// ==========================================

async function loadReposFromFile(filePath: string): Promise<GitHubRepo[]> {
  const content = await fs.readFile(filePath, 'utf-8')
  const data = JSON.parse(content)
  return Array.isArray(data) ? data : data.repos || []
}

async function discoverTrendingRepos(token?: string): Promise<GitHubRepo[]> {
  console.log('🔥 发现趋势项目...')
  
  // 使用 GitHub Search API 发现热门项目
  const queries = [
    'stars:>1000 language:typescript created:>2026-01-01',
    'stars:>5000 language:python created:>2025-06-01',
    'stars:>3000 language:rust created:>2025-06-01'
  ]
  
  const discovered: GitHubRepo[] = []
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'OpenSource-Hub-Harvester'
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  for (const query of queries) {
    try {
      const url = `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`
      const response = await fetch(url, { headers })
      
      if (response.ok) {
        const data = await response.json()
        
        if (data?.items) {
          for (const item of data.items) {
            // 过滤：非 Fork、有描述、有 Release
            if (!item.fork && item.description && item.stargazers_count > 1000) {
              discovered.push({
                owner: item.owner.login,
                repo: item.name,
                category: 'discovered',
                tags: item.topics?.slice(0, 3) || ['trending']
              })
            }
          }
        }
      }
      
      await delay(1000) // 搜索 API 也有速率限制
    } catch (error) {
      console.warn(`搜索失败: ${query}`, error)
    }
  }
  
  console.log(`✅ 发现 ${discovered.length} 个趋势项目`)
  return discovered
}

async function loadReposFromSubmissions(d1: D1Client): Promise<GitHubRepo[]> {
  console.log('📥 加载用户提交的项目...')
  
  try {
    const result = await d1.first(
      `SELECT github_url FROM repo_submissions WHERE status = 'approved' ORDER BY created_at DESC LIMIT 10`
    )
    
    // 注意：这里简化处理，实际需要解析多条记录
    // 完整实现需要查询所有记录
    const submissions: GitHubRepo[] = []
    
    // 暂时返回空数组，等待完整实现
    return submissions
  } catch (error) {
    console.log('📥 暂无用户提交的项目')
    return []
  }
}

// 合并所有来源的仓库列表（去重）
function mergeRepos(...sources: GitHubRepo[][]): GitHubRepo[] {
  const seen = new Set<string>()
  const merged: GitHubRepo[] = []
  
  for (const source of sources) {
    for (const repo of source) {
      const key = `${repo.owner}/${repo.repo}`
      if (!seen.has(key)) {
        seen.add(key)
        merged.push(repo)
      }
    }
  }
  
  return merged
}

// ==========================================
// 主函数
// ==========================================

async function main() {
  // 解析命令行参数
  const args = process.argv.slice(2)
  const reposIndex = args.indexOf('--repos')
  const outputIndex = args.indexOf('--output')
  const tokenIndex = args.indexOf('--token')
  const discoverIndex = args.indexOf('--discover')
  const submissionsIndex = args.indexOf('--submissions')
  
  const reposFile = reposIndex !== -1 ? args[reposIndex + 1] : null
  const outputFile = outputIndex !== -1 ? args[outputIndex + 1] : 'data/harvested-raw.json'
  const token = tokenIndex !== -1 ? args[tokenIndex + 1] : undefined
  const enableDiscover = discoverIndex !== -1
  const enableSubmissions = submissionsIndex !== -1

  // 加载仓库列表（多层来源）
  const sources: GitHubRepo[][] = []
  
  // 1. 种子项目（配置文件）
  const seedFile = reposFile || '../data/repos.json'
  try {
    console.log(`📂 加载种子项目: ${seedFile}`)
    const seedRepos = await loadReposFromFile(seedFile)
    sources.push(seedRepos)
    console.log(`✅ 种子项目: ${seedRepos.length} 个`)
  } catch (error) {
    console.warn(`⚠️ 种子项目加载失败: ${seedFile}`)
  }
  
  // 2. 趋势发现（可选）
  if (enableDiscover) {
    console.log('🔥 启用趋势发现...')
    const trendingRepos = await discoverTrendingRepos(token)
    sources.push(trendingRepos)
  }
  
  // 3. 用户提交（可选）
  if (enableSubmissions) {
    console.log('📥 加载用户提交...')
    // 注意：需要 D1 连接，这里简化处理
    // const submissionRepos = await loadReposFromSubmissions(d1)
    // sources.push(submissionRepos)
  }
  
  // 合并去重
  const repos = mergeRepos(...sources)

  console.log(`🎯 共 ${repos.length} 个仓库待采集`)

  // 创建输出目录
  const outputDir = path.dirname(outputFile)
  try {
    await fs.mkdir(outputDir, { recursive: true })
  } catch {
    // 目录可能已存在
  }

  // 执行采集
  const harvester = new RawDataHarvester(token)
  const stats = await harvester.harvestFromList(repos)

  // 保存 SQL 文件
  const sqlPath = outputFile.replace('.json', '.sql')
  await harvester.saveSQLFile(sqlPath)

  // 打印统计
  console.log('\n📊 采集统计:')
  console.log(`   总计: ${stats.total}`)
  console.log(`   成功: ${stats.success}`)
  console.log(`   失败: ${stats.failed}`)
  console.log(`   跳过: ${stats.skipped}`)
  console.log('\n跳过原因:')
  for (const [reason, count] of Object.entries(stats.reasons)) {
    console.log(`   ${reason}: ${count}`)
  }

  // 保存统计报告
  const reportPath = outputFile.replace('.json', '-report.json')
  await fs.writeFile(reportPath, JSON.stringify(stats, null, 2), 'utf-8')
  console.log(`\n📄 统计报告: ${reportPath}`)
}

// 运行
main().catch(console.error)
