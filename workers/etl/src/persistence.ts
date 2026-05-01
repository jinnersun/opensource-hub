/**
 * D1 写入封装：raw_apps 状态机 + apps/app_translations 内容写入
 */

import type { AIResult, Env, GitHubRepoInfo } from './types'
import { toSqliteDateTime } from './scheduling'

function generateAppId(githubRepoId: number): string {
  return `app_${githubRepoId}`
}

function generateId(): string {
  return `etl_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/**
 * 锁定一批 raw_apps：标记为 processing
 * 注意：使用 full_name 而不是 github_repo_id，因为种子记录的 repo_id 可能为占位值
 */
export async function lockBatch(env: Env, fullNames: string[]): Promise<void> {
  if (fullNames.length === 0) return
  const placeholders = fullNames.map(() => '?').join(',')
  await env.DB.prepare(
    `UPDATE raw_apps
     SET etl_status = 'processing', processing_started_at = CURRENT_TIMESTAMP
     WHERE full_name IN (${placeholders})`,
  ).bind(...fullNames).run()
}

/**
 * 304 命中：仅更新 etag（如果换了）和 next_check_at
 */
export async function save304(
  env: Env,
  fullName: string,
  nextCheckAt: string,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE raw_apps
     SET etl_status = CASE WHEN etl_status = 'processing' THEN COALESCE(
                       (SELECT etl_status FROM raw_apps WHERE full_name = ?1 AND etl_status != 'processing'),
                       'completed') ELSE etl_status END,
         next_check_at = ?2,
         last_processed_at = CURRENT_TIMESTAMP
     WHERE full_name = ?1`,
  ).bind(fullName, nextCheckAt).run()
}

/**
 * 准入未通过：标记 skipped 并设置 next_check_at 用于未来复检
 */
export async function saveSkipped(
  env: Env,
  fullName: string,
  reason: string,
  nextCheckAt: string,
  repoId?: number,
  etag?: string,
  pushedAt?: string,
  archived?: boolean,
): Promise<void> {
  await env.DB.prepare(
    `UPDATE raw_apps
     SET etl_status = 'skipped',
         error_log = ?2,
         next_check_at = ?3,
         github_etag = COALESCE(?4, github_etag),
         last_pushed_at = COALESCE(?5, last_pushed_at),
         is_archived = COALESCE(?6, is_archived),
         github_repo_id = COALESCE(?7, github_repo_id),
         last_processed_at = CURRENT_TIMESTAMP
     WHERE full_name = ?1`,
  ).bind(
    fullName,
    reason.slice(0, 500),
    nextCheckAt,
    etag || null,
    pushedAt || null,
    typeof archived === 'boolean' ? (archived ? 1 : 0) : null,
    repoId || null,
  ).run()
}

/**
 * 失败：增加 retry_count 并安排稍后重试
 */
export async function saveFailure(
  env: Env,
  fullName: string,
  status: 'failed' | 'rate_limited' | 'not_found',
  reason: string,
  nextCheckAt: string,
): Promise<void> {
  const finalStatus = status === 'not_found' ? 'skipped' : status
  await env.DB.prepare(
    `UPDATE raw_apps
     SET etl_status = ?2,
         retry_count = retry_count + 1,
         error_log = ?3,
         next_check_at = ?4,
         last_processed_at = CURRENT_TIMESTAMP
     WHERE full_name = ?1`,
  ).bind(fullName, finalStatus, reason.slice(0, 500), nextCheckAt).run()
}

/**
 * 成功：写 apps + 双语翻译，更新 raw_apps 状态、ETag、next_check_at
 * 全部使用 D1 batch 保证事务性
 */
export async function saveSuccess(params: {
  env: Env
  fullName: string
  repo: GitHubRepoInfo
  readme: string
  etag: string | undefined
  ai: AIResult
  nextCheckAt: string
}): Promise<void> {
  const { env, fullName, repo, ai, etag, nextCheckAt, readme } = params
  const appId = generateAppId(repo.id)
  const [owner, repoName] = fullName.split('/')

  await env.DB.batch([
    env.DB.prepare(
      `INSERT OR REPLACE INTO apps (
         id, name, slug, description, full_description, category, tags,
         github_url, github_owner, github_repo, license, homepage_url,
         stars_count, last_updated, status, is_featured
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 0)`,
    ).bind(
      appId, ai.name, ai.slug, ai.description, ai.fullDescription,
      ai.category, JSON.stringify(ai.tags),
      repo.html_url, owner, repoName,
      ai.license, ai.homepage || repo.homepage,
      repo.stargazers_count, repo.updated_at,
    ),
    buildAiContentStmt(env, appId, ai),
    buildTranslationStmt(env, appId, 'zh', ai),
    buildTranslationStmt(env, appId, 'en', ai),
    env.DB.prepare(
      `UPDATE raw_apps
       SET etl_status = 'completed',
           github_repo_id = ?2,
           raw_api_data = ?3,
           readme_content = ?4,
           readme_length = ?5,
           github_etag = ?6,
           last_pushed_at = ?7,
           is_archived = ?8,
           next_check_at = ?9,
           last_processed_at = CURRENT_TIMESTAMP,
           quality_score = ?10,
           error_log = NULL
       WHERE full_name = ?1`,
    ).bind(
      fullName, repo.id,
      JSON.stringify(repo).slice(0, 100_000),
      readme,
      readme.length,
      etag || null,
      toSqliteDateTime(new Date(repo.pushed_at)),
      repo.archived ? 1 : 0,
      nextCheckAt,
      ai.qualityScore,
    ),
  ])
}

/**
 * 写入 app_ai_content（中文为主，详情页直接渲染来源）
 * 同时给详情页提供 features (what_it_does)、use_cases、quick_start_guide、is_portable、uninstall_guide
 */
function buildAiContentStmt(env: Env, appId: string, ai: AIResult) {
  const whatItDoes = ai.featuresZh.map(f => `- ${f}`).join('\n')
  return env.DB.prepare(
    `INSERT OR REPLACE INTO app_ai_content (
       id, app_id, summary, what_it_does, what_it_cant_do, use_cases,
       quick_start_guide, is_portable, requirements, requirement_links,
       uninstall_guide, has_registry_residual,
       ai_model_version, confidence_score, needs_human_review
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    `aic_${appId}`, appId,
    ai.summaryZh,
    whatItDoes,
    ai.caveatsZh,
    JSON.stringify(ai.useCasesZh),
    ai.quickStartGuideZh,
    0,
    null,
    null,
    ai.uninstallGuideZh,
    0,
    ai.modelVersion,
    ai.qualityScore,
    ai.qualityScore < 0.6 ? 1 : 0,
  )
}

function buildTranslationStmt(env: Env, appId: string, locale: 'zh' | 'en', ai: AIResult) {
  const sum = locale === 'zh' ? ai.summaryZh : ai.summaryEn
  const desc = locale === 'zh' ? ai.description : ai.descriptionEn
  const features = locale === 'zh' ? ai.featuresZh : ai.featuresEn
  const useCases = locale === 'zh' ? ai.useCasesZh : ai.useCasesEn
  const quickStart = locale === 'zh' ? ai.quickStartGuideZh : ai.quickStartGuideEn
  const uninstall = locale === 'zh' ? ai.uninstallGuideZh : ai.uninstallGuideEn
  const caveats = locale === 'zh' ? ai.caveatsZh : ai.caveatsEn

  return env.DB.prepare(
    `INSERT OR REPLACE INTO app_translations (
       id, app_id, locale, summary, description, full_description,
       features, use_cases, quick_start_guide, uninstall_guide, caveats,
       translated_by, ai_model_version, quality_score
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ai', ?, ?)`,
  ).bind(
    generateId(), appId, locale, sum, desc, ai.fullDescription,
    JSON.stringify(features), JSON.stringify(useCases),
    quickStart, uninstall, caveats,
    ai.modelVersion, ai.qualityScore,
  )
}
