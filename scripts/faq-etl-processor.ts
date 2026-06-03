#!/usr/bin/env tsx
/**
 * FAQ ETL 处理脚本
 * 
 * 功能:
 * 1. 从 raw_faqs 读取 pending 的 Issues
 * 2. DeepSeek 生成 FAQ (区分 closed/open 双模式)
 * 3. Gemini + Qwen 交叉评审
 * 4. 写入 app_faqs + app_faq_translations
 * 5. 创建翻译任务
 * 
 * 使用方法:
 *   # 测试模式 (单项目)
 *   tsx scripts/faq-etl-processor.ts --test
 *   
 *   # 全量处理
 *   tsx scripts/faq-etl-processor.ts --all
 *   
 *   # 指定项目
 *   tsx scripts/faq-etl-processor.ts --app-id app_98771110
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
  full_description: string | null
}

interface RawFAQ {
  id: number
  app_id: string
  issue_number: number
  issue_title: string
  issue_body: string
  issue_state: 'open' | 'closed'
  issue_labels: string
  comments_count: number
  issue_url: string
}

interface FAQCandidate {
  question_en: string
  answer_en: string
  seo_keywords: string[]
  search_intent: 'how-to' | 'troubleshooting' | 'comparison' | 'configuration'
  confidence_score: number
}

interface ReviewOutput {
  score: number
  has_hallucination: boolean
  feedback: string
}

// ==========================================
// 配置
// ==========================================

const AI_GATEWAY_ACCOUNT = process.env.AI_GATEWAY_ACCOUNT
const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN
const QWEN_API_KEY = process.env.QWEN_API_KEY  // 百炼 DashScope Key

if (!AI_GATEWAY_ACCOUNT || !AI_GATEWAY_TOKEN || !QWEN_API_KEY) {
  console.error('❌ 错误: 请设置 AI 相关环境变量')
  console.error('   PowerShell:')
  console.error('   $env:AI_GATEWAY_ACCOUNT = "你的AccountID"')
  console.error('   $env:AI_GATEWAY_TOKEN = "你的GatewayToken"')
  console.error('   $env:QWEN_API_KEY = "你的百炼Key"')
  process.exit(1)
}

const MAX_FAQS_PER_APP = 50  // 每个项目最多处理 50 个 Issues
const DELAY_BETWEEN_ISSUES = 2000  // 每个 Issue 处理后延迟 2 秒 (避免 AI API 限流)
const DELAY_ON_ERROR = 5000  // 错误后延迟 5 秒

// ==========================================
// 辅助函数
// ==========================================

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function execWrangler(command: string): any {
  // 只有 INSERT/UPDATE/DELETE 使用 --file 方式
  const isWriteSQL = command.includes('INSERT') || command.includes('UPDATE') || command.includes('DELETE')
  
  if (isWriteSQL) {
    return execWranglerFile(command)
  }
  
  // SELECT 查询使用 --command (wrangler --file 不返回 SELECT 结果!)
  const output = execSync(`wrangler d1 execute opensource-hub-db --command "${command}" --remote`, {
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe']
  })
  
  try {
    const jsonStart = output.indexOf('[')
    if (jsonStart === -1) {
      console.error('wrangler 输出无 JSON:', output)
      return null
    }
    const jsonStr = output.substring(jsonStart)
    const parsed = JSON.parse(jsonStr)
    
    return parsed[0]
  } catch (err) {
    console.error('解析 wrangler 输出失败:', output)
    console.error('错误:', (err as Error).message)
    return null
  }
}

function execWranglerFile(sql: string): any {
  const fs = require('fs')
  const path = require('path')
  const os = require('os')
  
  const tempDir = os.tmpdir()
  const tempFile = path.join(tempDir, `faq-etl-${Date.now()}.sql`)
  fs.writeFileSync(tempFile, sql, 'utf-8')
  
  try {
    const output = execSync(`wrangler d1 execute opensource-hub-db --file "${tempFile}" --remote`, {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    })
    
    fs.unlinkSync(tempFile)
    
    // wrangler 输出: [{"results": [...], "success": true, "meta": {...}}]
    const jsonStart = output.indexOf('[')
    if (jsonStart === -1) {
      console.error('wrangler 输出格式异常:', output)
      return null
    }
    const jsonStr = output.substring(jsonStart)
    const parsed = JSON.parse(jsonStr)
    return parsed[0]  // 返回 { results: [...], success: true, meta: {...} }
  } catch (err) {
    try { fs.unlinkSync(tempFile) } catch {}
    throw err
  }
}

// ==========================================
// D1 数据库操作
// ==========================================

async function getAllAppsWithPendingFAQs(): Promise<App[]> {
  const sql = `SELECT DISTINCT a.id, a.name, a.github_owner, a.github_repo, a.full_description FROM apps a INNER JOIN raw_faqs rf ON a.id = rf.app_id WHERE rf.etl_status = 'pending' AND a.status = 'active'`
  
  const result = execWrangler(sql)
  
  if (!result || !result.results) {
    console.error('查询结果为空:', result)
    return []
  }
  
  console.log(`查询到 ${result.results.length} 个项目`)
  return result.results as App[]
}

async function getAppById(appId: string): Promise<App | null> {
  const result = execWrangler(`SELECT id, name, github_owner, github_repo, full_description FROM apps WHERE id = '${appId}'`)
  return result?.results?.[0] || null
}

async function getPendingFAQs(appId: string, limit: number = 50): Promise<RawFAQ[]> {
  const result = execWrangler(`SELECT id, app_id, issue_number, issue_title, issue_body, issue_state, issue_labels, comments_count, issue_url FROM raw_faqs WHERE app_id = '${appId}' AND etl_status = 'pending' ORDER BY id ASC LIMIT ${limit}`)
  return result?.results || []
}

async function insertFAQ(appId: string, issue: RawFAQ, faq: FAQCandidate): Promise<string> {
  const faqId = `faq_${appId}_${issue.issue_number}`
  
  const issueTitle = (issue.issue_title || '').replace(/'/g, "''")
  const questionEn = faq.question_en.replace(/'/g, "''")
  const answerEn = faq.answer_en.replace(/'/g, "''")
  const seoKeywords = JSON.stringify(faq.seo_keywords).replace(/'/g, "''")
  
  const sql = `INSERT OR REPLACE INTO app_faqs (
    id, app_id, question_en, answer_en,
    source_issue_url, source_issue_number, source_issue_title,
    seo_keywords, search_intent, confidence, status, issue_state
  ) VALUES (
    '${faqId}', '${appId}', '${questionEn}', '${answerEn}',
    '${issue.issue_url}', ${issue.issue_number}, '${issueTitle}',
    '${seoKeywords}', '${faq.search_intent}', ${faq.confidence_score},
    'pending_translation', '${issue.issue_state}'
  );`
  
  execWranglerFile(sql)
  return faqId
}

async function insertFAQTranslation(faqId: string, faq: FAQCandidate): Promise<void> {
  const transId = `${faqId}_en`
  const questionEn = faq.question_en.replace(/'/g, "''")
  const answerEn = faq.answer_en.replace(/'/g, "''")
  
  const sql = `INSERT OR REPLACE INTO app_faq_translations (
    id, faq_id, locale, question, answer, translated_at
  ) VALUES (
    '${transId}', '${faqId}', 'en', '${questionEn}', '${answerEn}',
    CURRENT_TIMESTAMP
  );`
  
  execWranglerFile(sql)
}

async function createTranslationTasks(appId: string, faqId: string): Promise<void> {
  const sqlLines = ['zh', 'ja', 'ko'].map(locale => 
    `INSERT OR IGNORE INTO translation_tasks (
      app_id, source_table, source_id, source_locale, target_locale, status
    ) VALUES (
      '${appId}', 'app_faqs', '${faqId}', 'en', '${locale}', 'pending'
    );`
  )
  
  execWranglerFile(sqlLines.join('\n'))
}

async function updateRawFAQStatus(rawFaqId: number, status: 'completed' | 'rejected', errorLog?: string): Promise<void> {
  const errorLogStr = errorLog ? errorLog.replace(/'/g, "''") : ''
  
  const sql = `UPDATE raw_faqs
    SET etl_status = '${status}',
        etl_processed_at = CURRENT_TIMESTAMP,
        error_log = ${errorLog ? `'${errorLogStr}'` : 'NULL'},
        retry_count = retry_count + 1
    WHERE id = ${rawFaqId};`
  
  execWrangler(sql)
}

// ==========================================
// AI 调用
// ==========================================

async function callDeepSeek(prompt: string, systemPrompt: string): Promise<string> {
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
        { role: 'system', content: systemPrompt },
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
  
  return data.choices?.[0]?.message?.content || ''
}

async function callGemini(prompt: string): Promise<string> {
  const url = `https://gateway.ai.cloudflare.com/v1/${AI_GATEWAY_ACCOUNT}/my-gemini-proxy/google-ai-studio/v1beta/models/gemini-2.5-flash:generateContent`
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${AI_GATEWAY_TOKEN}`
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { 
        temperature: 0.2, 
        maxOutputTokens: 4096,  // 进一步增加到 4096
        thinkingConfig: {
          thinkingBudget: 0  // 关闭思考模式,避免 token 浪费
        }
      }
    })
  })
  
  if (!resp.ok) {
    throw new Error(`Gemini API 错误: ${resp.status}`)
  }
  
  const data = await resp.json() as {
    candidates: Array<{ content: { parts: Array<{ text: string }> } }>
  }
  
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function callQwen(prompt: string): Promise<string> {
  const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
  
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${QWEN_API_KEY}`
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: '你是一个严格的技术评审专家。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 1000,
      stream: false
    })
  })
  
  if (!resp.ok) {
    throw new Error(`Qwen API 错误: ${resp.status}`)
  }
  
  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>
  }
  
  return data.choices?.[0]?.message?.content || ''
}

// ==========================================
// FAQ 生成与评审
// ==========================================

async function generateFAQFromIssue(issue: RawFAQ, appName: string, appDescription: string | null): Promise<FAQCandidate | null> {
  const isClosed = issue.issue_state === 'closed'
  
  let prompt: string
  let systemPrompt: string
  
  if (isClosed) {
    systemPrompt = '你是一个专业的开源软件技术支持专家,精通 SEO 和 GEO 优化。'
    prompt = `你的任务是从已关闭的 GitHub Issue 中提炼出 FAQ 条目。

【原始 GitHub Issue】
标题: ${issue.issue_title}
内容: ${issue.issue_body.slice(0, 3000)}

【项目信息】
项目名称: ${appName}
项目描述: ${appDescription || 'N/A'}

【SEO/GEO 优化要求】
1. **搜索意图匹配**: 识别用户的核心问题类型 (How-to/Troubleshooting/Comparison/Configuration)
2. **长尾关键词嵌入**: 在 Question 和 Answer 中自然融入 2-3 个长尾关键词 (例如 "how to fix missing dll error on windows 10")
3. **结构化答案**: 使用步骤式 (Step 1/2/3) 或列表式结构,包含代码示例
4. **权威性信号**: 引用 Issue 中的具体报错信息、日志或版本号
5. **独特性**: 相比其他 FAQ,突出这个 Issue 的独特价值 (例如特定版本/特定系统的解决方案)

【输出格式范本】

✅ 好的例子:
{
  "question_en": "How to fix missing vcruntime140.dll, MSVCP140.dll, and mfc140.dll errors when launching TrafficMonitor on Windows 10/11",
  "answer_en": "This error occurs because the Microsoft Visual C++ Redistributable is not installed. Follow these steps:\n\n**Step 1**: Download the latest Visual C++ Redistributable from Microsoft's official site: https://aka.ms/vs/17/release/vc_redist.x64.exe\n\n**Step 2**: Run the installer as Administrator (right-click → Run as administrator)\n\n**Step 3**: Restart your computer\n\n**Step 4**: Launch TrafficMonitor again\n\n**Why this happens**: TrafficMonitor is compiled with Visual Studio 2015-2022, which requires the vcruntime140.dll runtime library. Without it, Windows cannot load the executable.\n\n**Verification**: After installation, you should see the DLL files in C:\\Windows\\System32\\",
  "seo_keywords": ["vcruntime140.dll missing fix", "visual c++ redistributable trafficmonitor", "msvcp140.dll error windows 10"],
  "search_intent": "troubleshooting",
  "confidence_score": 0.95
}

❌ 差的例子 (太笼统,无 SEO 价值):
{
  "question_en": "How to fix DLL errors",
  "answer_en": "Install the required DLL files.",
  "seo_keywords": ["dll", "fix"],
  "search_intent": "how-to",
  "confidence_score": 0.5
}

【输出格式】
你必须严格按照以下 JSON 格式返回 (不要包含 markdown 代码块标记):
{
  "question_en": "SEO 优化的问题 (包含核心关键词, 50-100 字符)",
  "answer_en": "结构化答案 (200-600 字,包含步骤/代码示例/原因分析)",
  "seo_keywords": ["长尾关键词1", "长尾关键词2", "长尾关键词3"],
  "search_intent": "troubleshooting",
  "confidence_score": 0.95
}

⚠️ 重要: 
- 答案中的换行符必须使用 \\n (双反斜杠+n),不要直接换行
- 不要包含任何解释文字,只返回 JSON
- 确保所有字符串都正确转义

现在开始处理,返回合法 JSON:`
  } else {
    systemPrompt = '你是一个专业的开源软件技术支持专家。'
    prompt = `你的任务是从打开的 GitHub Issue 中提取"已知 BUG 预警"信息。

【原始 GitHub Issue】
标题: ${issue.issue_title}
内容: ${issue.issue_body.slice(0, 3000)}

【项目信息】
项目名称: ${appName}

【要求】
1. BUG 描述: 在什么环境下必然触发
2. 影响范围: 多少用户受影响 (从评论数推断)
3. 临时绕过方案 (Workaround): 社区讨论的替代方案
4. 官方确认信号: 维护者是否确认

⚠️ 禁止: 不要编造解决方案!

【输出格式】
你必须严格按照以下 JSON 格式返回:
{
  "question_en": "BUG 描述 (包含触发条件, 50-80 字符)",
  "answer_en": "BUG 详情 + 影响范围 + 临时方案 (200-500 字)",
  "seo_keywords": ["bug keyword1", "bug keyword2", "workaround"],
  "search_intent": "troubleshooting",
  "confidence_score": 0.85
}

现在开始处理,返回合法 JSON:`
  }
  
  try {
    const content = await callDeepSeek(prompt, systemPrompt)
    
    const cleaned = content
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
    
    const parsed = JSON.parse(cleaned) as FAQCandidate
    
    // 基础校验
    if (!parsed.question_en || !parsed.answer_en) {
      console.error(`    ⚠️ JSON 缺少必需字段`)
      return null
    }
    
    return parsed
  } catch (err) {
    console.error(`    ⚠️ DeepSeek 生成失败:`, (err as Error).message)
    return null
  }
}

async function reviewFAQ(issue: RawFAQ, faq: FAQCandidate): Promise<{ gemini: ReviewOutput | null, qwen: ReviewOutput | null }> {
  const prompt = `你是一个技术评审专家。请审查以下 FAQ 是否忠实于原始 GitHub Issue。

【原始 Issue】
标题: ${issue.issue_title}
内容: ${issue.issue_body.slice(0, 2000)}

【待评审 FAQ】
问题: ${faq.question_en}
答案: ${faq.answer_en}

【评审标准】
1. **准确性**: 答案是否准确反映了 Issue 中的问题/解决方案? (score 0-1)
2. **完整性**: 是否遗漏了关键信息? (如解决方案、版本号、系统要求)
3. **SEO 价值**: 问题是否包含长尾关键词? 答案是否结构化? (加分项)

【幻觉判断】
- has_hallucination = true: FAQ 包含了 Issue 中**完全没有提及**的内容 (例如编造不存在的功能、解决方案)
- has_hallucination = false: FAQ 内容可以追溯到 Issue 中的信息 (即使做了 SEO 优化改写)

【评分指南】
- 0.9-1.0: 完美,准确且有用
- 0.7-0.9: 良好,有轻微不足但不影响使用
- 0.5-0.7: 一般,有明显遗漏但仍有帮助
- <0.5: 差,有严重错误或完全偏离主题

【重要】
如果 score < 0.7 或 has_hallucination = true,必须在 feedback 中**明确指出具体问题**:
- 哪部分内容是编造的?
- 遗漏了哪些关键信息?
- 哪个步骤不准确?

【输出格式】
你必须严格按照以下 JSON 格式返回:
{
  "score": 0.85,
  "has_hallucination": false,
  "feedback": "答案准确引用了 Issue #123 的解决方案,但遗漏了用户提到的 Windows 7 兼容性问题"
}

现在开始评审,返回合法 JSON:`
  
  const [geminiResult, qwenResult] = await Promise.allSettled([
    callGemini(prompt),
    callQwen(prompt)
  ])
  
  const parseReview = (content: string): ReviewOutput => {
    try {
      const cleaned = content
        .replace(/^```json\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      return JSON.parse(cleaned) as ReviewOutput
    } catch {
      return { score: 0, has_hallucination: true, feedback: 'Invalid JSON' }
    }
  }
  
  return {
    gemini: geminiResult.status === 'fulfilled' ? parseReview(geminiResult.value) : null,
    qwen: qwenResult.status === 'fulfilled' ? parseReview(qwenResult.value) : null
  }
}

function evaluateGate(gemini: ReviewOutput | null, qwen: ReviewOutput | null): { passed: boolean; action: 'insert' | 'reject'; reason?: string } {
  if (!gemini && !qwen) {
    return { passed: false, action: 'reject', reason: 'Both reviewers failed' }
  }
  
  if (!gemini || !qwen) {
    // 只有一个评审器可用
    const available = gemini || qwen!
    if (available.has_hallucination && available.score < 0.5) {
      return { passed: false, action: 'reject', reason: 'Severe hallucination' }
    }
    if (available.score >= 0.7) {
      return { passed: true, action: 'insert' }
    }
    return { passed: false, action: 'reject', reason: 'Low score from single reviewer' }
  }
  
  // 两个评审器都可用
  // 只有两个都标记幻觉才拒绝
  if (gemini.has_hallucination && qwen.has_hallucination) {
    return { passed: false, action: 'reject', reason: 'Both flagged hallucination' }
  }
  
  const avgScore = (gemini.score + qwen.score) / 2
  if (avgScore >= 0.6) {  // 降低门槛从 0.7 到 0.6
    return { passed: true, action: 'insert' }
  }
  
  return { passed: false, action: 'reject', reason: `Low avg score: ${avgScore.toFixed(2)}` }
}

// ==========================================
// 主流程
// ==========================================

async function processAppFAQs(app: App): Promise<{ processed: number; succeeded: number; failed: number }> {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📦 处理项目 FAQ: ${app.name} (${app.id})`)
  console.log(`${'='.repeat(60)}`)
  
  const pendingFAQs = await getPendingFAQs(app.id, MAX_FAQS_PER_APP)
  if (pendingFAQs.length === 0) {
    console.log(`  ⏭️  无待处理 Issues`)
    return { processed: 0, succeeded: 0, failed: 0 }
  }
  
  console.log(`  📊 找到 ${pendingFAQs.length} 条待处理 Issues`)
  
  let succeeded = 0
  let failed = 0
  
  for (let i = 0; i < pendingFAQs.length; i++) {
    const rawFAQ = pendingFAQs[i]
    console.log(`\n  [${i + 1}/${pendingFAQs.length}] 处理 Issue #${rawFAQ.issue_number}: ${rawFAQ.issue_title.slice(0, 50)}...`)
    
    try {
      // Stage 1: DeepSeek 生成
      console.log(`    🤖 Stage 1: DeepSeek 生成 FAQ...`)
      const faq = await generateFAQFromIssue(rawFAQ, app.name, app.full_description)
      if (!faq) {
        console.error(`    ❌ 生成失败`)
        await updateRawFAQStatus(rawFAQ.id, 'rejected', 'DeepSeek generation failed')
        failed++
        continue
      }
      console.log(`    ✅ 生成成功: ${faq.question_en.slice(0, 60)}...`)
      
      // Stage 2: 交叉评审
      console.log(`    🔍 Stage 2: Gemini + Qwen 评审...`)
      const { gemini, qwen } = await reviewFAQ(rawFAQ, faq)
      
      // 打印评审详情 (调试)
      console.log(`      [Gemini] Score: ${gemini?.score}, Hallucination: ${gemini?.has_hallucination}, Feedback: ${gemini?.feedback}`)
      console.log(`      [Qwen]   Score: ${qwen?.score}, Hallucination: ${qwen?.has_hallucination}, Feedback: ${qwen?.feedback}`)
      
      const gate = evaluateGate(gemini, qwen)
      
      if (gate.action !== 'insert') {
        console.log(`    ❌ 未通过评审: ${gate.reason}`)
        await updateRawFAQStatus(rawFAQ.id, 'rejected', `Review failed: ${gate.reason}`)
        failed++
        continue
      }
      console.log(`    ✅ 评审通过`)
      
      // Stage 3: 入库
      console.log(`    💾 Stage 3: 写入数据库...`)
      const faqId = await insertFAQ(app.id, rawFAQ, faq)
      await insertFAQTranslation(faqId, faq)
      await createTranslationTasks(app.id, faqId)
      
      await updateRawFAQStatus(rawFAQ.id, 'completed')
      console.log(`    ✅ 入库完成`)
      succeeded++
      
      // 延迟避免 AI API 限流
      if (i < pendingFAQs.length - 1) {
        await delay(DELAY_BETWEEN_ISSUES)
      }
      
    } catch (err) {
      console.error(`    ❌ 处理失败:`, (err as Error).message)
      await updateRawFAQStatus(rawFAQ.id, 'rejected', (err as Error).message)
      failed++
    }
  }
  
  console.log(`\n  📊 项目 ${app.name} 处理完成: 成功 ${succeeded}, 失败 ${failed}`)
  return { processed: pendingFAQs.length, succeeded, failed }
}

async function main() {
  const args = process.argv.slice(2)
  const isTest = args.includes('--test')
  const isAll = args.includes('--all')
  const appIdArg = args.find(arg => arg.startsWith('--app-id='))?.split('=')[1]
  
  if (!isTest && !isAll && !appIdArg) {
    console.log('使用方法:')
    console.log('  tsx scripts/faq-etl-processor.ts --test        # 测试模式 (处理第一个项目)')
    console.log('  tsx scripts/faq-etl-processor.ts --all         # 全量处理')
    console.log('  tsx scripts/faq-etl-processor.ts --app-id=xxx  # 指定项目')
    process.exit(1)
  }
  
  console.log('🚀 FAQ ETL 处理脚本启动')
  console.log(`📊 模式: ${isTest ? '测试' : isAll ? '全量处理' : `指定项目 (${appIdArg})`}`)
  
  try {
    let apps: App[] = []
    
    if (appIdArg) {
      const app = await getAppById(appIdArg)
      if (!app) {
        console.error(`❌ 未找到项目 ${appIdArg}`)
        process.exit(1)
      }
      apps = [app]
    } else if (isTest) {
      apps = await getAllAppsWithPendingFAQs()
      if (apps.length === 0) {
        console.log('✅ 没有待处理的项目')
        return
      }
      apps = [apps[0]]
      console.log(`📦 测试项目: ${apps[0].name} (${apps[0].id})`)
    } else {
      apps = await getAllAppsWithPendingFAQs()
      console.log(`📊 找到 ${apps.length} 个有待处理 FAQ 的项目`)
    }
    
    let totalProcessed = 0
    let totalSucceeded = 0
    let totalFailed = 0
    
    for (let i = 0; i < apps.length; i++) {
      const app = apps[i]
      console.log(`\n[${i + 1}/${apps.length}] 处理进度: ${i + 1}/${apps.length}`)
      
      try {
        const stats = await processAppFAQs(app)
        totalProcessed += stats.processed
        totalSucceeded += stats.succeeded
        totalFailed += stats.failed
        
        // 项目之间延迟
        if (i < apps.length - 1) {
          console.log(`\n⏳ 等待 3 秒...`)
          await delay(3000)
        }
        
      } catch (err) {
        console.error(`❌ 项目 ${app.name} 处理失败:`, (err as Error).message)
        await delay(DELAY_ON_ERROR)
      }
    }
    
    console.log(`\n${'='.repeat(60)}`)
    console.log(`🎉 FAQ ETL 处理完成!`)
    console.log(`📊 处理 Issue 数: ${totalProcessed}`)
    console.log(`✅ 成功: ${totalSucceeded}`)
    console.log(`❌ 失败: ${totalFailed}`)
    console.log(`${'='.repeat(60)}`)
    
  } catch (err) {
    console.error('\n❌ 脚本执行失败:', (err as Error).message)
    process.exit(1)
  }
}

main()
