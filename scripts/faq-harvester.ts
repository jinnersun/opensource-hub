#!/usr/bin/env tsx
/**
 * FAQ Issue 采集脚本
 * 
 * 功能:
 * 1. 从 GitHub API 抓取 Issues (带查询过滤 - 漏斗1)
 * 2. 文本特征过滤 (代码块/字数/情绪 - 漏斗2)
 * 3. 写入 raw_faqs 表 (UPSERT 逻辑,去重)
 * 4. 支持增量更新 (通过 issue_updated_at)
 * 
 * 使用方法:
 *   # 测试模式 (单项目 dry-run)
 *   tsx scripts/faq-harvester.ts --test
 *   
 *   # 全量采集 (所有 apps)
 *   tsx scripts/faq-harvester.ts --all
 *   
 *   # 指定项目
 *   tsx scripts/faq-harvester.ts --app-id app_98771110
 */

import { execSync } from 'child_process'

// ==========================================
// 类型定义
// ==========================================

interface App {
  id: string
  name: string
  github_owner: string
  github_repo: string
}

interface GitHubIssue {
  number: number
  title: string
  body: string
  state: 'open' | 'closed'
  html_url: string
  labels: Array<{ name: string }>
  comments: number
  created_at: string
  updated_at: string
  closed_at: string | null
}

interface RawFAQRecord {
  app_id: string
  issue_number: number
  issue_title: string
  issue_body: string
  issue_state: string
  issue_labels: string
  comments_count: number
  issue_created_at: string
  issue_updated_at: string
  issue_url: string
}

// ==========================================
// 配置
// ==========================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN

if (!GITHUB_TOKEN) {
  console.error('❌ 错误: 请设置 GITHUB_TOKEN 环境变量')
  console.error('   PowerShell: $env:GITHUB_TOKEN = "你的Token"')
  process.exit(1)
}

// API 查询参数 (漏斗1: GitHub API 层过滤)
// 第一轮: 严格门禁 (高质量 FAQ)
const CLOSED_QUERY = 'is:issue is:closed label:bug,question,help-wanted -label:invalid,wontfix,duplicate comments:>2'
const OPEN_QUERY = 'is:issue is:open label:bug -label:invalid,wontfix comments:>2'
// 第二轮: 宽松门禁 (增量补充, 评论数 >0 即可)
const CLOSED_QUERY_RELAXED = 'is:issue is:closed label:bug,question,help-wanted -label:invalid,wontfix,duplicate comments:>0'
const OPEN_QUERY_RELAXED = 'is:issue is:open label:bug -label:invalid,wontfix comments:>0'

const MAX_ISSUES_PER_STATE = {
  closed: 20,  // 已解决: 每次抓取 20 个
  open: 10     // 未解决: 每次抓取 10 个
}
const MIN_ISSUES_FOR_RELAXED = 3  // 已有 ≥3 条 Issue 则跳过第二轮
const EXTRA_ISSUES_PER_STATE = {
  closed: 40,  // 补充轮多抓一些
  open: 20
}

const BODY_MAX_LENGTH = 4000  // Issue 正文截断至 4000 字

// 速率限制控制
const DELAY_BETWEEN_APPS = 3000    // 每个项目之间延迟 3 秒
const DELAY_BETWEEN_REQUESTS = 1500  // 同一项目的两次 API 请求间隔 1.5 秒
const DELAY_ON_ERROR = 5000        // 遇到错误时延迟 5 秒

// ==========================================
// 辅助函数
// ==========================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function execWrangler(command: string): any {
  const output = execSync(`wrangler d1 execute opensource-hub-db --command "${command}" --remote`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  try {
    const jsonStart = output.indexOf('[')
    const jsonStr = output.substring(jsonStart)
    return JSON.parse(jsonStr)[0]
  } catch {
    console.error('解析 wrangler 输出失败:', output)
    return null
  }
}

function execWranglerFile(sql: string): any {
  const fs = require('fs')
  const path = require('path')
  const os = require('os')
  
  const tempDir = os.tmpdir()
  const tempFile = path.join(tempDir, `faq-harvest-${Date.now()}.sql`)
  fs.writeFileSync(tempFile, sql, 'utf-8')
  
  try {
    const output = execSync(`wrangler d1 execute opensource-hub-db --file "${tempFile}" --remote`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    fs.unlinkSync(tempFile)
    
    const jsonStart = output.indexOf('[')
    if (jsonStart === -1) return null
    const jsonStr = output.substring(jsonStart)
    return JSON.parse(jsonStr)[0]
  } catch (err) {
    try { fs.unlinkSync(tempFile) } catch {}
    throw err
  }
}

// ==========================================
// 漏斗2: 文本特征过滤
// ==========================================

function passesTextQualityGate(issue: GitHubIssue): boolean {
  const body = issue.body || ''
  const title = issue.title || ''
  
  // 1. 代码块检查 (必须包含 Markdown 代码块)
  if (!body.includes('```')) {
    return false
  }
  
  // 2. 字数检查 (至少 150 字符)
  if (body.length < 150) {
    return false
  }
  
  // 3. 情绪化过滤 (标题包含大量感叹号或情绪化词汇)
  const noisePatterns = [
    /!!!+/,                    // 多个感叹号
    /^help\s*$/i,             // 只有 "help"
    /^urgent\s*$/i,           // 只有 "urgent"
    /^asap\s*$/i,             // 只有 "asap"
    /plz\s+help/i,            // "plz help"
    /sooo\s+annoying/i,       // "sooo annoying"
  ]
  
  if (noisePatterns.some(pattern => pattern.test(title))) {
    return false
  }
  
  return true
}

// ==========================================
// GitHub API 客户端
// ==========================================

class GitHubClient {
  private rateLimitRemaining = 5000
  private rateLimitReset = 0
  
  async searchIssues(fullName: string, query: string, perPage: number): Promise<GitHubIssue[]> {
    const url = `https://api.github.com/search/issues?q=repo:${fullName}+${encodeURIComponent(query)}&sort=updated&order=desc&per_page=${perPage}`
    
    console.log(`    📡 搜索: ${fullName} - ${query.slice(0, 50)}...`)
    
    const resp = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28'
      }
    })
    
    // 处理速率限制
    if (resp.status === 403) {
      const resetTime = resp.headers.get('x-ratelimit-reset')
      if (resetTime) {
        const waitMs = (parseInt(resetTime) * 1000) - Date.now() + 1000
        console.log(`    ⏳ GitHub API 限流,等待 ${Math.round(waitMs / 1000)} 秒`)
        await delay(waitMs)
        return this.searchIssues(fullName, query, perPage)  // 重试
      }
    }
    
    if (!resp.ok) {
      console.error(`    ❌ GitHub API 错误: ${resp.status} ${resp.statusText}`)
      return []
    }
    
    // 更新速率限制信息
    this.rateLimitRemaining = parseInt(resp.headers.get('x-ratelimit-remaining') || '0')
    this.rateLimitReset = parseInt(resp.headers.get('x-ratelimit-reset') || '0')
    
    const data = await resp.json() as { items: GitHubIssue[] }
    return data.items || []
  }
}

// ==========================================
// D1 数据库操作
// ==========================================

async function getAllApps(): Promise<App[]> {
  const apps = execWrangler(`SELECT id, name, github_owner, github_repo FROM apps WHERE status = 'active'`)?.results || []
  const libs = execWrangler(`SELECT 'lib_' || github_repo_id as id, name, SUBSTR(full_name, 1, INSTR(full_name, '/')-1) as github_owner, SUBSTR(full_name, INSTR(full_name, '/')+1) as github_repo FROM apps_library WHERE status = 'active'`)?.results || []
  return [...apps, ...libs]
}

async function getAppById(appId: string): Promise<App | null> {
  if (appId.startsWith('lib_')) {
    const repoId = appId.replace('lib_', '')
    const result = execWrangler(`SELECT 'lib_' || github_repo_id as id, name, SUBSTR(full_name, 1, INSTR(full_name, '/')-1) as github_owner, SUBSTR(full_name, INSTR(full_name, '/')+1) as github_repo FROM apps_library WHERE github_repo_id = '${repoId}'`)
    return result?.results?.[0] || null
  }
  const result = execWrangler(`SELECT id, name, github_owner, github_repo FROM apps WHERE id = '${appId}'`)
  return result?.results?.[0] || null
}

async function upsertRawFAQ(records: RawFAQRecord[]): Promise<void> {
  if (records.length === 0) return
  
  const sqlLines = records.map(r => {
    const issueBody = (r.issue_body || '').substring(0, BODY_MAX_LENGTH).replace(/'/g, "''")
    const issueTitle = (r.issue_title || '').replace(/'/g, "''")
    const issueLabels = r.issue_labels.replace(/'/g, "''")
    
    return `INSERT INTO raw_faqs (
      app_id, issue_number, issue_title, issue_body, issue_state,
      issue_labels, comments_count, issue_created_at, issue_updated_at, issue_url,
      etl_status
    ) VALUES (
      '${r.app_id}', ${r.issue_number}, '${issueTitle}', '${issueBody}', '${r.issue_state}',
      '${issueLabels}', ${r.comments_count}, '${r.issue_created_at}', '${r.issue_updated_at}', '${r.issue_url}',
      'pending'
    ) ON CONFLICT(app_id, issue_number) DO UPDATE SET
      issue_state = excluded.issue_state,
      issue_title = excluded.issue_title,
      issue_body = excluded.issue_body,
      issue_labels = excluded.issue_labels,
      comments_count = excluded.comments_count,
      issue_updated_at = excluded.issue_updated_at,
      etl_status = 'pending',
      error_log = NULL,
      retry_count = 0;`
  })
  
  const sql = sqlLines.join('\n')
  execWranglerFile(sql)
}

// ==========================================
// 主流程
// ==========================================

// 查已有 Issues 数量 (决定是否做补充轮)
async function countExistingIssues(appId: string): Promise<number> {
  const r = execWrangler(`SELECT COUNT(*) as c FROM raw_faqs WHERE app_id='${appId}'`)
  return r?.results?.[0]?.c || 0
}

async function runSearchRound(app: App, client: GitHubClient, fullName: string, closedQ: string, openQ: string, maxClosed: number, maxOpen: number, roundLabel: string): Promise<RawFAQRecord[]> {
  console.log(`  📡 ${roundLabel}: Closed (${maxClosed}) + Open (${maxOpen})...`)
  const [closed, open] = await Promise.all([
    client.searchIssues(fullName, closedQ, maxClosed),
    delay(DELAY_BETWEEN_REQUESTS).then(() => client.searchIssues(fullName, openQ, maxOpen))
  ])
  console.log(`  ✅ ${roundLabel}: Closed ${closed.length} + Open ${open.length}`)

  const all = [...closed, ...open]
  const qualified = all.filter(issue => {
    const passes = passesTextQualityGate(issue)
    if (!passes) console.log(`    ⏭️  跳过 #${issue.number}: 未通过文本质量门禁`)
    return passes
  })
  console.log(`  ✅ 通过文本门禁: ${qualified.length}/${all.length}`)

  return qualified.map(issue => ({
    app_id: app.id,
    issue_number: issue.number,
    issue_title: issue.title,
    issue_body: issue.body || '',
    issue_state: issue.state,
    issue_labels: JSON.stringify(issue.labels.map(l => l.name)),
    comments_count: issue.comments,
    issue_created_at: issue.created_at,
    issue_updated_at: issue.updated_at,
    issue_url: issue.html_url
  }))
}

async function harvestAppIssues(app: App, client: GitHubClient): Promise<number> {
  const fullName = `${app.github_owner}/${app.github_repo}`
  console.log(`\n📦 处理项目: ${app.name} (${fullName})`)

  // 第一轮: 严格门禁
  const records = await runSearchRound(app, client, fullName, CLOSED_QUERY, OPEN_QUERY, MAX_ISSUES_PER_STATE.closed, MAX_ISSUES_PER_STATE.open, '第一轮(严格)')

  // 第二轮: 当前已有 Issues < MIN 时, 用宽松门禁补充
  const existingCount = await countExistingIssues(app.id)
  let extraRecords: RawFAQRecord[] = []
  if (existingCount + records.length < MIN_ISSUES_FOR_RELAXED) {
    console.log(`  📊 现有 ${existingCount} 条 + 本轮 ${records.length} 条 < ${MIN_ISSUES_FOR_RELAXED}，启动补充轮(宽松)...`)
    extraRecords = await runSearchRound(app, client, fullName, CLOSED_QUERY_RELAXED, OPEN_QUERY_RELAXED, EXTRA_ISSUES_PER_STATE.closed, EXTRA_ISSUES_PER_STATE.open, '第二轮(宽松)')
  } else {
    console.log(`  ✅ 已有 ${existingCount} 条，跳过补充轮`)
  }

  const all = [...records, ...extraRecords]
  if (all.length === 0) {
    console.log(`  ⏭️  无合格 Issues,跳过`)
    return 0
  }

  console.log(`  💾 写入 ${all.length} 条到 raw_faqs...`)
  await upsertRawFAQ(all)
  return all.length
}

async function main() {
  const args = process.argv.slice(2)
  const isTest = args.includes('--test')
  const isAll = args.includes('--all')
  const appIdArg = args.find(arg => arg.startsWith('--app-id='))?.split('=')[1]
  
  if (!isTest && !isAll && !appIdArg) {
    console.log('使用方法:')
    console.log('  tsx scripts/faq-harvester.ts --test        # 测试模式 (处理第一个项目,dry-run)')
    console.log('  tsx scripts/faq-harvester.ts --all         # 全量采集')
    console.log('  tsx scripts/faq-harvester.ts --app-id=xxx  # 指定项目')
    process.exit(1)
  }
  
  console.log('🚀 FAQ Issue 采集脚本启动')
  console.log(`📊 模式: ${isTest ? '测试 (dry-run)' : isAll ? '全量采集' : `指定项目 (${appIdArg})`}`)
  
  const client = new GitHubClient()
  
  try {
    let apps: App[] = []
    
    if (appIdArg) {
      // 指定项目
      const app = await getAppById(appIdArg)
      if (!app) {
        console.error(`❌ 未找到项目 ${appIdArg}`)
        process.exit(1)
      }
      apps = [app]
    } else if (isTest) {
      // 测试模式: 只取第一个
      apps = await getAllApps()
      if (apps.length === 0) {
        console.log('✅ 没有可用的项目')
        return
      }
      apps = [apps[0]]
      console.log(`📦 测试项目: ${apps[0].name} (${apps[0].id})`)
    } else {
      // 全量采集
      apps = await getAllApps()
      console.log(`📊 找到 ${apps.length} 个活跃项目`)
    }
    
    let totalHarvested = 0
    let totalApps = 0
    
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i]
      console.log(`\n[${i + 1}/${apps.length}] 处理进度: ${i + 1}/${apps.length}`)
      
      try {
        const harvested = await harvestAppIssues(app, client)
        totalHarvested += harvested
        totalApps++
        
        // 延迟避免 GitHub API 限流
        if (i < apps.length - 1) {
          console.log(`\n⏳ 等待 ${DELAY_BETWEEN_APPS / 1000} 秒...`)
          await delay(DELAY_BETWEEN_APPS)
        }
        
      } catch (err) {
        console.error(`❌ 项目 ${app.name} 采集失败:`, (err as Error).message)
        // 继续处理下一个
        await delay(DELAY_ON_ERROR)
      }
    }
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎉 采集完成!`)
    console.log(`📊 处理项目数: ${totalApps}`)
    console.log(`📊 入库 Issues 数: ${totalHarvested}`)
    console.log(`${'='.repeat(60)}`)
    
  } catch (err) {
    console.error('\n❌ 脚本执行失败:', (err as Error).message)
    process.exit(1)
  }
}

main()
