/**
 * FAQ ETL 处理器
 * 
 * 功能:
 * 1. 从 raw_faqs 读取 pending 的 Issues
 * 2. DeepSeek 生成 FAQ (区分 closed/open 双模式)
 * 3. Gemini + Qwen 交叉评审
 * 4. 写入 app_faqs + app_faq_translations
 * 5. 创建翻译任务
 * 
 * 调用方式:
 * - 由 scheduler.ts 在 processOneInner() 中调用
 * - 每个项目处理完主流程后触发
 */

import type { Env } from './types'
import type { GatewayClient } from './gateway'
import { callDeepSeek, callGemini, callQwen } from './gateway'

// ==========================================
// 类型定义
// ==========================================

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
  revised_faq?: { question: string; answer: string }
}

// ==========================================
// FAQ 生成 (Stage 1: DeepSeek)
// ==========================================

async function generateFAQFromIssue(
  client: GatewayClient,
  rawFAQ: RawFAQ,
  appName: string,
  appDescription: string | null
): Promise<FAQCandidate | null> {
  const prompt = buildFAQGenerationPrompt(rawFAQ, appName, appDescription)
  
  try {
    const content = await callDeepSeek(client, {
      messages: [
        { role: 'system', content: '你是一个专业的开源软件技术支持专家,精通 SEO 和 GEO 优化。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000
    }, 60000)
    
    return parseFAQJSON(content)
  } catch (err) {
    console.error(`[FAQ] DeepSeek 生成失败:`, (err as Error).message)
    return null
  }
}

function buildFAQGenerationPrompt(issue: RawFAQ, appName: string, appDescription: string | null): string {
  const isClosed = issue.issue_state === 'closed'
  
  if (isClosed) {
    // Closed Issue: 已解决 FAQ
    return `你是一个专业的开源软件技术支持专家,同时精通 SEO(搜索引擎优化)和 GEO(生成式引擎优化)。

你的任务是从已关闭的 GitHub Issue 中提炼出 FAQ 条目,使其既对用户有帮助,又能被搜索引擎和 AI 助手优先推荐。

【原始 GitHub Issue】
标题: ${issue.issue_title}
内容: ${issue.issue_body.slice(0, 3000)}

【项目信息】
项目名称: ${appName}
项目描述: ${appDescription || 'N/A'}

【SEO/GEO 优化要求】
1. **搜索意图匹配**: 识别 Issue 的核心问题类型 (How-to/Troubleshooting/Comparison/Configuration)
2. **长尾关键词嵌入**: 在 Answer 中自然融入 2-3 个长尾关键词
3. **结构化答案**: 使用步骤式 (Step 1/2/3) 或列表式结构,包含代码示例
4. **权威性信号**: 引用 Issue 中的具体报错信息或日志

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
  } else {
    // Open Issue: 已知 BUG 预警
    return `你是一个专业的开源软件技术支持专家。

你的任务是从打开的 GitHub Issue 中提取"已知 BUG 预警"信息。这不是已解决的问题,而是正在讨论中的 BUG。

【原始 GitHub Issue】
标题: ${issue.issue_title}
内容: ${issue.issue_body.slice(0, 3000)}

【项目信息】
项目名称: ${appName}

【要求】
1. **BUG 描述**: 在什么环境下必然触发
2. **影响范围**: 多少用户受影响 (从评论数推断)
3. **临时绕过方案 (Workaround)**: 社区讨论的替代方案
4. **官方确认信号**: 维护者是否确认 (如 "I can reproduce", "fix in progress")

⚠️ 禁止: 不要编造解决方案!如果 Issue 中没有明确解法,标注为 "No official fix yet"

【输出格式】
你必须严格按照以下 JSON 格式返回 (不要包含 markdown 代码块标记):
{
  "question_en": "BUG 描述 (包含触发条件, 50-80 字符)",
  "answer_en": "BUG 详情 + 影响范围 + 临时方案 (200-500 字)",
  "seo_keywords": ["bug keyword1", "bug keyword2", "workaround"],
  "search_intent": "troubleshooting",
  "confidence_score": 0.85
}

现在开始处理,返回合法 JSON:`
  }
}

function parseFAQJSON(content: string): FAQCandidate | null {
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  
  try {
    const parsed = JSON.parse(cleaned) as FAQCandidate
    
    // 基础校验
    if (!parsed.question_en || !parsed.answer_en) {
      console.error('[FAQ] JSON 缺少必需字段')
      return null
    }
    
    return parsed
  } catch {
    console.error('[FAQ] JSON 解析失败')
    return null
  }
}

// ==========================================
// 交叉评审 (Stage 2: Gemini + Qwen)
// ==========================================

async function reviewFAQ(
  client: GatewayClient,
  issue: RawFAQ,
  faq: FAQCandidate
): Promise<{ gemini: ReviewOutput | null, qwen: ReviewOutput | null }> {
  const prompt = buildReviewPrompt(issue, faq)
  
  // 并行调用 Gemini 和 Qwen
  const [geminiResult, qwenResult] = await Promise.allSettled([
    callGeminiReview(client, prompt),
    callQwenReview(client, prompt)
  ])
  
  return {
    gemini: geminiResult.status === 'fulfilled' ? geminiResult.value : null,
    qwen: qwenResult.status === 'fulfilled' ? qwenResult.value : null
  }
}

function buildReviewPrompt(issue: RawFAQ, faq: FAQCandidate): string {
  return `你是一个严格的技术评审专家。请审查以下 FAQ 是否忠实于原始 GitHub Issue。

【原始 Issue】
标题: ${issue.issue_title}
内容: ${issue.issue_body.slice(0, 2000)}

【待评审 FAQ】
问题: ${faq.question_en}
答案: ${faq.answer_en}

【评审标准】
1. **幻觉检测**: FAQ 中是否包含 Issue 中未提及的内容?
2. **准确性**: 答案是否准确反映了 Issue 中的问题/解决方案?
3. **完整性**: 是否遗漏了关键信息?

【输出格式】
你必须严格按照以下 JSON 格式返回:
{
  "score": 0.9,
  "has_hallucination": false,
  "feedback": "简短评审意见"
}

现在开始评审,返回合法 JSON:`
}

async function callGeminiReview(client: GatewayClient, prompt: string): Promise<ReviewOutput> {
  const content = await callGemini(client, prompt, 30000)
  return parseReviewJSON(content)
}

async function callQwenReview(client: GatewayClient, prompt: string): Promise<ReviewOutput> {
  const content = await callQwen(client, {
    messages: [
      { role: 'system', content: '你是一个严格的技术评审专家。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.2,
    max_tokens: 1000
  }, 30000)
  return parseReviewJSON(content)
}

function parseReviewJSON(content: string): ReviewOutput {
  const cleaned = content
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  
  try {
    return JSON.parse(cleaned) as ReviewOutput
  } catch {
    console.error('[Review] JSON 解析失败')
    return { score: 0, has_hallucination: true, feedback: 'Invalid JSON' }
  }
}

// ==========================================
// 准出判断 (Stage 3)
// ==========================================

function evaluateGate(
  gemini: ReviewOutput | null,
  qwen: ReviewOutput | null
): { passed: boolean; action: 'insert' | 'reject' | 'human'; reason?: string } {
  // 两个评审器都失败 → 人工审核
  if (!gemini && !qwen) {
    return { passed: false, action: 'human', reason: 'Both reviewers failed' }
  }
  
  // 只有一个可用 → 提高门槛
  if (!gemini || !qwen) {
    const available = gemini || qwen!
    if (available.has_hallucination) {
      return { passed: false, action: 'reject', reason: 'Hallucination detected' }
    }
    if (available.score >= 0.8) {
      return { passed: true, action: 'insert' }
    }
    return { passed: false, action: 'reject', reason: 'Low score from single reviewer' }
  }
  
  // 两个都可用 → 正常流程
  if (gemini.has_hallucination || qwen.has_hallucination) {
    return { passed: false, action: 'reject', reason: 'Hallucination flagged' }
  }
  
  const avgScore = (gemini.score + qwen.score) / 2
  if (avgScore >= 0.7) {
    return { passed: true, action: 'insert' }
  }
  
  return { passed: false, action: 'reject', reason: `Low avg score: ${avgScore.toFixed(2)}` }
}

// ==========================================
// 数据库操作
// ==========================================

async function fetchPendingFAQs(env: Env, appId: string): Promise<RawFAQ[]> {
  const result = await env.DB.prepare(`
    SELECT id, app_id, issue_number, issue_title, issue_body, 
           issue_state, issue_labels, comments_count, issue_url
    FROM raw_faqs
    WHERE app_id = ? AND etl_status = 'pending'
    ORDER BY issue_updated_at DESC
    LIMIT 50
  `).bind(appId).all<RawFAQ>()
  
  return result.results || []
}

async function insertFAQ(
  env: Env,
  appId: string,
  issue: RawFAQ,
  faq: FAQCandidate
): Promise<string> {
  const faqId = `faq_${appId}_${issue.issue_number}`
  
  await env.DB.prepare(`
    INSERT OR REPLACE INTO app_faqs (
      id, app_id, question_en, answer_en,
      source_issue_url, source_issue_number, source_issue_title,
      seo_keywords, search_intent, confidence, status, issue_state
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_translation', ?)
  `).bind(
    faqId, appId, faq.question_en, faq.answer_en,
    issue.issue_url, issue.issue_number, issue.issue_title,
    JSON.stringify(faq.seo_keywords), faq.search_intent, faq.confidence_score,
    issue.issue_state
  ).run()
  
  return faqId
}

async function insertFAQTranslation(
  env: Env,
  faqId: string,
  faq: FAQCandidate
): Promise<void> {
  const transId = `${faqId}_en`
  
  await env.DB.prepare(`
    INSERT OR REPLACE INTO app_faq_translations (
      id, faq_id, locale, question, answer, translated_at
    ) VALUES (?, ?, 'en', ?, ?, CURRENT_TIMESTAMP)
  `).bind(transId, faqId, faq.question_en, faq.answer_en).run()
}

async function createTranslationTasks(
  env: Env,
  appId: string,
  faqId: string
): Promise<void> {
  for (const locale of ['zh', 'ja', 'ko']) {
    await env.DB.prepare(`
      INSERT OR IGNORE INTO translation_tasks (
        app_id, source_table, source_id, source_locale, target_locale, status
      ) VALUES (?, 'app_faqs', ?, 'en', ?, 'pending')
    `).bind(appId, faqId, locale).run()
  }
}

async function updateRawFAQStatus(
  env: Env,
  rawFaqId: number,
  status: 'completed' | 'rejected',
  errorLog?: string
): Promise<void> {
  await env.DB.prepare(`
    UPDATE raw_faqs
    SET etl_status = ?,
        etl_processed_at = CURRENT_TIMESTAMP,
        error_log = ?,
        retry_count = retry_count + 1
    WHERE id = ?
  `).bind(status, errorLog || null, rawFaqId).run()
}

// ==========================================
// 主流程
// ==========================================

export async function processFAQsForApp(
  env: Env,
  appId: string,
  appName: string,
  appDescription: string | null
): Promise<{ processed: number; succeeded: number; failed: number }> {
  const gatewayClient: GatewayClient = {
    account: env.AI_GATEWAY_ACCOUNT || '',
    token: env.AI_GATEWAY_TOKEN || '',
    qwenKey: env.QWEN_API_KEY,
    qwenWorkspace: env.QWEN_WORKSPACE
  }
  
  if (!gatewayClient.account || !gatewayClient.token) {
    console.log('[FAQ] AI Gateway 未配置,跳过 FAQ 处理')
    return { processed: 0, succeeded: 0, failed: 0 }
  }
  
  const pendingFAQs = await fetchPendingFAQs(env, appId)
  if (pendingFAQs.length === 0) {
    console.log(`[FAQ] 项目 ${appId} 无待处理 Issues`)
    return { processed: 0, succeeded: 0, failed: 0 }
  }
  
  console.log(`[FAQ] 项目 ${appId} 有 ${pendingFAQs.length} 条待处理 Issues`)
  
  let succeeded = 0
  let failed = 0
  
  for (const rawFAQ of pendingFAQs) {
    try {
      console.log(`[FAQ] 处理 Issue #${rawFAQ.issue_number}: ${rawFAQ.issue_title.slice(0, 50)}...`)
      
      // Stage 1: DeepSeek 生成
      const faq = await generateFAQFromIssue(gatewayClient, rawFAQ, appName, appDescription)
      if (!faq) {
        console.error(`[FAQ] Issue #${rawFAQ.issue_number} 生成失败`)
        await updateRawFAQStatus(env, rawFAQ.id, 'rejected', 'DeepSeek generation failed')
        failed++
        continue
      }
      
      // Stage 2: 交叉评审
      const { gemini, qwen } = await reviewFAQ(gatewayClient, rawFAQ, faq)
      const gate = evaluateGate(gemini, qwen)
      
      if (gate.action !== 'insert') {
        console.log(`[FAQ] Issue #${rawFAQ.issue_number} 未通过评审: ${gate.reason}`)
        await updateRawFAQStatus(env, rawFAQ.id, 'rejected', `Review failed: ${gate.reason}`)
        failed++
        continue
      }
      
      // Stage 3: 入库
      const faqId = await insertFAQ(env, appId, rawFAQ, faq)
      await insertFAQTranslation(env, faqId, faq)
      await createTranslationTasks(env, appId, faqId)
      
      await updateRawFAQStatus(env, rawFAQ.id, 'completed')
      console.log(`[FAQ] ✅ Issue #${rawFAQ.issue_number} 处理完成`)
      succeeded++
      
    } catch (err) {
      console.error(`[FAQ] Issue #${rawFAQ.issue_number} 处理失败:`, (err as Error).message)
      await updateRawFAQStatus(env, rawFAQ.id, 'rejected', (err as Error).message)
      failed++
    }
  }
  
  console.log(`[FAQ] 项目 ${appId} 处理完成: 成功 ${succeeded}, 失败 ${failed}`)
  return { processed: pendingFAQs.length, succeeded, failed }
}
