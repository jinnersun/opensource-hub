#!/usr/bin/env tsx
/**
 * FAQ ETL v3 — 从 raw_faqs (D1) 读取 pending → AI → 写入 D1
 *
 * 使用:
 *   tsx scripts/v3/generate.ts --sample     # 前 50 条
 *   tsx scripts/v3/generate.ts --all        # 全量
 *   tsx scripts/v3/generate.ts --app-id=xxx
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ==========================================
// 类型
// ==========================================

interface RawFAQ {
  id: number; app_id: string; issue_number: number; issue_title: string; issue_body: string
  issue_url: string; issue_comments?: string | null; linked_prs?: string | null
}
interface FAQCandidate {
  skip: boolean; skip_reason?: string
  question_en: string; answer_en: string
  seo_keywords: string[]; search_intent: string; confidence_score: number
}

// ==========================================
// 配置
// ==========================================

const AI_GATEWAY_ACCOUNT = process.env.AI_GATEWAY_ACCOUNT
const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN
const QWEN_API_KEY = process.env.QWEN_API_KEY
if (!AI_GATEWAY_ACCOUNT || !AI_GATEWAY_TOKEN || !QWEN_API_KEY) {
  console.error('Please set AI_GATEWAY_ACCOUNT, AI_GATEWAY_TOKEN, QWEN_API_KEY')
  process.exit(1)
}

const MAX_FAQS_PER_APP = 50
const SAMPLE_SIZE = 50
const DEEPSEEK_TIMEOUT_MS = 90_000
const DELAY_BETWEEN_ISSUES = 1500

const LOG_FILE = path.join(os.tmpdir(), 'faq-etl-v3-' + String(Date.now()) + '.log')
const origLog = console.log; const origErr = console.error
console.log = (...args: any[]) => { const s = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '); origLog(s); try { fs.appendFileSync(LOG_FILE, s + '\n', 'utf-8') } catch {} }
console.error = (...args: any[]) => { const s = args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' '); origErr(s); try { fs.appendFileSync(LOG_FILE, '[ERR] ' + s + '\n', 'utf-8') } catch {} }

// ==========================================
// Prompt
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
→ {"skip":false,"question_en":"How to fix compilation error when upgrading to Node 18?","answer_en":"Upgrade ts-loader to v9+. Or downgrade to Node 16 as temporary workaround.","seo_keywords":["node18","ts-loader","compilation"],"search_intent":"troubleshooting","confidence_score":0.9}

Ex2: Issue "Feature request: dark mode", no solution
→ {"skip":true,"skip_reason":"Feature request without implementation"}

Ex3: Issue "Docker ETXTBSY v5.3.2", Comment: "Downgrade to v5.2.4"
→ {"skip":false,"question_en":"Why does Docker container fail with ETXTBSY error after upgrading to v5.3.2?","answer_en":"Known bug in v5.3.2. Downgrade to v5.2.4. Track issue #500 for the permanent fix.","seo_keywords":["docker","etxtbsy","downgrade"],"search_intent":"troubleshooting","confidence_score":0.85}

# Output: raw JSON, no markdown fences.`

// ==========================================
// Post-Filter
// ==========================================

function validateFAQ(faq: FAQCandidate): { valid: boolean; reason?: string } {
  if (faq.skip) return { valid: false, reason: 'skip: ' + (faq.skip_reason || '') }
  const fluff = [/what is the core/i, /what bug is/i, /issue #\d+/i, /described in/i, /core issue/i]
  if (fluff.some(p => p.test(faq.question_en))) return { valid: false, reason: 'AI fluff' }
  if ((faq.question_en || '').length < 10) return { valid: false, reason: 'Q too short' }
  if ((faq.answer_en || '').length < 30) return { valid: false, reason: 'A too short' }
  if (/does not include a confirmed/i.test(faq.answer_en)) return { valid: false, reason: 'no-solution' }
  if (!/fix|upgrade|downgrade|install|update|configure|change|set |add |remove|replace|run |use |try |workaround|patch|version|flag|option/i.test(faq.answer_en)) return { valid: false, reason: 'no action' }
  return { valid: true }
}

// ==========================================
// D1 读写
// ==========================================

function esc(s: string): string { return s.replace(/'/g, "''").replace(/\\/g, '\\\\') }

function execWranglerQuery(q: string): any {
  const out = execSync('wrangler d1 execute opensource-hub-db --command "' + q + '" --remote', {
    encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  })
  try { const i = out.indexOf('['); return i < 0 ? null : JSON.parse(out.substring(i))[0] }
  catch { return null }
}

function execWranglerFile(sql: string): void {
  const f = path.join(os.tmpdir(), 'faq-d1-' + String(Date.now()) + '.sql')
  fs.writeFileSync(f, sql, 'utf-8')
  try {
    execSync('wrangler d1 execute opensource-hub-db --file "' + f + '" --remote', {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    })
  } finally { try { fs.unlinkSync(f) } catch {} }
}

async function getPendingFAQs(appId: string): Promise<RawFAQ[]> {
  return execWranglerQuery("SELECT id, app_id, issue_number, issue_title, issue_body, issue_url, issue_comments, linked_prs FROM raw_faqs WHERE app_id='" + appId + "' AND etl_status='pending' ORDER BY id ASC LIMIT " + MAX_FAQS_PER_APP)?.results || []
}

async function getPendingAppIds(): Promise<{ app_id: string; count: number }[]> {
  return execWranglerQuery("SELECT app_id, COUNT(*) as count FROM raw_faqs WHERE etl_status='pending' GROUP BY app_id ORDER BY count DESC")?.results || []
}

function updateRawFAQStatus(id: number, status: string, error?: string) {
  const err = error ? "'" + esc(error).slice(0, 500) + "'" : 'NULL'
  execSync("wrangler d1 execute opensource-hub-db --command \"UPDATE raw_faqs SET etl_status='" + status + "', etl_processed_at=CURRENT_TIMESTAMP, error_log=" + err + ", retry_count=retry_count+1 WHERE id=" + id + '" --remote', {
    encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  })
}

function writeFAQToD1(appId: string, issue: RawFAQ, faq: FAQCandidate, qwenScore: number, qwenFeedback?: string) {
  const faqId = 'faq_' + appId + '_' + issue.issue_number
  const title = esc(issue.issue_title)
  const q = esc(faq.question_en)
  const a = esc(faq.answer_en)
  const kw = esc(JSON.stringify(faq.seo_keywords || []))
  const intent = faq.search_intent || 'troubleshooting'
  const conf = faq.confidence_score || 0.8
  const reviewId = 'review_' + appId + '_' + issue.issue_number
  const feedback = esc((qwenFeedback || '').slice(0, 500))

  const stmts = [
    "INSERT OR REPLACE INTO app_faqs (id, app_id, question_en, answer_en, source_issue_url, source_issue_number, source_issue_title, seo_keywords, search_intent, confidence, status) VALUES ('" + faqId + "','" + appId + "','" + q + "','" + a + "','" + issue.issue_url + "'," + issue.issue_number + ",'" + title + "','" + kw + "','" + intent + "'," + conf + ",'active');",
    "INSERT OR REPLACE INTO app_faq_translations (id, faq_id, locale, question, answer, translated_at) VALUES ('" + faqId + "_en','" + faqId + "','en','" + q + "','" + a + "',CURRENT_TIMESTAMP);",
    "INSERT OR REPLACE INTO app_faq_reviews (id, app_id, issue_number, final_decision, reject_reason, reviewed_at) VALUES ('" + reviewId + "','" + appId + "'," + issue.issue_number + ",'passed','Qwen score:" + qwenScore + " " + feedback + "',CURRENT_TIMESTAMP);",
  ]
  for (const l of ['zh', 'ja', 'ko']) {
    stmts.push("INSERT OR IGNORE INTO translation_tasks (app_id, source_table, source_id, source_locale, target_locale, status) VALUES ('" + appId + "','app_faqs','" + faqId + "','en','" + l + "','pending');")
  }
  execWranglerFile(stmts.join('\n'))
}

function updateAppStats(appId: string) {
  try {
    if (appId.startsWith('lib_')) {
      const repoId = appId.replace('lib_', '')
      execSync("wrangler d1 execute opensource-hub-db --command \"UPDATE apps_library SET faq_status='completed', faq_active_count=(SELECT COUNT(*) FROM app_faqs WHERE app_id='" + appId + "' AND status='active'), faq_processed_at=CURRENT_TIMESTAMP WHERE github_repo_id='" + repoId + "'\" --remote", { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    } else {
      execSync("wrangler d1 execute opensource-hub-db --command \"UPDATE apps SET faq_status='completed', faq_active_count=(SELECT COUNT(*) FROM app_faqs WHERE app_id='" + appId + "' AND status='active'), faq_processed_at=CURRENT_TIMESTAMP WHERE id='" + appId + "'\" --remote", { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
    }
  } catch { /* */ }
}

// ==========================================
// 上下文构建
// ==========================================

function buildContext(issue: RawFAQ): string {
  let ctx = '【Issue #' + issue.issue_number + ': ' + issue.issue_title + '】\n' + (issue.issue_body || '').slice(0, 4000)
  try {
    const comments = JSON.parse(issue.issue_comments || '[]')
    for (const c of comments.slice(0, 5)) {
      ctx += '\n--- @' + (c.author || '?') + ' (+1 ' + (c.reactions?.['+1'] || 0) + '):\n' + c.body
    }
  } catch {}
  try {
    const prs = JSON.parse(issue.linked_prs || '[]')
    for (const pr of prs) {
      ctx += '\n- PR: ' + pr.title + (pr.body ? '\n  ' + pr.body.slice(0, 300) : '')
    }
  } catch {}
  return ctx
}

// ==========================================
// AI 调用
// ==========================================

const gwHeaders = { 'Content-Type': 'application/json', 'cf-aig-authorization': 'Bearer ' + AI_GATEWAY_TOKEN }
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function deepseekGenerate(issue: RawFAQ): Promise<FAQCandidate | null> {
  const ctx = buildContext(issue)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS)
  try {
    const resp = await fetch('https://gateway.ai.cloudflare.com/v1/' + AI_GATEWAY_ACCOUNT + '/deepseek/deepseek/v1/chat/completions', {
      method: 'POST', headers: gwHeaders, signal: controller.signal,
      body: JSON.stringify({ model: 'deepseek-v4-pro', messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: ctx + '\n\nGenerate FAQ JSON.' }], temperature: 0.1, max_tokens: 8000 }),
    })
    if (!resp.ok) { console.error('  DS API ' + resp.status); return null }
    const data = await resp.json() as any
    const content = data?.choices?.[0]?.message?.content || ''
    let cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    try { return JSON.parse(cleaned) }
    catch {
      const lc = cleaned.lastIndexOf('",')
      if (lc > 0) { try { return JSON.parse(cleaned.substring(0, lc + 1) + '}') } catch {} }
      console.error('  DS JSON err: ' + cleaned.slice(0, 200)); return null
    }
  } finally { clearTimeout(timer) }
}

async function qwenReview(issue: RawFAQ, faq: FAQCandidate): Promise<{ score: number; has_hallucination: boolean; feedback: string }> {
  const ctx = buildContext(issue)
  const prompt = 'Check ONLY for factual fabrications.\n\n【Source】' + ctx + '\n\n【FAQ】\nQ: ' + faq.question_en + '\nA: ' + faq.answer_en + '\n\nReturn JSON: {"score":0-1,"has_hallucination":bool,"feedback":"detail or none"}'
  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + QWEN_API_KEY },
    body: JSON.stringify({ model: 'qwen-max', temperature: 0.1, max_tokens: 4000, messages: [{ role: 'system', content: 'Strict reviewer. Output raw JSON.' }, { role: 'user', content: prompt }] }),
  })
  if (!resp.ok) throw new Error('Qwen ' + resp.status)
  const data = await resp.json() as any
  const content = data?.choices?.[0]?.message?.content || '{}'
  let cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  cleaned = cleaned.replace(/"revised_faq"\s*:\s*\{\s*$/, '"revised_faq": {}')
  try { return JSON.parse(cleaned) }
  catch { return { score: 0, has_hallucination: true, feedback: 'JSON parse fail' } }
}

// ==========================================
// 处理单个 Issue
// ==========================================

async function processOneIssue(appId: string, appName: string, rawId: number, issue: RawFAQ): Promise<{ success: boolean; action: string }> {
  const num = issue.issue_number
  console.log('  [#' + num + '] ' + issue.issue_title.slice(0, 70))

  let faq = await deepseekGenerate(issue)
  if (!faq) { await updateRawFAQStatus(rawId, 'failed', 'Generation failed'); return { success: false, action: 'reject' } }

  if (faq.skip) {
    console.log('    skip: ' + (faq.skip_reason || ''))
    await updateRawFAQStatus(rawId, 'rejected', 'skip: ' + (faq.skip_reason || ''))
    return { success: false, action: 'skip' }
  }

  const v = validateFAQ(faq)
  if (!v.valid) {
    console.log('    post-filter: ' + (v.reason || ''))
    await updateRawFAQStatus(rawId, 'rejected', 'filter: ' + (v.reason || ''))
    return { success: false, action: 'reject' }
  }

  console.log('    Q: ' + faq.question_en.slice(0, 70) + '...')

  // Qwen 评审
  let qwResult: { score: number; has_hallucination: boolean; feedback: string } | null = null
  try {
    qwResult = await qwenReview(issue, faq)
    console.log('    Qwen: ' + qwResult.score + ' hall=' + qwResult.has_hallucination + ' ' + (qwResult.feedback || '').slice(0, 60))
  } catch (e: any) {
    console.error('    Qwen err: ' + (e.message || '').slice(0, 60))
  }

  // Qwen 不通过 → 重试：带原始上下文 + 被拒 FAQ + Qwen 反馈
  if (qwResult && (qwResult.has_hallucination || qwResult.score < 0.7)) {
    console.log('    retry...')
    const ctx = buildContext(issue)
    const retryPrompt = `Your previous FAQ was rejected by a reviewer. Fix ALL the issues mentioned in the feedback.

【Original Issue + Comments + PRs】
${ctx}

【Your Rejected FAQ】
Q: ${faq.question_en}
A: ${faq.answer_en}

【Reviewer Feedback】
${qwResult.feedback}

# Output Example
{"question_en":"How to fix port conflict error in Docker?","answer_en":"Run docker ps to find the conflicting container, stop it with docker stop, then restart.","seo_keywords":["docker","port","conflict"],"search_intent":"troubleshooting","confidence_score":0.9}

Return ONLY the JSON object. No markdown, no explanation.`

    const url = 'https://gateway.ai.cloudflare.com/v1/' + AI_GATEWAY_ACCOUNT + '/deepseek/deepseek/v1/chat/completions'
    const resp = await fetch(url, { method: 'POST', headers: gwHeaders, body: JSON.stringify({ model: 'deepseek-v4-pro', messages: [{ role: 'system', content: 'You fix reviewer-rejected FAQ entries. Output ONLY valid JSON, no markdown.' }, { role: 'user', content: retryPrompt }], temperature: 0.05, max_tokens: 8000 }) })
    if (resp.ok) {
      let retryFaq: FAQCandidate | null = null
      const data = await resp.json() as any
      const text = data?.choices?.[0]?.message?.content || ''
      const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
      try { retryFaq = JSON.parse(cleaned) } catch {
        const lc = cleaned.lastIndexOf('",'); if (lc > 0) { try { retryFaq = JSON.parse(cleaned.substring(0, lc + 1) + '}') } catch {} }
      }

      if (retryFaq?.question_en && retryFaq?.answer_en) {
        faq = retryFaq
        const v2 = validateFAQ(faq)
        if (v2.valid) {
          try {
            qwResult = await qwenReview(issue, faq)
            console.log('    Qwen(after retry): ' + qwResult.score + ' hall=' + qwResult.has_hallucination + ' ' + (qwResult.feedback || '').slice(0, 60))
          } catch { /* keep old qwResult */ }
        } else {
          console.log('    retry failed post-filter: ' + (v2.reason || ''))
        }
      } else {
        console.log('    retry JSON parse failed, keeping original FAQ')
      }
    } else {
      console.log('    retry API failed, keeping original FAQ')
    }
  }

  // 最终判断
  if (!faq?.question_en || !faq?.answer_en) {
    await updateRawFAQStatus(rawId, 'rejected', 'Invalid FAQ')
    return { success: false, action: 'reject' }
  }

  if (!qwResult || qwResult.has_hallucination || qwResult.score < 0.7) {
    await updateRawFAQStatus(rawId, 'rejected', 'Qwen: score=' + (qwResult?.score || 0) + ' hall=' + (qwResult?.has_hallucination || false))
    return { success: false, action: 'reject' }
  }

  try {
    writeFAQToD1(appId, issue, faq, qwResult.score, qwResult.feedback)
    await updateRawFAQStatus(rawId, 'completed')
    console.log('    -> D1')
    return { success: true, action: 'insert' }
  } catch (e: any) {
    console.error('    D1: ' + (e.message || '').slice(0, 100))
    return { success: false, action: 'reject' }
  }
}

// ==========================================
// 项目级处理
// ==========================================

async function processApp(app: { id: string; name: string }) {
  console.log('\n' + app.name + ' (' + app.id + ')')
  const pending = await getPendingFAQs(app.id)
  if (!pending.length) { console.log('  no pending'); return { processed: 0, succeeded: 0, skipped: 0 } }
  console.log('  ' + pending.length + ' pending')
  let ok = 0, skipped = 0, failed = 0
  for (let i = 0; i < pending.length; i++) {
    const r = await processOneIssue(app.id, app.name, pending[i].id, pending[i])
    if (r.action === 'insert') ok++; else if (r.action === 'skip') skipped++; else failed++
    if (ok === 1) updateAppStats(app.id)
    if (i < pending.length - 1) await delay(DELAY_BETWEEN_ISSUES)
  }
  console.log('  ok=' + ok + ' skip=' + skipped + ' fail=' + failed)
  return { processed: pending.length, succeeded: ok, skipped }
}

// ==========================================
// 入口
// ==========================================

async function main() {
  const args = process.argv.slice(2)
  const sample = args.includes('--sample'), all = args.includes('--all')
  const appId = args.find(a => a.startsWith('--app-id='))?.split('=')[1]

  if (!sample && !all && !appId) { console.log('Usage: --sample | --all | --app-id=xxx'); process.exit(1) }

  console.log('FAQ ETL v3 -> D1')
  console.log('Mode: ' + (sample ? 'sample(' + SAMPLE_SIZE + ')' : all ? 'all' : 'app=' + appId) + '\n')

  let appEntries: { app_id: string; count: number }[] = []
  if (appId) {
    appEntries = [{ app_id: appId, count: 0 }]
  } else {
    appEntries = await getPendingAppIds()
    if (sample) appEntries = appEntries.slice(0, SAMPLE_SIZE)
  }
  console.log(appEntries.length + ' apps with pending raw_faqs\n')

  let tp = 0, ts = 0, tskip = 0
  for (let i = 0; i < appEntries.length; i++) {
    const entry = appEntries[i]
    console.log('[' + (i + 1) + '/' + appEntries.length + '] ' + entry.app_id + ' (' + entry.count + ' pending)')
    try {
      const s = await processApp({ id: entry.app_id, name: entry.app_id })
      tp += s.processed; ts += s.succeeded; tskip += s.skipped
      if (i < appEntries.length - 1) { console.log('\n...3s...'); await delay(3000) }
    } catch (e: any) { console.error('ERR ' + entry.app_id + ': ' + (e.message || '').slice(0, 200)) }
  }
  console.log('\n============================================================')
  console.log('Done! Issues:' + tp + ' OK:' + ts + ' Skip:' + tskip)
  console.log('============================================================')
}

main()
