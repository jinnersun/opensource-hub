#!/usr/bin/env tsx
/**
 * FAQ 存量数据处理脚本
 * 
 * 功能:
 * 1. 查询 faq_status='pending' 的项目
 * 2. 调用 GitHub API 获取 Issues
 * 3. AI 生成 SEO/GEO 优化的 FAQ
 * 4. 写入 D1 数据库
 * 5. 创建翻译任务
 * 
 * 使用方法:
 *   # 测试模式 (只处理第一个项目)
 *   tsx scripts/process-faq-backlog.ts --test
 *   
 *   # 全量处理
 *   tsx scripts/process-faq-backlog.ts --all
 *   
 *   # 指定项目测试
 *   tsx scripts/process-faq-backlog.ts --app-id app_12345
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ==========================================
// 类型定义
// ==========================================

interface App {
  id: string
  name: string
  github_owner: string
  github_repo: string
  full_description: string | null
}

interface GitHubIssue {
  number: number
  title: string
  body: string
  html_url: string
  labels: Array<{ name: string }>
  created_at: string
  closed_at: string | null
}

interface FAQCandidate {
  question_en: string
  answer_en: string
  seo_keywords: string[]
  search_intent: 'how-to' | 'troubleshooting' | 'comparison' | 'configuration'
  confidence_score: number
  issue_number: number
  issue_url: string
  issue_title: string
}

// ==========================================
// 配置
// ==========================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const AI_GATEWAY_ACCOUNT = process.env.AI_GATEWAY_ACCOUNT
const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN

// 注意: 如果使用 --dry-run 模式,不需要 AI 环境变量
if (!GITHUB_TOKEN) {
  console.error('❌ 错误: 请设置 GITHUB_TOKEN 环境变量')
  console.error('   PowerShell: $env:GITHUB_TOKEN = "你的Token"')
  process.exit(1)
}

const DELAY_BETWEEN_APPS = 3000  // 每个项目间隔 3 秒
const DELAY_ON_ERROR = 5000      // 错误后等待 5 秒
const ISSUES_PER_APP = 10        // 每个项目最多处理 10 个 Issue
const FAQ_LIMIT_PER_APP = 5      // 每个项目最多生成 5 个 FAQ

// ==========================================
// 辅助函数
// ==========================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function execWrangler(command: string): any {
  // 对于 INSERT/UPDATE 等包含复杂字符串的 SQL,使用临时文件方式
  const isComplexSQL = command.includes("INSERT") || command.includes("UPDATE")
  
  if (isComplexSQL) {
    // 写入临时 SQL 文件
    const tempDir = os.tmpdir()
    const tempFile = path.join(tempDir, `faq-sql-${Date.now()}.sql`)
    const sqlContent = command.endsWith(';') ? command : command + ';'
    fs.writeFileSync(tempFile, sqlContent, 'utf-8')
    
    try {
      const output = execSync(`wrangler d1 execute opensource-hub-db --file "${tempFile}" --remote`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe']
      })
      
      // 清理临时文件
      fs.unlinkSync(tempFile)
      
      // 解析输出
      const jsonStart = output.indexOf('[')
      if (jsonStart === -1) return null
      const jsonStr = output.substring(jsonStart)
      return JSON.parse(jsonStr)[0]
    } catch (err) {
      // 清理临时文件
      try { fs.unlinkSync(tempFile) } catch {}
      throw err
    }
  } else {
    // 简单查询直接执行
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
}

// ==========================================
// GitHub API
// ==========================================

async function fetchIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
  const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()
  const url = `https://api.github.com/repos/${owner}/${repo}/issues?state=closed&sort=created&direction=desc&per_page=${ISSUES_PER_APP}&since=${sixMonthsAgo}`
  
  console.log(`  📡 获取 Issues: ${owner}/${repo}`)
  
  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    }
  })
  
  if (resp.status === 403) {
    const resetTime = resp.headers.get('x-ratelimit-reset')
    if (resetTime) {
      const waitMs = (parseInt(resetTime) * 1000) - Date.now() + 1000
      console.log(`  ⏳ GitHub API 限流,等待 ${Math.round(waitMs / 1000)} 秒`)
      await delay(waitMs)
      return fetchIssues(owner, repo)  // 重试
    }
  }
  
  if (!resp.ok) {
    console.error(`  ❌ GitHub API 错误: ${resp.status} ${resp.statusText}`)
    return []
  }
  
  const issues = await resp.json() as GitHubIssue[]
  
  // 过滤: 必须有 body 且 >= 100 字符,排除 PR
  return issues.filter(issue => 
    issue.body && issue.body.length >= 100
  )
}

// ==========================================
// AI 生成 FAQ (SEO/GEO 优化)
// ==========================================

async function generateFAQsWithAI(
  app: App,
  issues: GitHubIssue[]
): Promise<FAQCandidate[]> {
  if (!OPENAI_API_KEY || !AI_GATEWAY_ACCOUNT || !AI_GATEWAY_TOKEN) {
    console.error('  ⚠️ AI 配置缺失,跳过 FAQ 生成')
    return []
  }
  
  const faqs: FAQCandidate[] = []
  
  for (const issue of issues.slice(0, ISSUES_PER_APP)) {
    try {
      const prompt = buildFAQPrompt(app, issue)
      const result = await callDeepSeek(prompt)
      
      if (result) {
        faqs.push({
          ...result,
          issue_number: issue.number,
          issue_url: issue.html_url,
          issue_title: issue.title
        })
      }
      
      // 每个 Issue 之间短暂延迟
      await delay(1000)
      
    } catch (err) {
      console.error(`  ⚠️ Issue #${issue.number} AI 生成失败:`, (err as Error).message)
    }
  }
  
  return faqs.slice(0, FAQ_LIMIT_PER_APP)
}

function buildFAQPrompt(app: App, issue: GitHubIssue): string {
  return `你是一个专业的开源软件技术支持专家,同时精通SEO(搜索引擎优化)和GEO(生成式引擎优化)。

你的任务是从 GitHub Issue 中提炼出 FAQ 条目,使其既对用户有帮助,又能被搜索引擎和AI助手优先推荐。

【原始 GitHub Issue】
标题: ${issue.title}
内容: ${issue.body.slice(0, 2000)}

【项目信息】
项目名称: ${app.name}
项目描述: ${app.full_description || 'N/A'}

【SEO/GEO 优化要求】

1. **搜索意图匹配**: 识别 Issue 的核心问题类型 (How-to/Troubleshooting/Comparison/Configuration)
2. **长尾关键词嵌入**: 在 Answer 中自然融入 2-3 个长尾关键词
3. **结构化答案**: 使用步骤式 (Step 1/2/3) 或列表式结构,包含代码示例
4. **权威性信号**: 引用 Issue 中的具体报错信息

【输出格式】
你必须严格按照以下 JSON 格式返回 (不要包含 markdown 代码块标记):
{
  "question_en": "SEO 优化的问题 (包含核心关键词, 50-80 字符)",
  "answer_en": "结构化答案 (200-500 字,包含步骤/代码示例)",
  "seo_keywords": ["keyword1", "keyword2", "keyword3"],
  "search_intent": "how-to",
  "confidence_score": 0.95
}

现在开始处理,返回合法 JSON:`
}

async function callDeepSeek(prompt: string): Promise<FAQCandidate | null> {
  const url = `https://gateway.ai.cloudflare.com/v1/${AI_GATEWAY_ACCOUNT}/deepseek/deepseek/v1/chat/completions`
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${AI_GATEWAY_TOKEN}`
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个专业的开源软件技术支持专家。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: false
    })
  })
  
  if (!resp.ok) {
    throw new Error(`DeepSeek API 错误: ${resp.status}`)
  }
  
  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>
  }
  
  const content = data.choices?.[0]?.message?.content || ''
  
  // 清理 JSON
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  
  try {
    return JSON.parse(cleaned) as FAQCandidate
  } catch {
    console.error('  ⚠️ AI 返回的 JSON 解析失败')
    return null
  }
}

// ==========================================
// D1 数据库操作
// ==========================================

async function getPendingApps(limit: number = 1): Promise<App[]> {
  const result = execWrangler(`SELECT id, name, github_owner, github_repo, full_description FROM apps WHERE faq_status = 'pending' AND status = 'active' LIMIT ${limit}`)
  return result?.results || []
}

async function updateFAQStatus(appId: string, status: string, extra: Record<string, any> = {}): Promise<void> {
  const updates = [`faq_status = '${status}'`, `faq_processed_at = CURRENT_TIMESTAMP`]
  
  if (extra.issue_count !== undefined) updates.push(`faq_issue_count = ${extra.issue_count}`)
  if (extra.active_count !== undefined) updates.push(`faq_active_count = ${extra.active_count}`)
  
  execWrangler(`UPDATE apps SET ${updates.join(', ')} WHERE id = '${appId}'`)
}

async function insertFAQ(appId: string, faq: FAQCandidate): Promise<string> {
  const faqId = `faq_${appId}_${faq.issue_number}`
  
  execWrangler(`INSERT OR IGNORE INTO app_faqs (
    id, app_id, question_en, answer_en,
    source_issue_url, source_issue_number, source_issue_title,
    seo_keywords, search_intent, confidence, status
  ) VALUES (
    '${faqId}', '${appId}', '${escapeSql(faq.question_en)}', '${escapeSql(faq.answer_en)}',
    '${faq.issue_url}', ${faq.issue_number}, '${escapeSql(faq.issue_title)}',
    '${JSON.stringify(faq.seo_keywords)}', '${faq.search_intent}', ${faq.confidence_score},
    'pending_translation'
  )`)
  
  return faqId
}

async function insertFAQTranslation(faqId: string, faq: FAQCandidate): Promise<void> {
  const transId = `${faqId}_en`
  
  execWrangler(`INSERT OR IGNORE INTO app_faq_translations (
    id, faq_id, locale, question, answer, translated_at
  ) VALUES (
    '${transId}', '${faqId}', 'en', '${escapeSql(faq.question_en)}', '${escapeSql(faq.answer_en)}',
    CURRENT_TIMESTAMP
  )`)
}

async function createTranslationTask(appId: string, faqId: string, locale: string): Promise<void> {
  execWrangler(`INSERT OR IGNORE INTO translation_tasks (
    app_id, source_table, source_id, source_locale, target_locale, status
  ) VALUES (
    '${appId}', 'app_faqs', '${faqId}', 'en', '${locale}', 'pending'
  )`)
}

function escapeSql(str: string): string {
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\')
}

// ==========================================
// 主流程
// ==========================================

async function processSingleApp(app: App): Promise<void> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📦 处理项目: ${app.name} (${app.id})`)
  console.log(`🔗 GitHub: ${app.github_owner}/${app.github_repo}`)
  console.log(`${'='.repeat(60)}`)
  
  try {
    // 1. 标记为 processing
    console.log('\n📝 步骤 1: 标记状态为 processing')
    await updateFAQStatus(app.id, 'processing')
    
    // 2. 获取 GitHub Issues
    console.log('\n📡 步骤 2: 获取 GitHub Issues')
    const issues = await fetchIssues(app.github_owner, app.github_repo)
    console.log(`  ✅ 获取到 ${issues.length} 个符合条件的 Issues`)
    
    if (issues.length === 0) {
      console.log('  ⏭️  无 Issues,标记为 skipped')
      await updateFAQStatus(app.id, 'skipped', { issue_count: 0, active_count: 0 })
      return
    }
    
    // 3. AI 生成 FAQ
    console.log('\n🤖 步骤 3: AI 生成 FAQ (SEO/GEO 优化)')
    const faqs = await generateFAQsWithAI(app, issues)
    console.log(`  ✅ 生成 ${faqs.length} 个 FAQ`)
    
    if (faqs.length === 0) {
      console.log('  ⚠️  无 FAQ 生成,标记为 skipped')
      await updateFAQStatus(app.id, 'skipped', { issue_count: issues.length, active_count: 0 })
      return
    }
    
    // 4. 写入 D1
    console.log('\n💾 步骤 4: 写入 D1 数据库')
    for (const faq of faqs) {
      const faqId = await insertFAQ(app.id, faq)
      await insertFAQTranslation(faqId, faq)
      console.log(`  ✅ FAQ #${faq.issue_number}: ${faq.question_en.slice(0, 50)}...`)
    }
    
    // 5. 创建翻译任务
    console.log('\n🌐 步骤 5: 创建翻译任务')
    for (const faq of faqs) {
      const faqId = `faq_${app.id}_${faq.issue_number}`
      for (const locale of ['zh', 'ja', 'ko']) {
        await createTranslationTask(app.id, faqId, locale)
        console.log(`  ✅ 创建翻译任务: ${faqId} → ${locale}`)
      }
    }
    
    // 6. 更新状态为 completed
    console.log('\n✅ 步骤 6: 更新状态为 completed')
    await updateFAQStatus(app.id, 'completed', {
      issue_count: issues.length,
      active_count: faqs.length
    })
    
    console.log(`\n🎉 项目 ${app.name} 处理完成!`)
    
  } catch (err) {
    console.error(`\n❌ 项目 ${app.name} 处理失败:`, (err as Error).message)
    // 失败回退为 pending,可重试
    await updateFAQStatus(app.id, 'pending')
    throw err
  }
}

async function main() {
  const args = process.argv.slice(2)
  const isTest = args.includes('--test')
  const isAll = args.includes('--all')
  const isDryRun = args.includes('--dry-run')
  const appIdArg = args.find(arg => arg.startsWith('--app-id='))?.split('=')[1]
  
  if (!isTest && !isAll && !appIdArg && !isDryRun) {
    console.log('使用方法:')
    console.log('  tsx scripts/process-faq-backlog.ts --test        # 测试模式 (处理第一个项目)')
    console.log('  tsx scripts/process-faq-backlog.ts --all         # 全量处理')
    console.log('  tsx scripts/process-faq-backlog.ts --app-id=xxx  # 指定项目')
    console.log('  tsx scripts/process-faq-backlog.ts --dry-run     # 空跑模式 (只查询数据,不调用 AI)')
    process.exit(1)
  }
  
  console.log('🚀 FAQ 存量数据处理脚本启动')
  console.log(`📊 模式: ${isTest ? '测试 (1个项目)' : isAll ? '全量处理' : isDryRun ? '空跑模式' : `指定项目 (${appIdArg})`}`)
  
  try {
    if (isDryRun) {
      // 空跑模式: 只查询数据,不调用 AI
      console.log('\n🔍 查询 pending 项目...')
      const apps = await getPendingApps(5)
      console.log(`📊 找到 ${apps.length} 个项目\n`)
      
      for (const app of apps) {
        console.log(`📦 项目: ${app.name} (${app.id})`)
        console.log(`   GitHub: ${app.github_owner}/${app.github_repo}`)
        console.log(`   描述: ${app.full_description?.slice(0, 80) || 'N/A'}...\n`)
        
        // 测试 GitHub API 调用
        console.log(`   📡 测试获取 Issues...`)
        const issues = await fetchIssues(app.github_owner, app.github_repo)
        console.log(`   ✅ 获取到 ${issues.length} 个 Issues\n`)
      }
      
      console.log('\n✅ 空跑完成! 如需实际处理,请使用 --test 或 --all 模式')
      return
    }
    
    if (appIdArg) {
      // 指定项目测试
      const result = execWrangler(`SELECT id, name, github_owner, github_repo, full_description FROM apps WHERE id = '${appIdArg}'`)
      const apps = result?.results || []
      if (apps.length === 0) {
        console.error(`❌ 未找到项目 ${appIdArg}`)
        process.exit(1)
      }
      await processSingleApp(apps[0])
      
    } else if (isTest) {
      // 测试模式: 只处理第一个
      console.log('\n🔍 查询第一个 pending 项目...')
      const apps = await getPendingApps(1)
      
      if (apps.length === 0) {
        console.log('✅ 没有待处理的项目')
        return
      }
      
      console.log(`📦 找到测试项目: ${apps[0].name} (${apps[0].id})`)
      await processSingleApp(apps[0])
      
    } else {
      // 全量处理
      console.log('\n🔍 查询所有 pending 项目...')
      const allApps = await getPendingApps(1000)  // 最多 1000 个
      console.log(`📊 找到 ${allApps.length} 个待处理项目`)
      
      for (let i = 0; i < allApps.length; i++) {
        const app = allApps[i]
        console.log(`\n[${i + 1}/${allApps.length}] 处理项目 ${i + 1}/${allApps.length}`)
        
        try {
          await processSingleApp(app)
          
          // 延迟避免 GitHub API 限流
          if (i < allApps.length - 1) {
            console.log(`\n⏳ 等待 ${DELAY_BETWEEN_APPS / 1000} 秒...`)
            await delay(DELAY_BETWEEN_APPS)
          }
          
        } catch (err) {
          console.error(`⚠️  项目 ${app.name} 失败,等待 ${DELAY_ON_ERROR / 1000} 秒后继续`)
          await delay(DELAY_ON_ERROR)
        }
      }
    }
    
    console.log('\n🎉 所有项目处理完成!')
    
  } catch (err) {
    console.error('\n❌ 脚本执行失败:', (err as Error).message)
    process.exit(1)
  }
}

main()
