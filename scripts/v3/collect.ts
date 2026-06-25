#!/usr/bin/env tsx
/**
 * FAQ V3 — 采集 + 特征打分 → raw_faqs (D1)
 *
 * 流程:
 *   1. 从 apps + apps_library 获取活跃项目
 *   2. GitHub 宽松采集: is:issue is:closed
 *   3. 拉取社区信号 + Timeline API Linked PRs + 评论
 *   4. 特征打分（零 Token）→ 只保留 ≥30 分的 Issue
 *   5. 写入 D1 raw_faqs
 *
 * 使用:
 *   tsx scripts/v3/collect.ts --sample     # 前 30 个项目
 *   tsx scripts/v3/collect.ts --all        # 全量
 *   tsx scripts/v3/collect.ts --app-id=xxx
 */

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'

// ==========================================
// 类型
// ==========================================

interface App { id: string; name: string; github_owner: string; github_repo: string }

interface GitHubIssue {
  number: number; title: string; body: string; state: string; html_url: string
  labels: Array<{ name: string }>; comments: number
  created_at: string; updated_at: string; closed_at: string | null
  pull_request?: unknown
}

interface GitHubComment {
  id: number; body: string; user: { login: string } | null
  reactions?: { '+1'?: number; heart?: number; hooray?: number; rocket?: number; eyes?: number }
}

interface CollectedIssue {
  issue_number: number; title: string; body: string
  html_url: string; labels: string[]
  state_reason: string | null; closed_by: string | null; comments_count: number
  comments: { body: string; author: string; reactions: Record<string, number> }[]
  linked_prs: { title: string; body: string }[]
  max_comment_reactions: number
  score: number; score_breakdown: string[]
}

// ==========================================
// 配置
// ==========================================

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
if (!GITHUB_TOKEN) { console.error('❌ 请设置 GITHUB_TOKEN'); process.exit(1) }

const MAX_PER_APP = 15
const SAMPLE_SIZE = 30
const PASS_THRESHOLD = 30
const DELAY_APP = 1500
const DELAY_ISSUE = 500

// ==========================================
// 辅助
// ==========================================

function delay(ms: number) { return new Promise(r => setTimeout(r, ms)) }

function execWrangler(q: string): any {
  const out = execSync(`wrangler d1 execute opensource-hub-db --command "${q}" --remote`, {
    encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
  })
  try { const i = out.indexOf('['); return i < 0 ? null : JSON.parse(out.substring(i))[0] }
  catch { return null }
}

async function getApps(sample: boolean, appId?: string): Promise<App[]> {
  if (appId) {
    // 支持 app_xxx 或 lib_xxx 格式
    if (appId.startsWith('lib_')) {
      const repoId = appId.replace('lib_', '')
      const r = execWrangler(`SELECT 'lib_' || github_repo_id as id, name, SUBSTR(full_name, 1, INSTR(full_name, '/')-1) as github_owner, SUBSTR(full_name, INSTR(full_name, '/')+1) as github_repo FROM apps_library WHERE github_repo_id='${repoId}'`)
      return r?.results?.[0] ? [r.results[0]] : []
    }
    const r = execWrangler(`SELECT id, name, github_owner, github_repo FROM apps WHERE id='${appId}'`)
    return r?.results?.[0] ? [r.results[0]] : []
  }
  const apps = execWrangler(`SELECT id, name, github_owner, github_repo FROM apps WHERE status='active'`)?.results || []
  const libs = execWrangler(`SELECT 'lib_' || github_repo_id as id, name, SUBSTR(full_name, 1, INSTR(full_name, '/')-1) as github_owner, SUBSTR(full_name, INSTR(full_name, '/')+1) as github_repo FROM apps_library WHERE status='active'`)?.results || []
  const all = [...apps, ...libs]
  return sample ? all.slice(0, SAMPLE_SIZE) : all
}

// ==========================================
// GitHub API
// ==========================================

const API_HEADERS = {
  'Authorization': `Bearer ${GITHUB_TOKEN}`,
  'Accept': 'application/vnd.github.v3+json',
  'X-GitHub-Api-Version': '2022-11-28',
}

async function ghFetch(url: string, headers?: Record<string, string>): Promise<any> {
  const resp = await fetch(url, { headers: { ...API_HEADERS, ...headers } })
  if (resp.status === 403) {
    const reset = resp.headers.get('x-ratelimit-reset')
    if (reset) { const w = parseInt(reset) * 1000 - Date.now() + 2000; console.log(`  ⏳ ${Math.round(w / 1000)}s`); await delay(w); return ghFetch(url, headers) }
  }
  if (!resp.ok) return undefined
  return resp.json()
}

async function searchIssues(fullName: string, isNew: boolean): Promise<GitHubIssue[]> {
  let q: string
  if (isNew) {
    q = `is:issue is:closed`  // 新 APP: 全量采集历史 Issue
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    q = `is:issue is:closed updated:>=${yesterday}`  // 已有数据: 只采 24h 增量
  }
  const url = `https://api.github.com/search/issues?q=repo:${fullName}+${encodeURIComponent(q)}&sort=updated&order=desc&per_page=${MAX_PER_APP}`
  const data = await ghFetch(url)
  return (data?.items || []).filter((i: any) => !i.pull_request)
}

function appHasExistingFAQ(appId: string): boolean {
  const r = execWrangler(`SELECT COUNT(*) as c FROM raw_faqs WHERE app_id='${appId}' LIMIT 1`)
  return (r?.results?.[0]?.c || 0) > 0
}

async function getIssueDetail(owner: string, repo: string, num: number): Promise<any> {
  return ghFetch(`https://api.github.com/repos/${owner}/${repo}/issues/${num}`)
}

async function getComments(owner: string, repo: string, num: number): Promise<GitHubComment[]> {
  return (await ghFetch(`https://api.github.com/repos/${owner}/${repo}/issues/${num}/comments?per_page=30&sort=created`)) || []
}

async function getLinkedPRs(owner: string, repo: string, num: number): Promise<{ title: string; body: string }[]> {
  // 尝试 Timeline API 获取 cross-reference events
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${num}/timeline?per_page=30`
  const events = await ghFetch(url) as any[]
  if (!Array.isArray(events)) return []

  const prs: { title: string; body: string }[] = []
  for (const e of events) {
    if (e.event !== 'cross-referenced') continue
    const src = e.source
    // PR 可能以 'issue' 类型出现（GitHub 把 PR 当做带代码的 Issue）
    // 也可能以 'pull_request' 类型出现
    if (src?.type === 'issue' && src?.issue?.pull_request) {
      prs.push({ title: src.issue.title || '', body: (src.issue.body || '').slice(0, 500) })
    } else if (src?.type === 'pull_request' && src?.issue?.title) {
      prs.push({ title: src.issue.title || '', body: (src.issue.body || '').slice(0, 500) })
    }
  }
  return prs.slice(0, 3)
}

// ==========================================
// D1 写入
// ==========================================

function esc(s: string): string {
  return s.replace(/'/g, "''").replace(/\\/g, '\\\\')
}

function execWranglerFile(sql: string): any {
  const fs = require('fs')
  const path = require('path')
  const os = require('os')
  const f = path.join(os.tmpdir(), `faq-collect-${Date.now()}.sql`)
  fs.writeFileSync(f, sql, 'utf-8')
  try {
    const out = execSync(`wrangler d1 execute opensource-hub-db --file "${f}" --remote`, {
      encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe']
    })
    fs.unlinkSync(f)
    const i = out.indexOf('[')
    return i < 0 ? null : JSON.parse(out.substring(i))[0]
  } catch (e) { try { fs.unlinkSync(f) } catch {}; throw e }
}

function writeRawFAQ(appId: string, issue: CollectedIssue): void {
  const title = esc(issue.title)
  const body = esc(issue.body)
  const labels = esc(JSON.stringify(issue.labels))
  const comments = esc(JSON.stringify(issue.comments))
  const prs = esc(JSON.stringify(issue.linked_prs))

  execWranglerFile(
    `INSERT INTO raw_faqs (app_id, issue_number, issue_title, issue_body, issue_state, issue_labels, comments_count, issue_url, issue_comments, linked_prs, etl_status, fetched_at)
     VALUES ('${appId}', ${issue.issue_number}, '${title}', '${body}', 'closed', '${labels}', ${issue.comments_count}, '${issue.html_url}', '${comments}', '${prs}', 'pending', CURRENT_TIMESTAMP)
     ON CONFLICT(app_id, issue_number) DO UPDATE SET
       issue_title = excluded.issue_title, issue_body = excluded.issue_body,
       issue_labels = excluded.issue_labels, comments_count = excluded.comments_count,
       issue_url = excluded.issue_url, issue_comments = excluded.issue_comments,
       linked_prs = excluded.linked_prs, etl_status = 'pending', error_log = NULL, retry_count = 0, fetched_at = CURRENT_TIMESTAMP;`
  )
}

function updateFaqStatus(appId: string): void {
  if (appId.startsWith('lib_')) {
    const repoId = appId.replace('lib_', '')
    execSync(`wrangler d1 execute opensource-hub-db --command "UPDATE apps_library SET faq_status='completed', faq_processed_at=CURRENT_TIMESTAMP WHERE github_repo_id='${repoId}'" --remote`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  } else {
    execSync(`wrangler d1 execute opensource-hub-db --command "UPDATE apps SET faq_status='completed', faq_processed_at=CURRENT_TIMESTAMP WHERE id='${appId}'" --remote`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] })
  }
}

// ==========================================
// 特征打分
// ==========================================

function scoreIssue(
  issue: GitHubIssue,
  stateReason: string | null, closedBy: string | null,
  comments: GitHubComment[], prs: { title: string; body: string }[]
): CollectedIssue {
  let score = 0
  const breakdown: string[] = []
  const allText = [issue.title, issue.body, ...comments.map(c => c.body)].join(' ')

  // +15 关键词
  if (/workaround|fixed\s*(by|in|with)|solved|similarly/i.test(allText)) { score += 15; breakdown.push('关键词+15') }

  // +30 可执行代码块
  const hasExec = comments.some(c => /```(bash|sh|json|yaml|yml|ini|toml|env|Dockerfile)\s/.test(c.body))
  if (hasExec) { score += 30; breakdown.push('可执行代码块+30') }

  // +15 任意代码块（与 +30 互斥）
  const hasCode = comments.some(c => c.body.includes('```'))
  if (hasCode && !hasExec) { score += 15; breakdown.push('代码块+15') }

  // +35 Linked PR
  if (prs.length > 0) { score += 35; breakdown.push(`PR+35(${prs.length})`) }

  // +25 官方确认
  if (stateReason === 'completed' || (closedBy && closedBy !== 'ghost')) {
    score += 25; breakdown.push(`官方确认+25(${stateReason || `by ${closedBy}`})`)
  }

  // +10 社区认可
  let maxReactions = 0
  for (const c of comments) {
    const r = c.reactions; const s = (r?.['+1'] || 0) + (r?.heart || 0) * 2 + (r?.hooray || 0) * 3
    if (s > maxReactions) maxReactions = s
  }
  if (maxReactions >= 2) { score += 10; breakdown.push(`社区认可+10(👍${maxReactions})`) }

  return {
    issue_number: issue.number,
    title: issue.title,
    body: (issue.body || '').slice(0, 4000),
    html_url: issue.html_url,
    labels: (issue.labels || []).map(l => l.name),
    state_reason: stateReason, closed_by: closedBy, comments_count: issue.comments,
    comments: comments.map(c => ({
      body: (c.body || '').slice(0, 800),
      author: c.user?.login || 'unknown',
      reactions: { '+1': c.reactions?.['+1'] || 0, heart: c.reactions?.heart || 0, hooray: c.reactions?.hooray || 0, rocket: c.reactions?.rocket || 0, eyes: c.reactions?.eyes || 0 },
    })),
    linked_prs: prs,
    max_comment_reactions: maxReactions,
    score, score_breakdown: breakdown,
  }
}

// ==========================================
// 主流程
// ==========================================

async function collectApp(app: App): Promise<number> {
  const [owner, repo] = [app.github_owner, app.github_repo]
  const fullName = `${owner}/${repo}`
  const isNew = !appHasExistingFAQ(app.id)
  console.log(`\n📦 ${app.name} (${fullName}) — ${isNew ? '首次全量' : '24h增量'}`)

  const issues = await searchIssues(fullName, isNew)
  console.log(`   找到 ${issues.length} 个 closed issues`)
  if (!issues.length) return 0

  let written = 0

  for (let i = 0; i < issues.length; i++) {
    const is = issues[i]
    console.log(`    [#${is.number}] ${is.title.slice(0, 60)}`)

    const [detail, comments, prs] = await Promise.all([
      getIssueDetail(owner, repo, is.number),
      is.comments > 0 ? getComments(owner, repo, is.number) : Promise.resolve([]),
      getLinkedPRs(owner, repo, is.number),
    ])
    if (is.comments > 0) console.log(`      💬${comments.length}/${is.comments} ${prs.length ? `🔗${prs.length}` : ''}`)

    const scored = scoreIssue(
      is,
      detail?.state_reason || null,
      detail?.closed_by?.login || null,
      comments, prs,
    )

    if (scored.score >= PASS_THRESHOLD) {
      writeRawFAQ(app.id, scored)
      if (written === 0) updateFaqStatus(app.id)
      console.log(`      ✅ ${scored.score}分 ${scored.score_breakdown.join(', ')}`)
      written++
    } else {
      console.log(`      ⏭️  ${scored.score}分 (未达${PASS_THRESHOLD})`)
    }

    if (i < issues.length - 1) await delay(DELAY_ISSUE)
  }

  console.log(`   📦 写入 ${written}/${issues.length} 条`)
  return written
}

// ==========================================
// 入口
// ==========================================

async function main() {
  const args = process.argv.slice(2)
  const isSample = args.includes('--sample'), isAll = args.includes('--all')
  const appId = args.find(a => a.startsWith('--app-id='))?.split('=')[1]

  if (!isSample && !isAll && !appId) {
    console.log('用法: tsx scripts/v3/collect.ts --sample | --all | --app-id=xxx')
    process.exit(1)
  }

  console.log(`🔍 FAQ V3 采集+打分 → raw_faqs`)
  console.log(`📊 模式: ${isSample ? `测试(${SAMPLE_SIZE})` : isAll ? '全量' : `指定(${appId})`}`)

  const apps = await getApps(isSample, appId)
  console.log(`📊 ${apps.length} 个项目\n`)

  let totalApps = 0, totalIssues = 0

  for (let i = 0; i < apps.length; i++) {
    console.log(`[${i + 1}/${apps.length}]`)
    try {
      const n = await collectApp(apps[i])
      if (n > 0) { totalApps++; totalIssues += n }
      if (i < apps.length - 1) await delay(DELAY_APP)
    } catch (err) { console.error(`❌ ${apps[i].name}:`, (err as Error).message) }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`🎉 完成! 项目:${totalApps} Issues:${totalIssues}`)
  console.log(`${'='.repeat(60)}`)
}

main()
