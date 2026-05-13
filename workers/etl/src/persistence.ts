/**
 * D1 写入封装：raw_apps 状态机 + apps/app_translations 内容写入
 */

import type { AIResult, Env, GitHubRepoInfo, ReleaseAssetView } from './types'
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
  releaseAssets?: ReleaseAssetView[]
}): Promise<void> {
  const { env, fullName, repo, ai, etag, nextCheckAt, readme, releaseAssets } = params
  const appId = generateAppId(repo.id)
  const [owner, repoName] = fullName.split('/')

  const stmts = [
    env.DB.prepare(
      `INSERT OR REPLACE INTO apps (
         id, name, slug, description, full_description, category, tags,
         github_url, github_owner, github_repo, license, homepage_url,
         stars_count, last_updated, etl_processed_at, status, is_featured
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 'active', 0)`,
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
    ...buildVersionStmts(env, appId, releaseAssets),
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
  ]
  await env.DB.batch(stmts)
}

/**
 * 仅刷新 release/版本数据（POST /etl/refresh-versions 用）
 * 不动 AI 内容，不走 raw_apps 状态机
 */
export async function saveVersionsOnly(
  env: Env,
  appId: string,
  assets: ReleaseAssetView[],
): Promise<void> {
  const stmts = buildVersionStmts(env, appId, assets)
  if (stmts.length === 0) return
  await env.DB.batch(stmts)
}

function buildVersionStmts(env: Env, appId: string, assets: ReleaseAssetView[] | undefined) {
  if (!assets || assets.length === 0) return []
  const stmts = [
    // 同 app 旧版本先删，避免 (app_id, os_type) 唯一冲突 / 残留旧 url
    env.DB.prepare(`DELETE FROM app_versions WHERE app_id = ?`).bind(appId),
  ]
  for (const a of assets) {
    const id = `ver_${appId}_${a.os}_${a.arch}`
    stmts.push(
      env.DB.prepare(
        `INSERT OR REPLACE INTO app_versions (
           id, app_id, version, os_type, arch, file_type, file_name, file_size,
           download_url, sha256, release_notes, release_date, is_stable
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id, appId, a.version, a.os, a.arch, a.file_type, a.file_name, a.file_size,
        a.download_url, a.sha256, a.release_notes, a.release_date, a.is_stable,
      ),
    )
  }
  return stmts
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
    JSON.stringify(ai.quickStartGuideZh),
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
  const desc = locale === 'zh' ? (ai.descriptionZh || ai.description) : (ai.descriptionEn || ai.description)
  const fullDesc = locale === 'zh' ? (ai.fullDescriptionZh || ai.fullDescription) : (ai.fullDescriptionEn || ai.fullDescription)
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
    generateId(), appId, locale, sum, desc, fullDesc,
    JSON.stringify(features), JSON.stringify(useCases),
    JSON.stringify(quickStart), uninstall, caveats,
    ai.modelVersion, ai.qualityScore,
  )
}

/**
 * 为 app 生成向量 embedding 并 upsert 到 Vectorize 索引
 * 使用 bge-small-en-v1.5 (384维)，拼接英文描述+中文摘要以覆盖双语语义
 */
export async function upsertEmbedding(
  env: Env,
  appId: string,
  name: string,
  description: string,
  summaryZh: string,
  summaryEn: string,
  tags: string[],
  category: string,
): Promise<void> {
  try {
    // 拼接搜索文本：名称 + 中英文摘要 + 标签 + 分类，覆盖多语言搜索意图
    const searchText = [
      name,
      description,
      summaryEn,
      summaryZh,
      ...(tags || []),
      category,
    ].filter(Boolean).join('. ').slice(0, 2000)

    const aiResult = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
      text: [searchText],
    }) as { data: number[][] }

    const vector = aiResult.data?.[0]
    if (!vector || vector.length === 0) {
      console.warn(`[Embedding] empty vector for ${appId}`)
      return
    }

    await env.VECTORIZE.upsert([{
      id: appId,
      values: vector,
      metadata: {
        name,
        category,
        slug: appId,
      },
    }])

    console.log(`[Embedding] ✅ upserted ${appId} (${vector.length}d)`)
  } catch (err) {
    // embedding 失败不阻塞主流程
    console.warn(`[Embedding] ${appId} failed:`, (err as Error).message)
  }
}
