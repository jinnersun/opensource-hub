/**
 * AI 内容生成（DeepSeek，OpenAI 兼容协议）
 */

import type { AIResult, GitHubRepoInfo } from './types'

const VALID_CATEGORIES = [
  'system', 'ai', 'video', 'privacy', 'clean-install',
  'dev-tools', 'file-management', 'design', 'office',
]

const PROMPT_TEMPLATE = `你是一个专业的开源软件分析师。请分析以下 GitHub 项目的 README 和元数据，生成结构化的多语言内容。

项目信息：
- 名称：{name}
- 描述：{description}
- Stars：{stars}
- 协议：{license}

README 内容：
{readme}

请以 JSON 格式返回以下字段（必须全部包含）：

{
  "name": "项目名称（保留原始英文名）",
  "slug": "url-friendly-name",
  "description": "Short description in English (under 50 words, used as canonical/fallback)",
  "fullDescription": "Full description in English (under 200 words, used as canonical/fallback)",
  "fullDescriptionZh": "完整描述（中文，200字以内）",
  "fullDescriptionEn": "Full description in English (under 200 words)",
  "category": "分类 slug（system/ai/video/privacy/clean-install/dev-tools/file-management/design/office）",
  "tags": ["标签1", "标签2", "标签3"],
  "license": "开源协议",
  "homepage": "官方主页",

  "descriptionZh": "简短描述（中文，50字以内）",
  "summaryZh": "一句话白话总结（中文，30 字以内）",
  "featuresZh": ["功能1", "功能2", "功能3"],
  "useCasesZh": ["场景1", "场景2"],
  "quickStartGuideZh": ["步骤1：下载安装包并双击运行", "步骤2：按向导完成安装", "步骤3：启动应用即可使用"],
  "uninstallGuideZh": "卸载说明（中文）",
  "caveatsZh": "避坑指南（中文）",

  "summaryEn": "One-sentence summary (English, under 30 words)",
  "descriptionEn": "Short description (English)",
  "featuresEn": ["Feature 1", "Feature 2"],
  "useCasesEn": ["Use case 1", "Use case 2"],
  "quickStartGuideEn": ["Step 1: Download installer and double-click to run", "Step 2: Follow the wizard", "Step 3: Launch the app"],
  "uninstallGuideEn": "Uninstall guide (English)",
  "caveatsEn": "Caveats (English)",

  "qualityScore": 0.95,
  "modelVersion": "deepseek-v4-flash"
}

要求：
1. 内容要通俗易懂，避免技术黑话
2. 突出核心卖点和适用场景
3. 明确说明不能做什么（避坑）
4. 质量评分 0-1，基于 README 完整度和项目活跃度
5. 必须返回合法的 JSON，不要包含 markdown 代码块标记
6. quickStartGuideZh / quickStartGuideEn 必须是字符串数组（每一步一个元素），不要使用换行符或编号前缀
7. 无论 README 原文是中文还是英文，都必须生成完整的中英双语内容。中文字段必须是地道中文，英文字段必须是地道英文，严禁混用
8. description/fullDescription（顶层）必须是英文；descriptionZh/fullDescriptionZh 必须是中文`

export class AIClient {
  constructor(private apiKey: string) {}

  /**
   * 生成 AI 内容，带内部重试
   * 重试场景：
   * - 429 限流：重试 2 次，指数退避 2s/5s
   * - 5xx 服务端错误：重试 2 次，指数退避 1s/3s
   * - JSON 解析失败：重试 2 次，提高 temperature 触发重新生成
   * - 校验失败：重试 1 次
   * 代价：最差情况下一个项目耗费 3 个 DeepSeek subrequest
   */
  async generate(repo: GitHubRepoInfo, readme: string, timeoutMs = 60_000): Promise<AIResult> {
    const MAX_ATTEMPTS = 3
    let lastErr: Error | null = null

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      try {
        return await this.generateOnce(repo, readme, timeoutMs, attempt)
      } catch (err) {
        const e = err as Error
        lastErr = e
        const msg = e.message || ''
        const isRetryable =
          msg.includes('AI rate limit') ||        // 429
          msg.includes('AI API error: 5') ||      // 5xx
          msg === 'AI returned invalid JSON' ||
          msg.startsWith('AI result validation failed')

        if (!isRetryable || attempt === MAX_ATTEMPTS - 1) throw e

        // 指数退避：429 更长等待，其他更短
        const isRateLimit = msg.includes('AI rate limit')
        const waitMs = isRateLimit
          ? (attempt === 0 ? 2000 : 5000)
          : (attempt === 0 ? 1000 : 3000)
        await new Promise(r => setTimeout(r, waitMs))
        console.warn(`[AI retry ${attempt + 1}/${MAX_ATTEMPTS - 1}] ${repo.full_name}: ${msg.slice(0, 120)}`)
      }
    }
    throw lastErr || new Error('AI generate failed after retries')
  }

  private async generateOnce(
    repo: GitHubRepoInfo,
    readme: string,
    timeoutMs: number,
    attempt: number,
  ): Promise<AIResult> {
    const prompt = PROMPT_TEMPLATE
      .replace('{name}', repo.name)
      .replace('{description}', repo.description || '')
      .replace('{stars}', String(repo.stargazers_count))
      .replace('{license}', repo.license?.spdx_id || 'Unknown')
      .replace('{readme}', readme.slice(0, 10_000))

    // 重试时适当提高 temperature，避免确定性重复产出同样的失败结果
    const temperature = attempt === 0 ? 0.3 : Math.min(0.6, 0.3 + attempt * 0.15)

    const resp = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-v4-flash',
        messages: [
          { role: 'system', content: '你是一个专业的开源软件分析师。' },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_tokens: 2000,
        stream: false,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })

    if (!resp.ok) {
      const text = await resp.text().catch(() => '')
      if (resp.status === 429) {
        throw new Error(`AI rate limit: ${resp.status} ${text.slice(0, 200)}`)
      }
      throw new Error(`AI API error: ${resp.status} ${text.slice(0, 200)}`)
    }

    const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
    const raw = data.choices?.[0]?.message?.content || ''
    const cleaned = raw
      .replace(/^```json\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()

    let result: AIResult
    try {
      result = JSON.parse(cleaned) as AIResult
    } catch {
      throw new Error('AI returned invalid JSON')
    }

    normalizeAIResult(result)

    if (!validateAIResult(result)) {
      throw new Error('AI result validation failed (missing/invalid required fields)')
    }
    return result
  }
}

// AI 偶尔会把字符串字段返回成数组，统一规整以避免 D1 binding 时的 TYPE_ERROR
function toStringField(v: unknown): string {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return v.map(x => String(x)).join('\n')
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function toStringArray(v: unknown): string[] {
  if (v == null) return []
  if (Array.isArray(v)) return v.map(x => String(x))
  if (typeof v === 'string') return v.split(/\n|,/).map(s => s.trim()).filter(Boolean)
  return [String(v)]
}

export function normalizeAIResult(r: AIResult): void {
  // 字符串字段
  r.name = toStringField(r.name)
  r.slug = toStringField(r.slug)
  r.description = toStringField(r.description)
  r.fullDescription = toStringField(r.fullDescription)
  r.category = toStringField(r.category)
  r.license = toStringField(r.license)
  r.homepage = toStringField(r.homepage)
  r.summaryZh = toStringField(r.summaryZh)
  r.summaryEn = toStringField(r.summaryEn)
  r.descriptionEn = toStringField(r.descriptionEn)
  r.fullDescriptionZh = toStringField(r.fullDescriptionZh)
  r.fullDescriptionEn = toStringField(r.fullDescriptionEn)
  r.descriptionZh = toStringField(r.descriptionZh)
  r.uninstallGuideZh = toStringField(r.uninstallGuideZh)
  r.uninstallGuideEn = toStringField(r.uninstallGuideEn)
  r.caveatsZh = toStringField(r.caveatsZh)
  r.caveatsEn = toStringField(r.caveatsEn)
  r.modelVersion = toStringField(r.modelVersion) || 'deepseek-v4-flash'
  // 数组字段
  r.tags = toStringArray(r.tags)
  r.featuresZh = toStringArray(r.featuresZh)
  r.featuresEn = toStringArray(r.featuresEn)
  r.useCasesZh = toStringArray(r.useCasesZh)
  r.useCasesEn = toStringArray(r.useCasesEn)
  r.quickStartGuideZh = toStringArray(r.quickStartGuideZh)
  r.quickStartGuideEn = toStringArray(r.quickStartGuideEn)
  // 数值字段
  if (typeof r.qualityScore !== 'number') {
    const n = Number(r.qualityScore)
    r.qualityScore = Number.isFinite(n) ? n : 0.5
  }
  r.qualityScore = Math.max(0, Math.min(1, r.qualityScore))
}

export function validateAIResult(r: AIResult): boolean {
  if (!r?.name || !r.slug || !r.category) return false
  if (!VALID_CATEGORIES.includes(r.category)) return false
  if (!r.summaryZh || !r.summaryEn) return false
  if (typeof r.qualityScore !== 'number' || r.qualityScore < 0 || r.qualityScore > 1) return false
  return true
}
