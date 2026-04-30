/**
 * OpenSource-Hub ETL Worker
 * 异步处理 raw_apps 表中的原始数据，调用 AI 生成结构化内容
 * 
 * 触发方式：
 * 1. 定时触发：每 2 小时运行一次
 * 2. HTTP 触发：POST /etl/trigger 手动触发
 * 3. HTTP 触发：GET /etl/metrics 查看指标
 */

// ==========================================
// 类型定义
// ==========================================

interface Env {
  DB: D1Database
  KV: KVNamespace
  OPENAI_API_KEY: string
  ALERT_WEBHOOK_URL?: string
}

interface AIResult {
  name: string
  slug: string
  description: string
  fullDescription: string
  category: string
  tags: string[]
  license: string
  homepage: string
  
  summaryZh: string
  featuresZh: string[]
  useCasesZh: string[]
  quickStartGuideZh: string
  uninstallGuideZh: string
  caveatsZh: string
  
  summaryEn: string
  descriptionEn: string
  featuresEn: string[]
  useCasesEn: string[]
  quickStartGuideEn: string
  uninstallGuideEn: string
  caveatsEn: string
  
  qualityScore: number
  modelVersion: string
}

interface ETLMetrics {
  totalProcessed: number
  totalSuccess: number
  totalFailed: number
  lastRun: string | null
}

// ==========================================
// AI Prompt 模板
// ==========================================

const AI_PROMPT = `你是一个专业的开源软件分析师。请分析以下 GitHub 项目的 README 和元数据，生成结构化的多语言内容。

项目信息：
- 名称：{name}
- 描述：{description}
- Stars：{stars}
- 协议：{license}

README 内容：
{readme}

请以 JSON 格式返回以下字段（必须全部包含）：

{
  "name": "项目名称",
  "slug": "url-friendly-name",
  "description": "简短描述（50 字以内）",
  "fullDescription": "完整描述（200 字以内）",
  "category": "分类 slug（system/ai/video/privacy/clean-install/dev-tools/file-management/design/office）",
  "tags": ["标签1", "标签2", "标签3"],
  "license": "开源协议",
  "homepage": "官方主页",
  
  "summaryZh": "一句话白话总结（中文，30 字以内）",
  "featuresZh": ["功能1", "功能2", "功能3"],
  "useCasesZh": ["场景1", "场景2"],
  "quickStartGuideZh": "一分钟上手指南（中文，步骤用 \\n 分隔）",
  "uninstallGuideZh": "卸载说明（中文）",
  "caveatsZh": "避坑指南（中文）",
  
  "summaryEn": "One-sentence summary (English, under 30 words)",
  "descriptionEn": "Short description (English)",
  "featuresEn": ["Feature 1", "Feature 2"],
  "useCasesEn": ["Use case 1", "Use case 2"],
  "quickStartGuideEn": "Quick start guide (English)",
  "uninstallGuideEn": "Uninstall guide (English)",
  "caveatsEn": "Caveats (English)",
  
  "qualityScore": 0.95,
  "modelVersion": "gpt-4o-mini-2024-07-18"
}

要求：
1. 内容要通俗易懂，避免技术黑话
2. 突出核心卖点和适用场景
3. 明确说明不能做什么（避坑）
4. 质量评分 0-1，基于 README 完整度和项目活跃度
5. 必须返回合法的 JSON，不要包含 markdown 代码块标记`

// ==========================================
// 工具函数
// ==========================================

const delay = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms))

function generateAppId(githubRepoId: number): string {
  return `app_${githubRepoId}`
}

function generateId(): string {
  return `etl_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// ==========================================
// AI 调用
// ==========================================

async function callAI(params: {
  readme: string
  repoInfo: any
  env: Env
  timeout?: number
}): Promise<AIResult> {
  const prompt = AI_PROMPT
    .replace('{name}', params.repoInfo.name)
    .replace('{description}', params.repoInfo.description || '')
    .replace('{stars}', params.repoInfo.stargazers_count)
    .replace('{license}', params.repoInfo.license?.spdx_id || 'Unknown')
    .replace('{readme}', params.readme.substring(0, 10000))  // 限制长度
  
  // 使用 DeepSeek API（兼容 OpenAI 格式）
  // 文档: https://api-docs.deepseek.com/
  // 如需切换回 OpenAI，将 URL 改为 'https://api.openai.com/v1/chat/completions'
  // 模型改为 'gpt-4o-mini'
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${params.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-v4-pro',  // DeepSeek V4 Pro（推荐）
      // model: 'deepseek-v4-flash',  // DeepSeek V4 Flash（更快更便宜）
      // model: 'gpt-4o-mini',  // OpenAI 模型（备用）
      messages: [
        { role: 'system', content: '你是一个专业的开源软件分析师。' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 2000,
      stream: false
    }),
    signal: params.timeout ? AbortSignal.timeout(params.timeout) : undefined
  })
  
  if (!response.ok) {
    const errorText = await response.text()
    if (response.status === 429) {
      throw new Error(`AI API rate limit: ${response.status}`)
    }
    throw new Error(`AI API error: ${response.status} - ${errorText}`)
  }
  
  const data = await response.json()
  const content = data.choices[0].message.content
  
  // 移除可能的 markdown 代码块标记
  const cleanedContent = content
    .replace(/^```json\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
  
  try {
    const result = JSON.parse(cleanedContent)
    
    // 验证必需字段
    if (!result.name || !result.slug || !result.summaryZh || !result.summaryEn) {
      throw new Error('AI result missing required fields')
    }
    
    return result as AIResult
  } catch {
    throw new Error('AI returned invalid JSON')
  }
}

// ==========================================
// 验证 AI 结果
// ==========================================

function validateAIResult(result: AIResult): boolean {
  // 检查必需字段
  if (!result.name || !result.slug || !result.category) {
    return false
  }
  
  // 检查分类是否有效
  const validCategories = ['system', 'ai', 'video', 'privacy', 'clean-install', 'dev-tools', 'file-management', 'design', 'office']
  if (!validCategories.includes(result.category)) {
    return false
  }
  
  // 检查质量评分
  if (result.qualityScore < 0 || result.qualityScore > 1) {
    return false
  }
  
  return true
}

// ==========================================
// ETL 核心逻辑
// ==========================================

async function processBatch(env: Env): Promise<number> {
  // 1. 获取待处理数据（包含超时回退）
  const rawApps = await env.DB.prepare(`
    SELECT * FROM raw_apps 
    WHERE (
      etl_status = 'pending' 
      OR (etl_status = 'processing' AND processing_started_at < datetime('now', '-30 minutes'))
      OR (etl_status = 'failed' AND retry_count < max_retries)
      OR (etl_status = 'rate_limited' AND retry_count < max_retries AND last_processed_at < datetime('now', '-1 hour'))
    )
    ORDER BY collected_at ASC 
    LIMIT 5
  `).all()
  
  if (rawApps.results.length === 0) {
    console.log('No pending apps to process')
    return 0
  }
  
  console.log(`Processing ${rawApps.results.length} apps...`)
  
  // 2. 立即锁定
  const ids = rawApps.results.map(app => app.github_repo_id)
  await env.DB.prepare(`
    UPDATE raw_apps 
    SET etl_status = 'processing', 
        processing_started_at = CURRENT_TIMESTAMP
    WHERE github_repo_id IN (${ids.join(',')})
  `).run()
  
  // 3. 并发处理（控制并发数为 3）
  let successCount = 0
  let failCount = 0
  
  const processPromises = rawApps.results.map(async (rawApp) => {
    try {
      await processSingleApp(rawApp, env)
      successCount++
    } catch (error) {
      console.error(`Failed to process ${rawApp.full_name}:`, error)
      failCount++
      await handleProcessingError(rawApp.github_repo_id, error as Error, env)
    }
  })
  
  // 分批处理，每批 3 个
  for (let i = 0; i < processPromises.length; i += 3) {
    const batch = processPromises.slice(i, i + 3)
    await Promise.allSettled(batch)
    await delay(1000)  // 批次间休息 1 秒
  }
  
  // 4. 记录指标
  await updateMetrics(successCount, failCount, env)
  
  // 5. 失败率告警
  const totalProcessed = successCount + failCount
  if (totalProcessed > 0 && failCount / totalProcessed > 0.5) {
    await sendAlert(`ETL 失败率过高: ${failCount}/${totalProcessed}`, env)
  }
  
  return rawApps.results.length
}

async function processSingleApp(rawApp: any, env: Env): Promise<void> {
  console.log(`Processing: ${rawApp.full_name}`)
  
  // 1. 解析原始数据
  const repoInfo = JSON.parse(rawApp.raw_api_data)
  
  // 2. 调用 AI 处理
  const aiResult = await callAI({
    readme: rawApp.readme_content,
    repoInfo: repoInfo,
    env: env,
    timeout: 30000  // 30 秒超时
  })
  
  // 3. 验证 AI 结果
  if (!validateAIResult(aiResult)) {
    throw new Error('AI result validation failed')
  }
  
  // 4. 事务性写入
  const appId = generateAppId(rawApp.github_repo_id)
  
  await env.DB.batch([
    // 插入或更新 apps 表
    env.DB.prepare(`
      INSERT OR REPLACE INTO apps (
        id, name, slug, description, full_description, category, tags,
        github_url, github_owner, github_repo, license, homepage_url,
        stars_count, last_updated, status, is_featured
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)
    `).bind(
      appId,
      aiResult.name,
      aiResult.slug,
      aiResult.description,
      aiResult.fullDescription,
      aiResult.category,
      JSON.stringify(aiResult.tags),
      repoInfo.html_url,
      rawApp.full_name.split('/')[0],
      rawApp.full_name.split('/')[1],
      aiResult.license,
      aiResult.homepage || repoInfo.homepage,
      repoInfo.stargazers_count,
      new Date().toISOString()
    ),
    
    // 插入中文翻译
    env.DB.prepare(`
      INSERT OR REPLACE INTO app_translations (
        id, app_id, locale, summary, description, full_description,
        features, use_cases, quick_start_guide, uninstall_guide, caveats,
        translated_by, ai_model_version, quality_score
      ) VALUES (?, ?, 'zh', ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, ?)
    `).bind(
      generateId(),
      appId,
      aiResult.summaryZh,
      aiResult.description,
      aiResult.fullDescription,
      JSON.stringify(aiResult.featuresZh),
      JSON.stringify(aiResult.useCasesZh),
      aiResult.quickStartGuideZh,
      aiResult.uninstallGuideZh,
      aiResult.caveatsZh,
      aiResult.modelVersion,
      aiResult.qualityScore
    ),
    
    // 插入英文翻译
    env.DB.prepare(`
      INSERT OR REPLACE INTO app_translations (
        id, app_id, locale, summary, description, full_description,
        features, use_cases, quick_start_guide, uninstall_guide, caveats,
        translated_by, ai_model_version, quality_score
      ) VALUES (?, ?, 'en', ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, ?)
    `).bind(
      generateId(),
      appId,
      aiResult.summaryEn,
      aiResult.descriptionEn,
      aiResult.fullDescription,
      JSON.stringify(aiResult.featuresEn),
      JSON.stringify(aiResult.useCasesEn),
      aiResult.quickStartGuideEn,
      aiResult.uninstallGuideEn,
      aiResult.caveatsEn,
      aiResult.modelVersion,
      aiResult.qualityScore
    ),
    
    // 更新 raw_apps 状态为 completed
    env.DB.prepare(`
      UPDATE raw_apps 
      SET etl_status = 'completed', 
          last_processed_at = CURRENT_TIMESTAMP,
          quality_score = ?
      WHERE github_repo_id = ?
    `).bind(aiResult.qualityScore, rawApp.github_repo_id)
  ])
  
  console.log(`✅ Processed: ${rawApp.full_name} (quality: ${aiResult.qualityScore})`)
}

async function handleProcessingError(repoId: number, error: Error, env: Env) {
  let newStatus = 'failed'
  
  // 错误分类
  if (error.message.includes('rate limit') || error.message.includes('429')) {
    newStatus = 'rate_limited'
  } else if (error.message.includes('validation') || 
             error.message.includes('invalid') ||
             error.message.includes('missing')) {
    newStatus = 'skipped'  // 数据质量问题，不重试
  }
  
  await env.DB.prepare(`
    UPDATE raw_apps 
    SET etl_status = ?, 
        retry_count = retry_count + 1,
        error_log = ?,
        last_processed_at = CURRENT_TIMESTAMP
    WHERE github_repo_id = ?
  `).bind(
    newStatus,
    error.message.substring(0, 500),
    repoId
  ).run()
  
  console.log(`❌ Failed: repo_id=${repoId}, status=${newStatus}, error=${error.message.substring(0, 100)}`)
}

async function updateMetrics(success: number, failed: number, env: Env) {
  try {
    const existing = await env.KV.get('etl_metrics', 'json')
    const metrics: ETLMetrics = (existing as ETLMetrics) || {
      totalProcessed: 0,
      totalSuccess: 0,
      totalFailed: 0,
      lastRun: null
    }
    
    metrics.totalProcessed += success + failed
    metrics.totalSuccess += success
    metrics.totalFailed += failed
    metrics.lastRun = new Date().toISOString()
    
    await env.KV.put('etl_metrics', JSON.stringify(metrics), {
      expirationTtl: 7 * 24 * 60 * 60  // 保留 7 天
    })
  } catch (error) {
    console.error('Failed to update metrics:', error)
  }
}

async function sendAlert(message: string, env: Env) {
  console.error(`🚨 ALERT: ${message}`)
  
  if (env.ALERT_WEBHOOK_URL) {
    try {
      await fetch(env.ALERT_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `🚨 ETL Alert: ${message}` })
      })
    } catch (error) {
      console.error('Failed to send alert:', error)
    }
  }
}

// ==========================================
// 带超时的处理函数
// ==========================================

async function processWithTimeout(env: Env) {
  const startTime = Date.now()
  const timeout = 14 * 60 * 1000  // 14 分钟（CF Worker 限制 15 分钟）
  
  let batchCount = 0
  while (Date.now() - startTime < timeout) {
    const processed = await processBatch(env)
    if (processed === 0) {
      console.log('No more apps to process')
      break
    }
    batchCount++
    
    // 批次间休息 2 秒
    await delay(2000)
  }
  
  console.log(`ETL completed: ${batchCount} batches processed in ${Date.now() - startTime}ms`)
}

// ==========================================
// Worker 入口
// ==========================================

export default {
  // 定时触发
  async scheduled(controller: ScheduledController, env: Env) {
    console.log('ETL scheduled trigger')
    await processWithTimeout(env)
  },
  
  // HTTP 触发
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    
    // POST /etl/trigger - 手动触发 ETL
    if (url.pathname === '/etl/trigger' && request.method === 'POST') {
      try {
        await processWithTimeout(env)
        return new Response('ETL triggered successfully', { status: 200 })
      } catch (error) {
        return new Response(`ETL failed: ${error}`, { status: 500 })
      }
    }
    
    // GET /etl/metrics - 查看指标
    if (url.pathname === '/etl/metrics') {
      try {
        const metrics = await env.KV.get('etl_metrics')
        return new Response(metrics || '{}', {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(`Failed to get metrics: ${error}`, { status: 500 })
      }
    }
    
    // GET /etl/status - 查看待处理数量
    if (url.pathname === '/etl/status') {
      try {
        const pending = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM raw_apps 
          WHERE etl_status IN ('pending', 'failed', 'rate_limited')
        `).first()
        
        const completed = await env.DB.prepare(`
          SELECT COUNT(*) as count FROM raw_apps 
          WHERE etl_status = 'completed'
        `).first()
        
        return new Response(JSON.stringify({
          pending: pending?.count || 0,
          completed: completed?.count || 0
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      } catch (error) {
        return new Response(`Failed to get status: ${error}`, { status: 500 })
      }
    }
    
    return new Response('Not Found', { status: 404 })
  }
}
