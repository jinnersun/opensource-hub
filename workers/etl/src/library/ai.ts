/**
 * Library AI: DeepSeek prompt + 解析 + 校验
 */

import type { GatewayClient } from '../gateway'
import { callDeepSeek } from '../gateway'
import type { GitHubRepoInfo } from '../types'

export type ProjectType = 'framework' | 'library' | 'cli-tool' | 'application' | 'tutorial' | 'awesome-list' | 'dataset-model' | 'other'

export interface LibraryAIResult {
  summary: string
  summaryZh: string
  fullDescription: string
  fullDescriptionZh: string
  projectType: ProjectType
  category: string
  tags: string[]
}

const README_FOR_AI_MAX = 8000

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
- Your response MUST start with { and end with }`

export class LibraryAIClient {
  constructor(private apiKey: string, private gateway?: GatewayClient) {}

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
        const retryable = msg.includes('AI rate limit') || msg.includes('AI API error: 5') || msg === 'AI returned invalid JSON' || msg.startsWith('AI result validation failed')
        if (!retryable || attempt === MAX_ATTEMPTS - 1) throw e
        const waitMs = msg.includes('rate limit') ? (attempt === 0 ? 2000 : 5000) : (attempt === 0 ? 1000 : 3000)
        await new Promise(r => setTimeout(r, waitMs))
        console.warn(`[Library AI retry ${attempt + 1}] ${repo.full_name}: ${msg.slice(0, 120)}`)
      }
    }
    throw lastErr || new Error('Library AI failed after retries')
  }

  private async generateOnce(repo: GitHubRepoInfo, readme: string, timeoutMs: number, attempt: number): Promise<LibraryAIResult> {
    const prompt = LIBRARY_PROMPT
      .replace('{full_name}', repo.full_name)
      .replace('{description}', repo.description || '')
      .replace('{stars}', String(repo.stargazers_count))
      .replace('{language}', repo.language || 'unknown')
      .replace('{topics}', (repo.topics || []).join(', ') || 'none')
      .replace('{license}', repo.license?.spdx_id || 'Unknown')
      .replace('{readme}', readme.slice(0, README_FOR_AI_MAX))

    const temperature = attempt === 0 ? 0.2 : Math.min(0.5, 0.2 + attempt * 0.15)

    const raw = this.gateway
      ? await callDeepSeek(this.gateway, {
          messages: [
            { role: 'system', content: 'You are an open-source project analyst. Respond with ONLY a valid JSON object.' },
            { role: 'user', content: prompt },
          ],
          temperature,
          max_tokens: 800,
        }, timeoutMs)
      : await (async () => {
          const resp = await fetch('https://api.deepseek.com/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: 'deepseek-v4-flash', messages: [{ role: 'system', content: 'You are an open-source project analyst. Respond with ONLY a valid JSON object.' }, { role: 'user', content: prompt }], temperature, max_tokens: 800, stream: false }),
            signal: AbortSignal.timeout(timeoutMs),
          })
          if (!resp.ok) {
            const text = await resp.text().catch(() => '')
            if (resp.status === 429) throw new Error(`AI rate limit: ${resp.status} ${text.slice(0, 200)}`)
            throw new Error(`AI API error: ${resp.status} ${text.slice(0, 200)}`)
          }
          const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
          return data.choices?.[0]?.message?.content || ''
        })()

    let result: LibraryAIResult
    try { result = parseLibraryAIJson(raw) }
    catch { throw new Error('AI returned invalid JSON') }

    normalizeLibraryResult(result, repo)

    const err = validateLibraryResult(result)
    if (err) throw new Error(`AI result validation failed: ${err}`)
    return result
  }
}

function parseLibraryAIJson(raw: string): LibraryAIResult {
  const stripped = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim()
  try { return JSON.parse(stripped) as LibraryAIResult }
  catch {
    let depth = 0; let start = -1
    for (let i = 0; i < stripped.length; i++) {
      if (stripped[i] === '{') { if (depth === 0) start = i; depth++ }
      else if (stripped[i] === '}') { depth--; if (depth === 0 && start >= 0) { return JSON.parse(stripped.substring(start, i + 1)) as LibraryAIResult } }
    }
    throw new Error('Cannot parse JSON from AI response')
  }
}

export const VALID_PROJECT_TYPES = ['framework', 'library', 'cli-tool', 'application', 'tutorial', 'awesome-list', 'dataset-model', 'other'] as const

export const VALID_CATEGORIES = ['system', 'ai', 'video', 'privacy', 'clean-install', 'dev-tools', 'file-management', 'design', 'office'] as const

function normalizeLibraryResult(r: LibraryAIResult, repo: GitHubRepoInfo): void {
  r.projectType = (VALID_PROJECT_TYPES as readonly string[]).includes(r.projectType) ? r.projectType : 'other'
  r.category = (VALID_CATEGORIES as readonly string[]).includes(r.category) ? r.category : 'dev-tools'
  r.tags = (Array.isArray(r.tags) ? r.tags : typeof r.tags === 'string' ? r.tags.split(/[\n,]/).map(s => s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').slice(0, 50)).filter(Boolean) : []).slice(0, 6)
  if (r.tags.length === 0 && repo.topics?.length) r.tags = repo.topics.slice(0, 5).map(t => t.toLowerCase().replace(/\s+/g, '-'))
  r.summary = (r.summary || '').slice(0, 120)
  r.summaryZh = (r.summaryZh || '').slice(0, 60)
  r.fullDescription = (r.fullDescription || '').slice(0, 500)
  r.fullDescriptionZh = (r.fullDescriptionZh || '').slice(0, 300)
}

function validateLibraryResult(r: LibraryAIResult): string | null {
  if (!r.projectType || !(VALID_PROJECT_TYPES as readonly string[]).includes(r.projectType)) return `invalid projectType: ${r.projectType}`
  if (!r.category || !(VALID_CATEGORIES as readonly string[]).includes(r.category)) return `invalid category: ${r.category}`
  if (!r.summary || r.summary.length < 5) return 'summary missing or too short'
  if (!r.summaryZh || r.summaryZh.length < 5) return 'summaryZh missing or too short'
  return null
}
