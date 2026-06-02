/**
 * ETL Library 分支：Trending 发现的高星无 Release 项目 → apps_library
 *
 * 触发条件 (硬编码，不走主 ETL 状态机):
 *   - source='trending'
 *   - etl_status='skipped'
 *   - error_log='no_installable_release'
 *   - is_archived=0
 *   - stars >= STAR_THRESHOLD (2000)
 *   - 尚未导入过 apps_library
 *
 * 处理:
 *   1. 读取 raw_apps 已缓存的 raw_api_data + readme_content (无需再调 GitHub API)
 *   2. 调精简版 AI prompt 生成 project_type / summary / full_description 等 (中英双语同步)
 *   3. 写入 apps_library + apps_library_translations
 *   4. 更新 raw_apps.etl_status = 'library_imported' (终态，不再进入主流程)
 */

import type { Env, GitHubRepoInfo } from './types'
import { upsertEmbedding } from './persistence'

// ========== 常量 ==========
const STAR_THRESHOLD = 2000
const BATCH_SIZE = 10
const MAX_BATCHES_PER_RUN = 5
const README_PREVIEW_MAX = 2000
const README_FOR_AI_MAX = 8000
// 方案 B 熔断阈值：AI 失败累积到一定量立即退出，把 waitUntil 配额让给下一个 invocation
const MAX_CONSECUTIVE_AI_FAILURES = 3
const MAX_TOTAL_AI_FAILURES = 5

const VALID_PROJECT_TYPES = [
  'framework', 'library', 'cli-tool', 'application',
  'tutorial', 'awesome-list', 'dataset-model', 'other',
] as const
type ProjectType = typeof VALID_PROJECT_TYPES[number]

const VALID_CATEGORIES = [
  'system', 'ai', 'video', 'privacy', 'clean-install',
  'dev-tools', 'file-management', 'design', 'office',
]

// ========== 数据结构 ==========
export interface LibraryAIResult {
  summary: string              // 英文一句话 (≤80 字)
  summaryZh: string            // 中文一句话 (≤30 字)
  fullDescription: string      // 英文扩展描述 (≤300 字)
  fullDescriptionZh: string    // 中文扩展描述 (≤200 字)
  projectType: ProjectType     // 8 选 1
  category: string             // 9 选 1 (categories.slug)
  tags: string[]               // 融合 topics + AI 补充
}

export interface LibraryBatchStats {
  scanned: number
  promoted: number
  aiFailed: number
  dbFailed: number
  noData: number
}

// ========== 候选扫描 ==========
interface LibraryCandidate {
  github_repo_id: number
  full_name: string
  raw_api_data: string
  readme_content: string | null
  stargazers_count: number
}

async function fetchLibraryCandidates(env: Env, limit: number): Promise<LibraryCandidate[]> {
  // 用 json_extract 过滤 stars，避免把整张表捞回来
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
      AND NOT EXISTS (
        SELECT 1 FROM apps_library l WHERE l.github_repo_id = r.github_repo_id
      )
    ORDER BY stargazers_count DESC
    LIMIT ?2
  `
  const res = await env.DB.prepare(sql).bind(STAR_THRESHOLD, limit).all<LibraryCandidate>()
  return res.results || []
}

// ========== README 预处理 ==========
/**
 * 生成 readme_preview: 截取 + 去除图片链接/HTML 标签 (展示用)
 */
function buildReadmePreview(readme: string | null): string {
  if (!readme) return ''
  // 去除 markdown 图片和 HTML 标签、压缩多行空白
  const cleaned = readme
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')       // ![alt](url)
    .replace(/<[^>]+>/g, '')                    // <tag>
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return cleaned.slice(0, README_PREVIEW_MAX)
}

function slugify(fullName: string): string {
  // owner/repo → owner-repo (小写, 特殊字符替换)
  return fullName
    .toLowerCase()
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 120)
}

// ========== AI 精简 prompt ==========
const LIBRARY_PROMPT = `You are an open-source project analyst. Classify the given project and produce bilingual metadata.

Project:
- Full name: {full_name}
- Description: {description}
- Stars: {stars}
- Language: {language}
- Topics: {topics}
- License: {license}

README (truncated):
{readme}

Return a single JSON object (no markdown fence) with EXACTLY these fields:

{
  "projectType": "one of: framework | library | cli-tool | application | tutorial | awesome-list | dataset-model | other",
  "category":    "one of: system | ai | video | privacy | clean-install | dev-tools | file-management | design | office",
  "tags": ["tag1", "tag2", "tag3"],
  "summary":       "English one-sentence summary, max 80 chars",
  "summaryZh":     "中文一句话摘要，不超过 30 字",
  "fullDescription":   "English description, 2-4 sentences, max 300 chars",
  "fullDescriptionZh": "中文描述，2-4 句，不超过 200 字"
}

Decision tree for projectType (MUST follow strictly, top-down, first match wins):
1. Name contains "awesome-" OR content is a curated list of resources/links → awesome-list
2. Primary purpose is teaching / course / tutorial / learning material → tutorial
3. Main deliverable is a dataset or pretrained model / benchmark → dataset-model
4. Provides plugins/extensibility/SDK to build apps on top → framework
5. Primarily imported as a library/module by other code (no standalone UI) → library
6. Provides CLI or TUI interface → cli-tool
7. Runs as a standalone app (GUI / web app / server) → application
8. Uncertain → other

Rules:
- projectType and category MUST be from the given enumerations, lowercase, exact match
- tags: 3-6 items, merge GitHub topics + your additions, lowercase, kebab-case
- summary/fullDescription MUST be English; summaryZh/fullDescriptionZh MUST be Chinese
- No installation instructions, no download links, no version mentions
- Do not include markdown code fences, explanatory text, or any content outside the JSON object
- Your response MUST start with { and end with }

Example of a valid response (format reference, content unrelated to current project):
{"projectType":"cli-tool","category":"dev-tools","tags":["git","cli","terminal","productivity"],"summary":"A fast terminal-based Git repository browser with fuzzy search.","summaryZh":"终端系 Git 仓库浏览器，支持模糊搜索。","fullDescription":"Lightweight TUI that lets developers navigate commit history, diffs and branches without leaving the shell. Supports keyboard-driven workflows and integrates with common Git commands.","fullDescriptionZh":"轻量级 TUI 工具，让开发者在命令行内浏览提交历史、diff 与分支，支持键盘快捷操作，与常用 Git 命令无缝集成。"}`

export class LibraryAIClient {
  constructor(private apiKey: string) {}

  async generate(repo: GitHubRepoInfo, readme: string, timeoutMs = 45_000): Promise<LibraryAIResult> {
    const MAX_ATTEMPTS = 3
    let lastErr: Error | null = null
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await this.generateOnce(repo, readme, timeoutMs, attempt)
      } catch (err) {
        const e = err as Error
        lastErr = e
        const msg = e.message || ''
        const retryable =
          msg.includes('AI rate limit') ||
          msg.includes('AI API error: 5') ||
          msg === 'AI returned invalid JSON' ||
          msg.startsWith('AI result validation failed')
        if (!retryable || attempt === MAX_ATTEMPTS - 1) throw e
        const waitMs = msg.includes('rate limit') ? (attempt === 0 ? 2000 : 5000) : (attempt === 0 ? 1000 : 3000)
        await new Promise(r => setTimeout(r, waitMs))
        console.warn(`[Library AI retry ${attempt + 1}] ${repo.full_name}: ${msg.slice(0, 120)}`)
      }
    }
    throw lastErr || new Error('Library AI failed after retries')
  }

  private async generateOnce(
    repo: GitHubRepoInfo, readme: string, timeoutMs: number, attempt: number,
  ): Promise<LibraryAIResult> {
    const prompt = LIBRARY_PROMPT
      .replace('{full_name}', repo.full_name)
      .replace('{description}', repo.description || '')
      .replace('{stars}', String(repo.stargazers_count))
      .replace('{language}', repo.language || 'unknown')
      .replace('{topics}', (repo.topics || []).join(', ') || 'none')
      .replace('{license}', repo.license?.spdx_id || 'Unknown')
      .replace('{readme}', readme.slice(0, README_FOR_AI_MAX))

    const temperature = attempt === 0 ? 0.2 : Math.min(0.5, 0.2 + attempt * 0.15)

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: 'You are an open-source project analyst. Respond with ONLY a valid JSON object.' },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: 800,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      if (resp.status === 429) throw new Error(`AI rate limit: ${resp.status} ${text.slice(0, 200)}`)
      throw new Error(`AI API error: ${resp.status} ${text.slice(0, 200)}`)
    }

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
    const raw = data.choices?.[0]?.message?.content || ''

    let result: LibraryAIResult
    try { result = parseLibraryAIJson(raw) }
    catch { throw new Error('AI returned invalid JSON') }

    normalizeLibraryResult(result, repo)

    const err = validateLibraryResult(result)
    if (err) throw new Error(`AI result validation failed: ${err}`)
    return result
  }
}

/**
 * 鲁棒解析 AI 返回的 JSON：
 * 1. 先剥离 markdown fence 并 trim
 * 2. 直接试 JSON.parse
 * 3. 失败时用括号计数法提取首个平衡的 { ... } 块再试
 */
function parseLibraryAIJson(raw: string): LibraryAIResult {
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
  try { return JSON.parse(stripped) as LibraryAIResult } catch { /* fallthrough */ }

  // 提取首个平衡的 { ... }，尽量忽略字符串里的 { }
  const start = stripped.indexOf('{')
  if (start < 0) throw new Error('no JSON object found')
  let depth = 0
  let inStr = false
  let escape = false
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i]
    if (escape) { escape = false; continue }
    if (inStr) {
      if (ch === '\\') escape = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        const slice = stripped.slice(start, i + 1)
        return JSON.parse(slice) as LibraryAIResult
      }
    }
  }
  throw new Error('unbalanced JSON braces')
}

function normalizeLibraryResult(r: LibraryAIResult, repo: GitHubRepoInfo): void {
  r.summary = String(r.summary || '').slice(0, 200)
  r.summaryZh = String(r.summaryZh || '').slice(0, 80)
  r.fullDescription = String(r.fullDescription || '').slice(0, 500)
  r.fullDescriptionZh = String(r.fullDescriptionZh || '').slice(0, 400)
  r.projectType = String(r.projectType || '').toLowerCase().trim() as ProjectType
  r.category = String(r.category || '').toLowerCase().trim()
  if (!Array.isArray(r.tags)) {
    r.tags = typeof r.tags === 'string' ? String(r.tags).split(',').map(s => s.trim()) : []
  }
  // 合并 GitHub topics，去重
  const merged = new Set<string>()
  for (const t of [...(repo.topics || []), ...r.tags]) {
    const v = String(t || '').toLowerCase().trim().replace(/\s+/g, '-')
    if (v) merged.add(v)
  }
  r.tags = Array.from(merged).slice(0, 8)
}

function validateLibraryResult(r: LibraryAIResult): string | null {
  if (!r.summary || !r.summaryZh) return 'missing summary'
  if (!r.fullDescription || !r.fullDescriptionZh) return 'missing fullDescription'
  if (!VALID_PROJECT_TYPES.includes(r.projectType)) return `invalid projectType: ${r.projectType}`
  if (!VALID_CATEGORIES.includes(r.category)) return `invalid category: ${r.category}`
  if (!Array.isArray(r.tags) || r.tags.length === 0) return 'tags must be non-empty array'
  return null
}

// ========== 持久化 ==========
async function persistLibraryEntry(
  env: Env,
  repo: GitHubRepoInfo,
  ai: LibraryAIResult,
  readmePreview: string,
): Promise<void> {
  const [, repoName] = repo.full_name.split('/')
  const slug = slugify(repo.full_name)

  const stmts = [
    // 主表 INSERT OR IGNORE (幂等: 靠 github_repo_id UNIQUE)
    env.DB.prepare(
      `INSERT OR IGNORE INTO apps_library (
         github_repo_id, slug, name, full_name, description, summary, full_description,
         readme_preview, tags, language, project_type, category,
         stars_count, html_url, homepage, license, last_updated, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
    ).bind(
      repo.id, slug, repoName, repo.full_name,
      repo.description || null,
      ai.summary, ai.fullDescription,
      readmePreview,
      JSON.stringify(ai.tags),
      repo.language || null,
      ai.projectType, ai.category,
      repo.stargazers_count,
      repo.html_url,
      repo.homepage || null,
      repo.license?.spdx_id || null,
      repo.pushed_at || null,
    ),
    // 翻译表: 需要 library_id, 用子查询获取 (避免 batch 中的先后依赖)
    env.DB.prepare(
      `INSERT OR REPLACE INTO apps_library_translations (library_id, locale, summary, full_description)
       VALUES ((SELECT id FROM apps_library WHERE github_repo_id = ?1), 'en', ?2, ?3)`,
    ).bind(repo.id, ai.summary, ai.fullDescription),
    env.DB.prepare(
      `INSERT OR REPLACE INTO apps_library_translations (library_id, locale, summary, full_description)
       VALUES ((SELECT id FROM apps_library WHERE github_repo_id = ?1), 'zh', ?2, ?3)`,
    ).bind(repo.id, ai.summaryZh, ai.fullDescriptionZh),
    // 更新 raw_apps 终态
    env.DB.prepare(
      `UPDATE raw_apps SET etl_status = 'library_imported', error_log = NULL,
                            last_processed_at = CURRENT_TIMESTAMP
       WHERE full_name = ?1`,
    ).bind(repo.full_name),
  ]
  await env.DB.batch(stmts)
}

// ========== 主流程 ==========
/**
 * 扫描候选并批量提升到 apps_library
 */
export async function promoteToLibrary(env: Env): Promise<LibraryBatchStats> {
  const stats: LibraryBatchStats = { scanned: 0, promoted: 0, aiFailed: 0, dbFailed: 0, noData: 0 }
  const ai = new LibraryAIClient(env.OPENAI_API_KEY)
  let consecutiveAIFailures = 0

  outer: for (let batchIdx = 0; batchIdx < MAX_BATCHES_PER_RUN; batchIdx++) {
    const candidates = await fetchLibraryCandidates(env, BATCH_SIZE)
    if (candidates.length === 0) {
      console.log(`[Library] no more candidates after ${batchIdx} batches`)
      break
    }
    console.log(`[Library] batch ${batchIdx + 1}: ${candidates.length} candidates`)
    stats.scanned += candidates.length

    for (const c of candidates) {
      try {
        let repo: GitHubRepoInfo
        try { repo = JSON.parse(c.raw_api_data) as GitHubRepoInfo }
        catch {
          stats.noData++
          console.warn(`[Library] ${c.full_name}: raw_api_data parse failed`)
          continue
        }
        if (!repo.id) { stats.noData++; continue }

        const readme = c.readme_content || ''
        const aiResult = await ai.generate(repo, readme).catch(err => {
          console.warn(`[Library] ${c.full_name} AI failed:`, (err as Error).message)
          stats.aiFailed++
          return null
        })
        if (!aiResult) {
          consecutiveAIFailures++
          // AI 连续失败时熔断退出，保留 waitUntil 配额且不改变 fetch 条件（失败项下次 cron 再试，避免在 raw_apps 状态里锁死）
          if (
            consecutiveAIFailures >= MAX_CONSECUTIVE_AI_FAILURES ||
            stats.aiFailed >= MAX_TOTAL_AI_FAILURES
          ) {
            console.warn(
              `[Library] AI failure threshold hit (consecutive=${consecutiveAIFailures}, total=${stats.aiFailed}), breaking early to preserve waitUntil budget`,
            )
            break outer
          }
          continue
        }
        consecutiveAIFailures = 0

        const preview = buildReadmePreview(readme)
        try {
          await persistLibraryEntry(env, repo, aiResult, preview)
          stats.promoted++
          // 向量 embedding（失败不阻塞）
          try {
            await upsertEmbedding(
              env, `lib_${repo.id}`, repo.name, repo.description || '',
              aiResult.summaryZh, aiResult.summary,
              aiResult.tags, aiResult.category,
            )
          } catch { /* embedding 失败静默 */ }
          // 多语言翻译任务
          try {
            const libAppId = `lib_${repo.id}`
            for (const tl of ['ja', 'ko', 'es', 'pt-BR']) {
              await env.DB.prepare(
                `INSERT OR IGNORE INTO translation_tasks (app_id, source_locale, target_locale) VALUES (?, 'zh', ?)`,
              ).bind(libAppId, tl).run()
            }
          } catch { /* 忽略 */ }
          console.log(`[Library] ${c.full_name} → ${aiResult.projectType}/${aiResult.category}`)
        } catch (err) {
          stats.dbFailed++
          console.warn(`[Library] ${c.full_name} DB failed:`, (err as Error).message)
        }
      } catch (err) {
        console.warn(`[Library] ${c.full_name} unexpected:`, (err as Error).message)
      }
    }

    // 批间小憩，避免 AI 连续调用冲击
    await new Promise(r => setTimeout(r, 500))
  }

  console.log('[Library] done:', stats)
  return stats
}
