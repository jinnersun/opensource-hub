/**
 * FAQ ETL v3 — 独立 FAQ 处理管线
 *
 * 触发:
 *   processAllPendingFAQs(env): 遍历所有有 raw_faqs(pending) 的 app，逐一处理
 *   在 index.ts 的 scheduled() 中与主 ETL 并行执行
 *
 * 流程:
 *   raw_faqs(pending) → DeepSeek Few-Shot → Post-Filter → Qwen → D1
 */

import type { Env } from './types'
import type { GatewayClient } from './gateway'
import { callDeepSeek, callQwen } from './gateway'

// ==========================================
// 类型
// ==========================================

interface RawFAQ {
  id: number; app_id: string; issue_number: number
  issue_title: string; issue_body: string; issue_url: string
  issue_comments?: string | null; linked_prs?: string | null
}

interface FAQCandidate {
  skip: boolean; skip_reason?: string
  question_en: string; answer_en: string
  seo_keywords: string[]; search_intent: string; confidence_score: number
}

// ==========================================
// Prompt (V3 Few-Shot + Skip)
// ==========================================

const SYSTEM_PROMPT = `You are a Senior SEO and Technical Documentation Expert. Transform GitHub Issues and their discussions into professional FAQ entries targeting Google Search queries.

# Strict Constraints
1. Question MUST be a real user search query or troubleshooting intent.
   BAD: "What bug is described in issue #142?" / "Core issue regarding Docker"
   GOOD: "How to fix 'port already in use' error when deploying via Docker?"
   GOOD: "Why does the app crash on Ubuntu 20.04 with GLIBC error?"

2. Answer MUST focus on the fix or workaround. Include specific commands, versions, steps. Cut fluff.

3. If no workaround or solution exists, output: {"skip": true, "skip_reason": "no solution found"}

# Examples
Ex1: Issue "Build error node 18", Comment: "Use node 16 or upgrade ts-loader to v9"
→ {"skip":false,"question_en":"How to fix compilation error when upgrading to Node 18?","answer_en":"Upgrade \`ts-loader\` to v9+. Or downgrade to Node 16 as temporary workaround.","seo_keywords":["node18","ts-loader","compilation"],"search_intent":"troubleshooting","confidence_score":0.9}

Ex2: Issue "Feature request: dark mode", no solution
→ {"skip":true,"skip_reason":"Feature request without implementation"}

# Output: raw JSON, no markdown fences.`

// ==========================================
// Post-Filter
// ==========================================

function validateFAQ(faq: FAQCandidate): { valid: boolean; reason?: string } {
  if (faq.skip) return { valid: false, reason: `skip: ${faq.skip_reason}` }
  const fluff = [/what is the core/i, /what bug is/i, /issue #\d+/i, /described in/i, /core issue/i]
  if (fluff.some(p => p.test(faq.question_en))) return { valid: false, reason: 'AI fluff' }
  if ((faq.question_en || '').length < 10) return { valid: false, reason: 'Q too short' }
  if ((faq.answer_en || '').length < 30) return { valid: false, reason: 'A too short' }
  if (/does not include a confirmed/i.test(faq.answer_en)) return { valid: false, reason: 'no-solution' }
  if (!/fix|upgrade|downgrade|install|update|configure|change|set |add |remove|replace|run |use |try |workaround|patch|version|flag|option/i.test(faq.answer_en)) return { valid: false, reason: 'no action' }
  return { valid: true }
}

// ==========================================
// 上下文
// ==========================================

function buildContext(issue: RawFAQ): string {
  let ctx = `【Issue #${issue.issue_number}: ${issue.issue_title}】\n${(issue.issue_body || '').slice(0, 4000)}`
  try {
    const comments = JSON.parse(issue.issue_comments || '[]')
    if (Array.isArray(comments)) {
      for (const c of comments.slice(0, 5)) {
        ctx += `\n--- @${c.author || '?'} (👍${c.reactions?.['+1'] || 0}):\n${c.body}`
      }
    }
  } catch { /* */ }
  try {
    const prs = JSON.parse(issue.linked_prs || '[]')
    if (Array.isArray(prs)) {
      for (const pr of prs) {
        ctx += `\n- PR: ${pr.title}` + (pr.body ? `\n  ${pr.body.slice(0, 300)}` : '')
      }
    }
  } catch { /* */ }
  return ctx
}

// ==========================================
// AI 调用
// ==========================================

async function deepseekGenerate(client: GatewayClient, issue: RawFAQ): Promise<FAQCandidate | null> {
  const ctx = buildContext(issue)
  try {
    const content = await callDeepSeek(client, {
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `${ctx}\n\nGenerate FAQ JSON.` },
      ],
      temperature: 0.1, max_tokens: 8000,
    }, 90_000)

    let cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    try { return JSON.parse(cleaned) }
    catch {
      const lc = cleaned.lastIndexOf('",')
      if (lc > 0) { try { return JSON.parse(cleaned.substring(0, lc + 1) + '}') } catch {} }
      console.error(`[FAQ] DS JSON err: ${cleaned.slice(0, 200)}`)
      return null
    }
  } catch (err) {
    console.error(`[FAQ] DS fail:`, (err as Error).message)
    return null
  }
}

async function qwenReview(client: GatewayClient, issue: RawFAQ, faq: FAQCandidate): Promise<{ score: number; has_hallucination: boolean; feedback: string }> {
  const ctx = buildContext(issue)
  const prompt = `Check ONLY for factual fabrications against the source.\n\n【Source】${ctx}\n\n【FAQ】\nQ: ${faq.question_en}\nA: ${faq.answer_en}\n\nReturn JSON: {"score":0-1,"has_hallucination":bool,"feedback":"detail or none"}`
  try {
    const content = await callQwen(client, {
      messages: [
        { role: 'system', content: 'Strict reviewer. Factual accuracy only. Output raw JSON.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.1, max_tokens: 4000,
    }, 30_000)
    let cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    cleaned = cleaned.replace(/"revised_faq"\s*:\s*\{\s*$/, '"revised_faq": {}')
    return JSON.parse(cleaned)
  } catch { return { score: 0, has_hallucination: true, feedback: 'Parse fail' } }
}

// ==========================================
// D1 操作
// ==========================================

async function fetchPendingFAQs(env: Env, appId: string, limit = 10): Promise<RawFAQ[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, app_id, issue_number, issue_title, issue_body, issue_url, issue_comments, linked_prs
     FROM raw_faqs WHERE app_id = ? AND etl_status = 'pending'
     ORDER BY id ASC LIMIT ?`,
  ).bind(appId, limit).all<RawFAQ>()
  return results || []
}

async function fetchAppsWithPendingFAQs(env: Env): Promise<{ id: string; name: string }[]> {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT a.id, a.name FROM apps a
     INNER JOIN raw_faqs rf ON a.id = rf.app_id
     WHERE rf.etl_status = 'pending' AND a.status = 'active'
     ORDER BY a.stars_count DESC`
  ).all<{ id: string; name: string }>()
  return results || []
}

async function insertFAQ(env: Env, appId: string, issue: RawFAQ, faq: FAQCandidate, qwenScore: number, qwenFeedback: string): Promise<void> {
  const faqId = `faq_${appId}_${issue.issue_number}`
  const reviewId = `review_${appId}_${issue.issue_number}`

  await env.DB.batch([
    env.DB.prepare(`INSERT OR REPLACE INTO app_faqs (id, app_id, question_en, answer_en, source_issue_url, source_issue_number, source_issue_title, seo_keywords, search_intent, confidence, status) VALUES (?,?,?,?,?,?,?,?,?,?,'active')`)
      .bind(faqId, appId, faq.question_en, faq.answer_en, issue.issue_url, issue.issue_number, issue.issue_title, JSON.stringify(faq.seo_keywords), faq.search_intent, faq.confidence_score),
    env.DB.prepare(`INSERT OR REPLACE INTO app_faq_translations (id, faq_id, locale, question, answer, translated_at) VALUES (?,'en',?,?,CURRENT_TIMESTAMP)`)
      .bind(`${faqId}_en`, faq.question_en, faq.answer_en),
    env.DB.prepare(`INSERT OR REPLACE INTO app_faq_reviews (id, app_id, issue_number, final_decision, reject_reason, reviewed_at) VALUES (?,?,?,'passed',?,CURRENT_TIMESTAMP)`)
      .bind(reviewId, appId, issue.issue_number, `Qwen score:${qwenScore} ${qwenFeedback}`.slice(0, 500)),
  ])

  for (const l of ['zh', 'ja', 'ko']) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO translation_tasks (app_id, source_table, source_id, source_locale, target_locale, status) VALUES (?,'app_faqs',?,'en',?,'pending')`
    ).bind(appId, faqId, l).run()
  }
}

async function updateRawFAQ(env: Env, id: number, status: string, error?: string): Promise<void> {
  await env.DB.prepare(
    `UPDATE raw_faqs SET etl_status=?, etl_processed_at=CURRENT_TIMESTAMP, error_log=?, retry_count=retry_count+1 WHERE id=?`
  ).bind(status, error?.slice(0, 500) || null, id).run()
}

async function updateAppStats(env: Env, appId: string): Promise<void> {
  const { c } = await env.DB.prepare(
    `SELECT COUNT(*) as c FROM app_faqs WHERE app_id=? AND status='active'`
  ).bind(appId).first<{ c: number }>() || { c: 0 }

  await env.DB.prepare(
    `UPDATE apps SET faq_status='completed', faq_active_count=?, faq_processed_at=CURRENT_TIMESTAMP WHERE id=?`
  ).bind(c || 0, appId).run()
}

// ==========================================
// 处理单个 Issue
// ==========================================

async function processOneFAQ(env: Env, client: GatewayClient, appName: string, raw: RawFAQ): Promise<{ success: boolean; action: string }> {
  console.log(`[FAQ] #${raw.issue_number} ${raw.issue_title.slice(0, 60)}`)

  let faq = await deepseekGenerate(client, raw)
  if (!faq) { await updateRawFAQ(env, raw.id, 'rejected', 'Generation failed'); return { success: false, action: 'reject' } }

  if (faq.skip) {
    console.log(`[FAQ] ⏭️  skip: ${faq.skip_reason}`)
    await updateRawFAQ(env, raw.id, 'rejected', `skip: ${faq.skip_reason}`)
    return { success: false, action: 'skip' }
  }

  const v = validateFAQ(faq)
  if (!v.valid) {
    console.log(`[FAQ] ❌ post-filter: ${v.reason}`)
    await updateRawFAQ(env, raw.id, 'rejected', `filter: ${v.reason}`)
    return { success: false, action: 'reject' }
  }

  console.log(`[FAQ] Q: ${faq.question_en.slice(0, 80)}`)

  // Qwen 评审 + 1 次重试
  let qw: { score: number; has_hallucination: boolean; feedback: string } | null = null
  for (let attempt = 0; attempt <= 1; attempt++) {
    if (attempt > 0) {
      console.log(`[FAQ] 🔄 retry`)
      const retryPrompt = `Fix hallucination:\n${faq.question_en}\n${faq.answer_en}\n\nFeedback: ${qw!.feedback}\nReturn corrected JSON.`
      try {
        const content = await callDeepSeek(client, {
          messages: [{ role: 'system', content: 'Fix hallucination. Output raw JSON.' }, { role: 'user', content: retryPrompt }],
          temperature: 0.05, max_tokens: 8000,
        }, 90_000)
        const cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
        try { faq = JSON.parse(cleaned) } catch {
          const lc = cleaned.lastIndexOf('",'); if (lc > 0) { faq = JSON.parse(cleaned.substring(0, lc + 1) + '}') }
        }
      } catch (e) { console.error(`[FAQ] retry fail:`, (e as Error).message); continue }
    }

    try {
      qw = await qwenReview(client, raw, faq!)
      console.log(`[FAQ] Qwen: ${qw.score} hall=${qw.has_hallucination}`)
      if (!qw.has_hallucination && qw.score >= 0.7) break
      if (attempt === 1) {
        await updateRawFAQ(env, raw.id, 'rejected', `Qwen: ${qw.score} hall:${qw.has_hallucination}`)
        return { success: false, action: 'reject' }
      }
    } catch (e) {
      if (attempt === 1) { await updateRawFAQ(env, raw.id, 'rejected', 'Qwen error'); return { success: false, action: 'reject' } }
    }
  }

  try {
    await insertFAQ(env, raw.app_id, raw, faq!, qw!.score, qw!.feedback)
    await updateRawFAQ(env, raw.id, 'completed')
    console.log(`[FAQ] ✅ → D1`)
    return { success: true, action: 'insert' }
  } catch (e) {
    console.error(`[FAQ] D1 write fail:`, (e as Error).message)
    return { success: false, action: 'reject' }
  }
}

// ==========================================
// 处理所有有 pending FAQ 的 App
// ==========================================

export async function processAllPendingFAQs(env: Env): Promise<{ apps: number; issues: number; succeeded: number; skipped: number }> {
  const client: GatewayClient = {
    account: env.AI_GATEWAY_ACCOUNT || '',
    token: env.AI_GATEWAY_TOKEN || '',
    qwenKey: env.QWEN_API_KEY,
    qwenWorkspace: env.QWEN_WORKSPACE,
  }

  if (!client.account || !client.token) {
    console.log('[FAQ] AI Gateway not configured, skip')
    return { apps: 0, issues: 0, succeeded: 0, skipped: 0 }
  }

  const apps = await fetchAppsWithPendingFAQs(env)
  if (!apps.length) return { apps: 0, issues: 0, succeeded: 0, skipped: 0 }

  console.log(`[FAQ] Processing ${apps.length} apps with pending FAQs`)

  let totalIssues = 0, totalOk = 0, totalSkip = 0

  for (const app of apps.slice(0, 5)) {  // 每次最多 5 个 app，控制单次 invocation 耗时
    const pending = await fetchPendingFAQs(env, app.id, 10)
    if (!pending.length) continue

    console.log(`[FAQ] ${app.name}: ${pending.length} pending`)

    let appOk = 0
    for (const raw of pending) {
      const r = await processOneFAQ(env, client, app.name, raw)
      if (r.success) { totalOk++; appOk++ }
      else if (r.action === 'skip') totalSkip++
      totalIssues++
    }

    if (appOk > 0) {
      await updateAppStats(env, app.id)
    }
  }

  console.log(`[FAQ] done: ${totalIssues} issues → ✅${totalOk} ⏭️${totalSkip}`)
  return { apps: apps.length, issues: totalIssues, succeeded: totalOk, skipped: totalSkip }
}
