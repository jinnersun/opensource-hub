/**
 * Library Pipeline: 候选扫描 → AI 生成 → 持久化
 */

import type { Env, GitHubRepoInfo } from '../types'
import { upsertEmbedding } from '../persistence'
import { LibraryAIClient, type LibraryAIResult } from './ai'
import { VALID_PROJECT_TYPES } from './ai'

export interface LibraryBatchStats {
  scanned: number
  promoted: number
  aiFailed: number
  dbFailed: number
  noData: number
}

const STAR_THRESHOLD = 2000
const BATCH_SIZE = 10
const MAX_BATCHES_PER_RUN = 5
const README_PREVIEW_MAX = 2000
const MAX_CONSECUTIVE_AI_FAILURES = 3
const MAX_TOTAL_AI_FAILURES = 5

interface LibraryCandidate {
  github_repo_id: number
  full_name: string
  raw_api_data: string
  readme_content: string | null
  stargazers_count: number
}

async function fetchLibraryCandidates(env: Env, limit: number): Promise<LibraryCandidate[]> {
  const sql = `
    SELECT r.github_repo_id, r.full_name, r.raw_api_data, r.readme_content,
           CAST(json_extract(r.raw_api_data, '$.stargazers_count') AS INTEGER) AS stargazers_count
    FROM raw_apps r
    WHERE r.source = 'trending'
      AND r.etl_status = 'skipped'
      AND r.error_log = 'no_installable_release'
      AND r.is_archived = 0
      AND r.github_repo_id IS NOT NULL
      AND r.raw_api_data IS NOT NULL
      AND CAST(json_extract(r.raw_api_data, '$.stargazers_count') AS INTEGER) >= ?1
      AND NOT EXISTS (SELECT 1 FROM apps_library l WHERE l.github_repo_id = r.github_repo_id)
    ORDER BY stargazers_count DESC LIMIT ?2
  `
  const res = await env.DB.prepare(sql).bind(STAR_THRESHOLD, limit).all<LibraryCandidate>()
  return res.results || []
}

function buildReadmePreview(readme: string | null): string {
  if (!readme) return ''
  const cleaned = readme.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/<[^>]+>/g, '').replace(/\n{3,}/g, '\n\n').trim()
  return cleaned.slice(0, README_PREVIEW_MAX)
}

function slugify(fullName: string): string {
  return fullName.toLowerCase().replace(/\//g, '-').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120)
}

async function persistLibraryEntry(env: Env, repo: GitHubRepoInfo, ai: LibraryAIResult, readmePreview: string): Promise<void> {
  const [, repoName] = repo.full_name.split('/')
  const slug = slugify(repo.full_name)
  const stmts = [
    env.DB.prepare(
      `INSERT OR IGNORE INTO apps_library (github_repo_id, slug, name, full_name, description, summary, full_description, readme_preview, tags, language, project_type, category, stars_count, html_url, homepage, license, last_updated, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    ).bind(repo.id, slug, repoName, repo.full_name, repo.description || null, ai.summary, ai.fullDescription, readmePreview, JSON.stringify(ai.tags), repo.language || null, ai.projectType, ai.category, repo.stargazers_count, repo.html_url, repo.homepage || null, repo.license?.spdx_id || null, repo.pushed_at || null),
    env.DB.prepare(`INSERT OR REPLACE INTO apps_library_translations (library_id, locale, summary, full_description) VALUES ((SELECT id FROM apps_library WHERE github_repo_id = ?1), 'en', ?2, ?3)`).bind(repo.id, ai.summary, ai.fullDescription),
    env.DB.prepare(`INSERT OR REPLACE INTO apps_library_translations (library_id, locale, summary, full_description) VALUES ((SELECT id FROM apps_library WHERE github_repo_id = ?1), 'zh', ?2, ?3)`).bind(repo.id, ai.summaryZh, ai.fullDescriptionZh),
    env.DB.prepare(`UPDATE raw_apps SET etl_status = 'library_imported', last_processed_at = CURRENT_TIMESTAMP WHERE full_name = ?1`).bind(repo.full_name),
  ]
  await env.DB.batch(stmts)
}

export async function promoteToLibrary(env: Env): Promise<LibraryBatchStats> {
  const stats: LibraryBatchStats = { scanned: 0, promoted: 0, aiFailed: 0, dbFailed: 0, noData: 0 }
  const ai = new LibraryAIClient(env.OPENAI_API_KEY,
    env.AI_GATEWAY_ACCOUNT && env.AI_GATEWAY_TOKEN
      ? { account: env.AI_GATEWAY_ACCOUNT, token: env.AI_GATEWAY_TOKEN }
      : undefined,
  )
  let consecutiveAIFailures = 0

  outer: for (let batchIdx = 0; batchIdx < MAX_BATCHES_PER_RUN; batchIdx++) {
    const candidates = await fetchLibraryCandidates(env, BATCH_SIZE)
    if (candidates.length === 0) { console.log(`[Library] no more candidates after ${batchIdx} batches`); break }
    console.log(`[Library] batch ${batchIdx + 1}: ${candidates.length} candidates`)
    stats.scanned += candidates.length

    for (const c of candidates) {
      try {
        let repo: GitHubRepoInfo
        try { repo = JSON.parse(c.raw_api_data) as GitHubRepoInfo } catch { stats.noData++; continue }
        if (!repo.id) { stats.noData++; continue }

        const readme = c.readme_content || ''
        const aiResult = await ai.generate(repo, readme).catch(err => { stats.aiFailed++; return null })
        if (!aiResult) {
          consecutiveAIFailures++
          if (consecutiveAIFailures >= MAX_CONSECUTIVE_AI_FAILURES || stats.aiFailed >= MAX_TOTAL_AI_FAILURES) {
            console.warn(`[Library] AI failure threshold hit, breaking`)
            break outer
          }
          continue
        }
        consecutiveAIFailures = 0

        const readmePreview = buildReadmePreview(c.readme_content)
        await persistLibraryEntry(env, repo, aiResult, readmePreview)
        stats.promoted++

        try {
          const libId = `lib_${repo.id}`
          await upsertEmbedding(env, libId, repo.name, aiResult.summary, aiResult.summaryZh, aiResult.summary, aiResult.tags, aiResult.category)
        } catch { /* embedding non-critical */ }

        // 翻译任务
        for (const tl of ['ja', 'ko', 'es', 'pt-BR']) {
          try { await env.DB.prepare(`INSERT OR IGNORE INTO translation_tasks (app_id, source_locale, target_locale) VALUES (?, 'zh', ?)`).bind(`lib_${repo.id}`, tl).run() } catch {}
        }
      } catch (err) {
        console.error(`[Library] persist ${c.full_name} failed:`, (err as Error).message)
        stats.dbFailed++
      }
    }
  }

  return stats
}
