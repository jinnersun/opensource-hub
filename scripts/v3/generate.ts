#!/usr/bin/env tsx
/**
 * FAQ ETL v3 — 本地管线版
 *
 * 流程:
 *   Feature Extractor 输出 → DeepSeek Few-Shot 生成 → Qwen 评审 → Post-Filter
 *   产出: data/faqs-{ts}.json
 *
 * 使用:
 *   tsx scripts/etl-v3.ts data/features-xxxxx.json
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ==========================================
// 类型
// ==========================================

interface ScoredIssue {
  issue_number: number; title: string; body: string
  html_url: string; labels: string[]; comments_count: number
  state_reason: string | null; closed_by: string | null
  comments: { body: string; author: string; reactions: Record<string, number> }[]
  linked_prs: { title: string; body: string }[]
  max_comment_reactions: number
  score: number; score_breakdown: string[]
}

interface FAQCandidate {
  skip: boolean; skip_reason?: string
  question_en: string; answer_en: string
  seo_keywords: string[]; search_intent: string; confidence_score: number
}

interface FAQOutput {
  generated_at: string
  source: string
  pipeline: string
  stats: { total_issues: number; deepseek_skipped: number; post_filter_rejected: number; qwen_rejected: number; succeeded: number; api_failed: number }
  faqs: {
    app_id: string; app_name: string
    issue_number: number; issue_title: string; issue_url: string
    question_en: string; answer_en: string
    seo_keywords: string[]; search_intent: string
    qwen_score: number; confidence: number
  }[]
}

// ==========================================
// 配置
// ==========================================

const AI_GATEWAY_ACCOUNT = process.env.AI_GATEWAY_ACCOUNT
const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN
const QWEN_API_KEY = process.env.QWEN_API_KEY
if (!AI_GATEWAY_ACCOUNT || !AI_GATEWAY_TOKEN || !QWEN_API_KEY) {
  console.error('❌ 请设置环境变量: AI_GATEWAY_ACCOUNT, AI_GATEWAY_TOKEN, QWEN_API_KEY')
  process.exit(1)
}

const MAX_RETRIES = 1
const DEEPSEEK_TIMEOUT_MS = 90_000
const DELAY_BETWEEN_ISSUES = 1500

const LOG_FILE = path.join(os.tmpdir(), `etl-v3-${Date.now()}.log`)
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
→ {"skip":false,"question_en":"How to fix compilation error when upgrading to Node 18?","answer_en":"Upgrade \`ts-loader\` to v9+. Or downgrade to Node 16 as temporary workaround.","seo_keywords":["node18","ts-loader","compilation"],"search_intent":"troubleshooting","confidence_score":0.9}

Ex2: Issue "Feature request: dark mode", no solution
→ {"skip":true,"skip_reason":"Feature request without implementation"}

Ex3: Issue "Docker ETXTBSY v5.3.2", Comment: "Downgrade to v5.2.4"
→ {"skip":false,"question_en":"Why does Docker container fail with ETXTBSY error after upgrading to v5.3.2?","answer_en":"Known bug in v5.3.2. Downgrade to v5.2.4:\n\n\`\`\`bash\ndocker pull chibisafe/chibisafe:v5.2.4\n\`\`\`\n\nTrack issue #500 for the permanent fix.","seo_keywords":["docker","etxtbsy","downgrade"],"search_intent":"troubleshooting","confidence_score":0.85}

# Output: raw JSON, no markdown fences.`

// ==========================================
// Post-Filter
// ==========================================

function validateFAQ(faq: FAQCandidate): { valid: boolean; reason?: string } {
  if (faq.skip) return { valid: false, reason: `skip: ${faq.skip_reason}` }

  const aiFluff = [/what is the core/i, /what bug is/i, /issue #\d+/i, /described in/i, /core issue/i]
  if (aiFluff.some(p => p.test(faq.question_en))) return { valid: false, reason: 'AI fluff' }

  if ((faq.question_en || '').length < 10) return { valid: false, reason: 'Q too short' }
  if ((faq.answer_en || '').length < 30) return { valid: false, reason: 'A too short' }
  if (/does not include a confirmed/i.test(faq.answer_en)) return { valid: false, reason: 'no-solution fallback' }

  const hints = /fix|upgrade|downgrade|install|update|configure|change|set |add |remove|replace|run |use |try |workaround|patch|version|flag|option/i
  if (!hints.test(faq.answer_en)) return { valid: false, reason: 'no actionable solution' }

  return { valid: true }
}

// ==========================================
// 上下文构建
// ==========================================

function buildContext(issue: ScoredIssue): string {
  let ctx = `【Issue #${issue.issue_number}: ${issue.title}】\n${(issue.body || '').slice(0, 4000)}`

  if (issue.comments?.length) {
    ctx += '\n\n【Comments】'
    for (const c of issue.comments.slice(0, 5)) {
      ctx += `\n--- @${c.author} (👍${c.reactions?.['+1'] || 0}):\n${c.body}`
    }
  }

  if (issue.linked_prs?.length) {
    ctx += '\n\n【Linked PRs】'
    for (const pr of issue.linked_prs) {
      ctx += `\n- ${pr.title}`
      if (pr.body) ctx += `\n  ${pr.body.slice(0, 300)}`
    }
  }

  return ctx
}

// ==========================================
// AI 调用
// ==========================================

const gwHeaders = { 'Content-Type': 'application/json', 'cf-aig-authorization': `Bearer ${AI_GATEWAY_TOKEN}` }

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function deepseekGenerate(issue: ScoredIssue): Promise<FAQCandidate | null> {
  const ctx = buildContext(issue)
  const url = `https://gateway.ai.cloudflare.com/v1/${AI_GATEWAY_ACCOUNT}/deepseek/deepseek/v1/chat/completions`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS)

  try {
    const resp = await fetch(url, {
      method: 'POST', headers: gwHeaders, signal: controller.signal,
      body: JSON.stringify({
        model: 'deepseek-v4-pro',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: `${ctx}\n\nGenerate FAQ JSON.` },
        ],
        temperature: 0.1, max_tokens: 8000,
      }),
    })
    if (!resp.ok) { console.error(`  DS API ${resp.status}`); return null }
    const data = await resp.json() as any
    const content = data?.choices?.[0]?.message?.content || ''
    let cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    try { return JSON.parse(cleaned) as FAQCandidate }
    catch {
      const lc = cleaned.lastIndexOf('",')
      if (lc > 0) { try { return JSON.parse(cleaned.substring(0, lc + 1) + '}') as FAQCandidate } catch {} }
      console.error(`  DS JSON err: ${cleaned.slice(0, 200)}`); return null
    }
  } finally { clearTimeout(timer) }
}

async function qwenReview(issue: ScoredIssue, faq: FAQCandidate): Promise<{ score: number; has_hallucination: boolean; feedback: string }> {
  const ctx = buildContext(issue)
  const prompt = `Check ONLY for factual fabrications against the source.

【Source】${ctx}

【FAQ】
Q: ${faq.question_en}
A: ${faq.answer_en}

Commands, versions, flags: in source? Solutions: actually present?
Return JSON: {"score":0-1,"has_hallucination":bool,"feedback":"detail or none"}`

  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${QWEN_API_KEY}` },
    body: JSON.stringify({
      model: 'qwen-max', temperature: 0.1, max_tokens: 4000,
      messages: [
        { role: 'system', content: 'Strict reviewer. Factual accuracy only. Output raw JSON.' },
        { role: 'user', content: prompt },
      ],
    }),
  })

  if (!resp.ok) throw new Error(`Qwen ${resp.status}`)
  const data = await resp.json() as any
  const content = data?.choices?.[0]?.message?.content || '{}'
  let cleaned = content.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
  cleaned = cleaned.replace(/"revised_faq"\s*:\s*\{\s*$/, '"revised_faq": {}')
  try { return JSON.parse(cleaned) }
  catch { return { score: 0, has_hallucination: true, feedback: `JSON parse fail: ${cleaned.slice(0, 100)}` } }
}

// ==========================================
// D1 写入
// ==========================================

function esc(s: string): string {
  return s.replace(/'/g, "''").replace(/\\/g, '\\\\')
}

function execWranglerFile(sql: string): any {
  const f = path.join(os.tmpdir(), `faq-d1-${Date.now()}.sql`)
  fs.writeFileSync(f, sql, 'utf-8')
  try {
    const out = execSync(`wrangler d1 execute opensource-hub-db --file "${f}" --remote`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    })
    fs.unlinkSync(f)
    const i = out.indexOf('['); return i < 0 ? null : JSON.parse(out.substring(i))[0]
  } catch (e) { try { fs.unlinkSync(f) } catch {}; throw e }
}

function writeToD1(appId: string, issueNum: number, issueTitle: string, issueUrl: string,
                   faq: FAQCandidate, qwenScore: number, qwenFeedback?: string) {
  const faqId = `faq_${appId}_${issueNum}`
  const title = esc(issueTitle || '')
  const q = esc(faq.question_en)
  const a = esc(faq.answer_en)
  const kw = esc(JSON.stringify(faq.seo_keywords || []))
  const intent = faq.search_intent || 'troubleshooting'
  const conf = faq.confidence_score || 0.8
  const reviewId = `review_${appId}_${issueNum}`
  const feedback = esc((qwenFeedback || '').slice(0, 500))

  const stmts = [
    `INSERT OR REPLACE INTO app_faqs (id, app_id, question_en, answer_en, source_issue_url, source_issue_number, source_issue_title, seo_keywords, search_intent, confidence, status) VALUES ('${faqId}','${appId}','${q}','${a}','${issueUrl}',${issueNum},'${title}','${kw}','${intent}',${conf},'active');`,
    `INSERT OR REPLACE INTO app_faq_translations (id, faq_id, locale, question, answer, translated_at) VALUES ('${faqId}_en','${faqId}','en','${q}','${a}',CURRENT_TIMESTAMP);`,
    `INSERT OR REPLACE INTO app_faq_reviews (id, app_id, issue_number, final_decision, reject_reason, reviewed_at) VALUES ('${reviewId}','${appId}',${issueNum},'passed','Qwen score:${qwenScore} ${feedback}',CURRENT_TIMESTAMP);`,
  ]

  for (const l of ['zh', 'ja', 'ko']) {
    stmts.push(`INSERT OR IGNORE INTO translation_tasks (app_id, source_table, source_id, source_locale, target_locale, status) VALUES ('${appId}','app_faqs','${faqId}','en','${l}','pending');`)
  }

  execWranglerFile(stmts.join('\n'))
}

function updateAppStats(appId: string) {
  try {
    if (appId.startsWith('lib_')) {
      const repoId = appId.replace('lib_', '')
      execSync(`wrangler d1 execute opensource-hub-db --command "UPDATE apps_library SET faq_status='completed', faq_active_count=(SELECT COUNT(*) FROM app_faqs WHERE app_id='${appId}' AND status='active'), faq_processed_at=CURRENT_TIMESTAMP WHERE github_repo_id='${repoId}'" --remote`, {
        encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
      })
    } else {
      execSync(`wrangler d1 execute opensource-hub-db --command "UPDATE apps SET faq_status='completed', faq_active_count=(SELECT COUNT(*) FROM app_faqs WHERE app_id='${appId}' AND status='active'), faq_processed_at=CURRENT_TIMESTAMP WHERE id='${appId}'" --remote`, {
        encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
      })
    }
  } catch { /* */ }
}

// ==========================================
// 处理单个 Issue
// ==========================================

async function processOne(appId: string, appName: string, issue: ScoredIssue): Promise<FAQOutput['faqs'][0] | null> {
  const num = issue.issue_number
  const title = issue.title.slice(0, 70)
  console.log(`  [#${num}] ${title}`)

  // DeepSeek 生成
  let faq = await deepseekGenerate(issue)
  if (!faq) { console.log(`    ❌ API fail`); return null }

  // Skip 检查
  if (faq.skip) { console.log(`    ⏭️  skip: ${faq.skip_reason}`); return null }

  // Post-filter
  const v = validateFAQ(faq)
  if (!v.valid) { console.log(`    ❌ post-filter: ${v.reason}`); return null }

  console.log(`    Q: ${faq.question_en.slice(0, 70)}...`)

  // Qwen 评审 + 重试
  let qwResult: { score: number; has_hallucination: boolean; feedback: string } | null = null
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`    🔄 retry...`)
      const retryPrompt = `Fix hallucination issues from reviewer feedback:\n${faq.question_en}\n${faq.answer_en}\n\nReviewer said: the FAQ should only contain facts from the source. Return corrected JSON.`
      const url = `https://gateway.ai.cloudflare.com/v1/${AI_GATEWAY_ACCOUNT}/deepseek/deepseek/v1/chat/completions`
      const resp = await fetch(url, { method: 'POST', headers: gwHeaders, body: JSON.stringify({ model: 'deepseek-v4-pro', messages: [{ role: 'system', content: 'Fix hallucination. Output raw JSON.' }, { role: 'user', content: retryPrompt }], temperature: 0.05, max_tokens: 8000 }) })
      if (resp.ok) {
        const data = await resp.json() as any
        const text = data?.choices?.[0]?.message?.content || ''
        const cleaned = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
        try { faq = JSON.parse(cleaned) as FAQCandidate } catch {
          const lc = cleaned.lastIndexOf('",')
          if (lc > 0) { try { faq = JSON.parse(cleaned.substring(0, lc + 1) + '}') as FAQCandidate } catch {} }
        }
      } else { await delay(2000); continue }
    }

    try {
      qwResult = await qwenReview(issue, faq!)
      console.log(`    Qwen: ${qwResult.score} hall=${qwResult.has_hallucination} ${(qwResult.feedback || '').slice(0, 60)}`)
      if (!qwResult.has_hallucination && qwResult.score >= 0.7) break
      if (attempt === MAX_RETRIES) return null
    } catch (e: any) {
      console.error(`    Qwen err: ${e.message?.slice(0, 60)}`)
      if (attempt === MAX_RETRIES) return null
      await delay(2000)
    }
  }

  // 写入 D1
  try {
    writeToD1(appId, num, issue.title, issue.html_url, faq!, qwResult!.score, qwResult!.feedback)
    console.log(`    ✅ → D1`)
  } catch (e: any) {
    console.error(`    ❌ D1 write: ${e.message?.slice(0, 100)}`)
    return null
  }

  return {
    app_id: appId, app_name: appName,
    issue_number: num, issue_title: issue.title, issue_url: issue.html_url,
    question_en: faq!.question_en, answer_en: faq!.answer_en,
    seo_keywords: faq!.seo_keywords, search_intent: faq!.search_intent,
    qwen_score: qwResult!.score, confidence: faq!.confidence_score,
  }
}

// ==========================================
// 入口
// ==========================================

async function main() {
  const inputPath = process.argv[2]
  if (!inputPath) { console.log('用法: tsx scripts/etl-v3.ts data/features-xxxxx.json'); process.exit(1) }

  console.log('🤖 FAQ ETL v3 — 本地管线')
  console.log(`📄 输入: ${inputPath}\n`)

  const features = JSON.parse(fs.readFileSync(inputPath, 'utf-8'))
  const stats = { total_issues: 0, deepseek_skipped: 0, post_filter_rejected: 0, qwen_rejected: 0, succeeded: 0, api_failed: 0 }

  const output: FAQOutput = {
    generated_at: new Date().toISOString(),
    source: inputPath,
    pipeline: 'Features → DeepSeek Few-Shot → Post-Filter → Qwen Review',
    stats,
    faqs: [],
  }

  let idx = 0
  const updatedApps = new Set<string>()
  for (const app of features.apps) {
    console.log(`\n📦 ${app.name} (${app.issues.length} issues)`)
    for (const issue of app.issues) {
      idx++
      console.log(`[${idx}/${features.passed_count}]`)
      stats.total_issues++
      const result = await processOne(app.app_id, app.name, issue)
      if (result) {
        output.faqs.push(result)
        stats.succeeded++
        if (!updatedApps.has(app.app_id)) {
          updateAppStats(app.app_id)
          updatedApps.add(app.app_id)
        }
      } else {
        stats.api_failed++
      }
      await delay(DELAY_BETWEEN_ISSUES)
    }
  }

  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const outDir = path.join(__dirname, 'data'); fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `faqs-${ts}.json`)
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8')

  console.log(`\n${'='.repeat(60)}`)
  console.log(`🎉 ETL 完成`)
  console.log(`   处理 ${stats.total_issues} → ✅ ${stats.succeeded} (${Math.round(stats.succeeded / Math.max(1, stats.total_issues) * 100)}%)`)
  console.log(`📄 ${outPath}`)
  console.log(`${'='.repeat(60)}`)
}

main()
