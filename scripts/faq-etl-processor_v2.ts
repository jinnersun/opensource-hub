#!/usr/bin/env tsx
/**
 * FAQ ETL 处理脚本 v2
 *
 * v2 变更:
 * - Stage 1: DeepSeek v4-pro 生成 FAQ (严格Prompt, 减少幻觉)
 * - Stage 2: Qwen 单评审 (含 hallucination 一票否决)
 * - 不通过 → 反馈+原始数据打包发给 DeepSeek 重试 (max 2)
 * - 评审数据写入 app_faq_reviews
 *
 * 使用:
 *   tsx scripts/faq-etl-processor_v2.ts --test
 *   tsx scripts/faq-etl-processor_v2.ts --all
 *   tsx scripts/faq-etl-processor_v2.ts --app-id=xxx
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

// ==========================================
// 类型
// ==========================================
interface App { id: string; name: string; github_owner: string; github_repo: string; full_description: string | null }
interface RawFAQ { id: number; app_id: string; issue_number: number; issue_title: string; issue_body: string; issue_state: 'open'|'closed'; issue_labels: string; comments_count: number; issue_url: string }
interface FAQCandidate { question_en: string; answer_en: string; seo_keywords: string[]; search_intent: 'how-to'|'troubleshooting'|'comparison'|'configuration'; confidence_score: number }
interface ReviewOutput { score: number; has_hallucination: boolean; feedback: string; revised_faq?: { question: string; answer: string } }

// ==========================================
// 配置
// ==========================================
const AI_GATEWAY_ACCOUNT = process.env.AI_GATEWAY_ACCOUNT
const AI_GATEWAY_TOKEN = process.env.AI_GATEWAY_TOKEN
const QWEN_API_KEY = process.env.QWEN_API_KEY

if (!AI_GATEWAY_ACCOUNT || !AI_GATEWAY_TOKEN || !QWEN_API_KEY) {
  console.error('❌ 缺少环境变量: AI_GATEWAY_ACCOUNT, AI_GATEWAY_TOKEN, QWEN_API_KEY')
  process.exit(1)
}

const MAX_FAQS_PER_APP = 50
const DELAY_BETWEEN_ISSUES = 2000
const DELAY_ON_ERROR = 5000
const MAX_RETRIES = 2
// 双写日志: console + 文件
const LOG_FILE = path.join(os.tmpdir(), `faq-etl-v2-${new Date().toISOString().replace(/[:.]/g,'-')}.log`)
const origLog = console.log, origErr = console.error
console.log = (...args: any[]) => { const s = args.map(a=>typeof a==='string'?a:JSON.stringify(a)).join(' '); origLog(s); try { fs.appendFileSync(LOG_FILE, s+'\n','utf-8') } catch {} }
console.error = (...args: any[]) => { const s = args.map(a=>typeof a==='string'?a:JSON.stringify(a)).join(' '); origErr(s); try { fs.appendFileSync(LOG_FILE, '[ERROR] '+s+'\n','utf-8') } catch {} }
origLog(`📝 日志文件: ${LOG_FILE}`)

// ==========================================
// D1 辅助
// ==========================================
function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function execWrangler(command: string): any {
  const isWrite = command.includes('INSERT') || command.includes('UPDATE') || command.includes('DELETE')
  if (isWrite) return execWranglerFile(command)
  const output = execSync(`wrangler d1 execute opensource-hub-db --command "${command}" --remote`, { encoding:'utf-8', stdio:['pipe','pipe','pipe'] })
  try { const i = output.indexOf('['); if (i<0) return null; return JSON.parse(output.substring(i))[0] }
  catch { return null }
}
function execWranglerFile(sql: string): any {
  const f = path.join(os.tmpdir(), `faq-etl-${Date.now()}.sql`)
  fs.writeFileSync(f, sql, 'utf-8')
  try { const out = execSync(`wrangler d1 execute opensource-hub-db --file "${f}" --remote`, { encoding:'utf-8', stdio:['pipe','pipe','pipe'] }); fs.unlinkSync(f); const i = out.indexOf('['); return i<0 ? null : JSON.parse(out.substring(i))[0] }
  catch (e) { try { fs.unlinkSync(f) } catch {}; throw e }
}

// ==========================================
// D1 查询
// ==========================================
async function getPendingFAQs(appId: string, limit = 50): Promise<RawFAQ[]> {
  const r = execWrangler(`SELECT id, app_id, issue_number, issue_title, issue_body, issue_state, issue_labels, comments_count, issue_url FROM raw_faqs WHERE app_id='${appId}' AND etl_status='pending' ORDER BY id ASC LIMIT ${limit}`)
  return r?.results || []
}
async function getAllAppsWithPendingFAQs(): Promise<App[]> {
  const r = execWrangler(`SELECT DISTINCT a.id, a.name, a.github_owner, a.github_repo, a.full_description FROM apps a INNER JOIN raw_faqs rf ON a.id = rf.app_id WHERE rf.etl_status='pending' AND a.status='active'`)
  console.log(`查询到 ${r?.results?.length || 0} 个项目`)
  return r?.results || []
}
async function getAppById(appId: string): Promise<App|null> {
  const r = execWrangler(`SELECT id, name, github_owner, github_repo, full_description FROM apps WHERE id='${appId}'`)
  return r?.results?.[0] || null
}
async function insertFAQ(appId: string, issue: RawFAQ, faq: FAQCandidate, avgScore: number): Promise<string> {
  const faqId = `faq_${appId}_${issue.issue_number}`
  const title = (issue.issue_title || '').replace(/'/g, "''")
  const q = faq.question_en.replace(/'/g, "''")
  const a = faq.answer_en.replace(/'/g, "''")
  const kw = JSON.stringify(faq.seo_keywords).replace(/'/g, "''")
  execWranglerFile(`INSERT OR REPLACE INTO app_faqs (id, app_id, question_en, answer_en, source_issue_url, source_issue_number, source_issue_title, seo_keywords, search_intent, confidence, status, issue_state) VALUES ('${faqId}','${appId}','${q}','${a}','${issue.issue_url}',${issue.issue_number},'${title}','${kw}','${faq.search_intent}',${avgScore},'translating','${issue.issue_state}')`)
  return faqId
}
async function insertFAQTranslation(faqId: string, faq: FAQCandidate) {
  const q = faq.question_en.replace(/'/g, "''")
  const a = faq.answer_en.replace(/'/g, "''")
  execWranglerFile(`INSERT OR REPLACE INTO app_faq_translations (id, faq_id, locale, question, answer, translated_at) VALUES ('${faqId}_en','${faqId}','en','${q}','${a}',CURRENT_TIMESTAMP)`)
}
async function createTranslationTasks(appId: string, faqId: string) {
  const lines = ['zh','ja','ko'].map(l => `INSERT OR IGNORE INTO translation_tasks (app_id, source_table, source_id, source_locale, target_locale, status) VALUES ('${appId}','app_faqs','${faqId}','en','${l}','pending');`)
  execWranglerFile(lines.join('\n'))
}
async function updateRawFAQ(id: number, status: string, errorLog?: string) {
  const err = errorLog ? `'${errorLog.replace(/'/g,"''").slice(0,500)}'` : 'NULL'
  execWrangler(`UPDATE raw_faqs SET etl_status='${status}', etl_processed_at=CURRENT_TIMESTAMP, error_log=${err}, retry_count=retry_count+1 WHERE id=${id}`)
}
async function insertReviewRecord(appId: string, issueNumber: number, decision: string, reason?: string) {
  const rid = `review_${appId}_${issueNumber}`
  const r = reason ? `'${reason.replace(/'/g,"''").slice(0,500)}'` : 'NULL'
  execWranglerFile(`INSERT OR REPLACE INTO app_faq_reviews (id, app_id, issue_number, final_decision, reject_reason, reviewed_at) VALUES ('${rid}','${appId}',${issueNumber},'${decision}',${r},CURRENT_TIMESTAMP)`)
}

// ==========================================
// AI 调用
// ==========================================
const gwHeaders = { 'Content-Type': 'application/json', 'cf-aig-authorization': `Bearer ${AI_GATEWAY_TOKEN}` }

// DeepSeek v4-pro 生成 FAQ (Stage 1)
async function deepseekGenerate(issue: RawFAQ, appName: string): Promise<FAQCandidate | null> {
  const isClosed = issue.issue_state === 'closed'
  const body = (issue.issue_body || '').slice(0, 4000)
  const title = issue.issue_title || `Issue #${issue.issue_number}`
  const systemPrompt = isClosed
    ? 'You are an expert technical writer. Extract ONLY facts explicitly stated in the Issue. CRITICAL: Do NOT invent version numbers, function names, line numbers, keyboard shortcuts, alternative actions, or solutions not mentioned. If no solution exists, answer: "The GitHub Issue does not include a confirmed solution. See the original Issue for updates."'
    : 'You are a bug analyst. Describe ONLY what the Issue states. Do NOT claim maintainer confirmation unless explicitly written. Do NOT fabricate workarounds.'

  const prompt = `GitHub Issue #${issue.issue_number}: ${title}\n\n${body}\n\nProject: ${appName}
${isClosed ? `Return FAQ JSON. Question: core issue. Answer: ONLY solutions from Issue.` : `Return bug summary JSON. 1) Bug 2) Trigger 3) Any workaround in Issue.`}
Format: {"question_en":"...","answer_en":"...","seo_keywords":["kw1","kw2","kw3"],"search_intent":"troubleshooting","confidence_score":0.9}`

  const url = `https://gateway.ai.cloudflare.com/v1/${AI_GATEWAY_ACCOUNT}/deepseek/deepseek/v1/chat/completions`
  const resp = await fetch(url, { method:'POST', headers:gwHeaders, body:JSON.stringify({ model:'deepseek-v4-pro', messages:[{role:'system',content:systemPrompt},{role:'user',content:prompt}], temperature:0.15, max_tokens:8000 }) })
  if (!resp.ok) { console.error(`  DeepSeek API ${resp.status}`); return null }
  const data = await resp.json() as any
  const content = data?.choices?.[0]?.message?.content || ''
  let cleaned = content.replace(/^```json\s*/i,'').replace(/\s*```$/i,'').trim()
  // 截断修复: 尝试保留到最后一个完整字段
  try { return JSON.parse(cleaned) as FAQCandidate }
  catch {
    const lastComma = cleaned.lastIndexOf('",')
    if (lastComma > 0) {
      const partial = cleaned.substring(0, lastComma + 1) + '}'
      try { return JSON.parse(partial) as FAQCandidate }
      catch {}
    }
    console.error(`  DeepSeek JSON解析失败: ${cleaned.slice(0,150)}`); return null
  }
}

// Qwen 评审 (Stage 2) — 唯一评审器，严格审查幻觉
async function qwenReview(issue: RawFAQ, faq: FAQCandidate): Promise<ReviewOutput> {
  const body = (issue.issue_body || '').slice(0, 3000)
  const title = issue.issue_title || `Issue #${issue.issue_number}`
  const prompt = `You are a STRICT technical reviewer. Your ONLY job: find hallucinations.

【Original Issue #${issue.issue_number}: ${title}】
${body}

【FAQ to Review】
Q: ${faq.question_en}
A: ${faq.answer_en}

Check EACH fact in the FAQ against the Issue:
- Version numbers: is it in the Issue?
- Function names / line numbers / file names — any NOT in the Issue?
- Keyboard shortcuts / alternative triggers — any NOT mentioned?
- Maintainer responses — any claimed but NOT shown?
- Solutions claimed — do they actually appear in the Issue?

CRITICAL: has_hallucination=true if ANY factual claim is not directly from the Issue. Paraphrased wording is fine; invented content is not.
Return JSON: {"score":0.0-1.0,"has_hallucination":bool,"feedback":"detail each issue found, or 'none'","revised_faq":{"question":"...","answer":"..."}}`

  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${QWEN_API_KEY}`}, body:JSON.stringify({ model:'qwen-max', messages:[{role:'system',content:'你是一个严格的技术评审专家。只关心事实准确性。只返回纯JSON，不要markdown包裹。'},{role:'user',content:prompt}], temperature:0.1, max_tokens:8000 }) })
  if (!resp.ok) throw new Error(`Qwen ${resp.status}`)
  const data = await resp.json() as any
  const content = data?.choices?.[0]?.message?.content || '{}'
  let cleaned = content.replace(/^```json\s*/i,'').replace(/\s*```$/i,'').trim()
  // 修复截断的 revised_faq: { → {}
  cleaned = cleaned.replace(/"revised_faq"\s*:\s*\{\s*$/, '"revised_faq": {}')
  try { return JSON.parse(cleaned) as ReviewOutput }
  catch { return { score:0, has_hallucination:true, feedback:`解析失败: ${cleaned.slice(0,120)}` } }
}

// ==========================================
// 质量门禁 v2 — Qwen 单评审
// ==========================================
function evaluateGate(review: ReviewOutput): { passed: boolean; action: 'insert'|'retry'; reason?: string } {
  if (review.has_hallucination) {
    return { passed:false, action:'retry', reason:`Qwen 检测到幻觉: ${review.feedback?.slice(0,120)}` }
  }
  if (review.score < 0.7) {
    return { passed:false, action:'retry', reason:`Qwen 评分过低: ${review.score}` }
  }
  return { passed:true, action:'insert' }
}

// ==========================================
// 主流程: 处理单个 Issue
// ==========================================
async function processOneIssue(app: App, issue: RawFAQ): Promise<{ success: boolean; action: string; reason?: string }> {
  const title = issue.issue_title || `Issue #${issue.issue_number}`
  console.log(`\n  [#${issue.issue_number}] ${title.slice(0,80)}...`)

  // Stage 1: DeepSeek v4-pro 生成
  console.log('    🤖 Stage 1: DeepSeek v4-pro 生成...')
  let faq = await deepseekGenerate(issue, app.name)
  if (!faq) { await updateRawFAQ(issue.id, 'rejected', '生成失败'); return { success:false, action:'reject', reason:'Generation failed' } }
  console.log(`    ✅ 生成: ${faq.question_en.slice(0,80)}...`)

  // Stage 2: Qwen 评审 + 重试
  let qwResult: ReviewOutput | null = null
  const issueBody = (issue.issue_body || '').slice(0, 3000)

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      console.log(`    🔄 重试 ${attempt}/${MAX_RETRIES} → Qwen反馈发回 DeepSeek 修正...`)
      // 将原 Issue + DeepSeek 上一次输出 + Qwen 评审反馈 打包发给 DeepSeek
      const retryPrompt = `Your previous FAQ was REJECTED by a reviewer. Fix ALL issues below.

【Reviewer Feedback】
${qwResult?.feedback || 'Hallucination detected'}

【Original Issue】
Issue #${issue.issue_number}: ${title}
${issueBody}

【Your Rejected FAQ】
Q: ${faq.question_en}
A: ${faq.answer_en}

CRITICAL: ONLY state facts from the Original Issue. DELETE anything not there.
Return ONLY JSON: {"question_en":"...","answer_en":"...","seo_keywords":["..."],"search_intent":"troubleshooting","confidence_score":0.9}`

      const url = `https://gateway.ai.cloudflare.com/v1/${AI_GATEWAY_ACCOUNT}/deepseek/deepseek/v1/chat/completions`
      const resp = await fetch(url, { method:'POST', headers:gwHeaders, body:JSON.stringify({ model:'deepseek-v4-pro', messages:[{role:'system',content:'You fix hallucination issues. ONLY output JSON, no markdown.'},{role:'user',content:retryPrompt}], temperature:0.1, max_tokens:8000 }) })
      if (resp.ok) {
        const data = await resp.json() as any
        const text = data?.choices?.[0]?.message?.content || ''
        const content = text.replace(/^```json\s*/i,'').replace(/\s*```$/i,'').trim()
        try { faq = JSON.parse(content) as FAQCandidate }
        catch {
          // 截断修复: 尝试保留到最后一个完整字段
        const lastComma = content.lastIndexOf('",')
        if (lastComma > 0) {
          try { faq = JSON.parse(content.substring(0, lastComma+1)+'}') as FAQCandidate; console.log('    ⚠️ JSON截断修复') }
          catch {}
        }
        if (!faq) { console.error(`    ❌ JSON解析失败: ${content.slice(0,100)}`); continue }
        }
        console.log(`    ✅ 修正: ${faq.question_en.slice(0,60)}...`)
      } else {
        console.error(`    ❌ 重试API ${resp.status}`)
        await delay(DELAY_ON_ERROR)
        continue
      }
    }

    console.log('    🔍 Stage 2: Qwen 评审...')
    try {
      qwResult = await qwenReview(issue, faq)
    } catch (e: any) {
      console.error(`    ❌ Qwen评审异常:`, e.message?.slice(0,100))
      await delay(DELAY_ON_ERROR)
      qwResult = { score:0, has_hallucination:true, feedback:`Qwen unavailable: ${e.message?.slice(0,100)}` }
    }
    console.log(`      [Qwen] Score: ${qwResult.score}, Hallucination: ${qwResult.has_hallucination}${qwResult.feedback ? ' — ' + qwResult.feedback.slice(0,120) : ''}`)

    const gate = evaluateGate(qwResult)
    if (gate.passed) {
      console.log(`    ✅ 评审通过 | Qwen评分: ${qwResult.score}`)
      console.log('    💾 Stage 3: 入库...')
      const faqId = await insertFAQ(app.id, issue, faq, qwResult.score)
      await insertFAQTranslation(faqId, faq)
      await createTranslationTasks(app.id, faqId)
      await updateRawFAQ(issue.id, 'completed')
      await insertReviewRecord(app.id, issue.issue_number, 'passed', `Qwen score:${qwResult?.score} | ${qwResult?.feedback || 'none'}`)
      console.log('    ✅ 入库完成')
      return { success:true, action:'insert' }
    }
    console.log(`    ❌ 评审未通过 | ${gate.reason}`)
  }

  // 重试耗尽 — 保存 Qwen 反馈到 review 记录
  const reason = `重试${MAX_RETRIES}次未通过 | Qwen评分:${qwResult?.score} 幻觉:${qwResult?.has_hallucination} | ${(qwResult?.feedback || '').slice(0,300)}`
  await updateRawFAQ(issue.id, 'rejected', reason)
  await insertReviewRecord(app.id, issue.issue_number, 'rejected', reason)
  return { success:false, action:'reject', reason }
}

async function processAppFAQs(app: App) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`📦 ${app.name} (${app.id})`)
  console.log(`${'='.repeat(60)}`)
  const pending = await getPendingFAQs(app.id, MAX_FAQS_PER_APP)
  if (!pending.length) { console.log('  ⏭️ 无待处理 Issues'); return { processed:0, succeeded:0, failed:0 } }
  console.log(`  📊 ${pending.length} 条 Issues`)
  let ok=0, fail=0
  for (let i=0; i<pending.length; i++) {
    const r = await processOneIssue(app, pending[i])
    if (r.success) ok++; else fail++
    if (i < pending.length-1) await delay(DELAY_BETWEEN_ISSUES)
  }
  console.log(`\n  📊 项目完成 | ✅${ok} ❌${fail}`)
  return { processed:pending.length, succeeded:ok, failed:fail }
}

// ==========================================
// 入口
// ==========================================
async function main() {
  const args = process.argv.slice(2)
  const test = args.includes('--test'), all = args.includes('--all')
  const appId = args.find(a=>a.startsWith('--app-id='))?.split('=')[1]

  if (!test && !all && !appId) { console.log('用法: --test | --all | --app-id=xxx'); process.exit(1) }

  console.log('🚀 FAQ ETL v2 | Stage1: DeepSeek v4-pro 生成 | Stage2: Qwen 评审')
  console.log(`📊 模式: ${test?'测试':all?'全量':`指定 ${appId}`}\n`)

  try {
    let apps: App[] = []
    if (appId) { const a = await getAppById(appId); if (!a) { console.error(`未找到 ${appId}`); process.exit(1) }; apps=[a] }
    else { apps = await getAllAppsWithPendingFAQs(); if (test && apps.length) apps=[apps[0]] }

    console.log(`📦 待处理: ${apps.length} 个项目\n`)

    let tp=0, ts=0, tf=0
    for (let i=0; i<apps.length; i++) {
      console.log(`\n[${i+1}/${apps.length}]`)
      try {
        const s = await processAppFAQs(apps[i])
        tp+=s.processed; ts+=s.succeeded; tf+=s.failed
        if (i<apps.length-1) { console.log('\n⏳ 等待 3 秒...'); await delay(3000) }
      } catch (e: any) { console.error(`❌ ${apps[i].name}:`, e.message?.slice(0,200)); await delay(DELAY_ON_ERROR) }
    }
    console.log(`\n${'='.repeat(60)}\n🎉 完成! Issues:${tp} ✅${ts} ❌${tf}\n${'='.repeat(60)}`)
  } catch (e: any) { console.error('\n❌', e.message); process.exit(1) }
}
main()
