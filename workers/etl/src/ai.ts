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
  "name": "项目名称",
  "slug": "url-friendly-name",
  "description": "简短描述（50 字以内）",
  "fullDescription": "完整描述（200 字以内）",
  "category": "分类 slug（system/ai/video/privacy/clean-install/dev-tools/file-management/design/office）",
  "tags": ["标签1", "标签2", "标签3"],
  "license": "开源协议",
  "homepage": "官方主页",

  "summaryZh": "一句话白话总结（中文，30 字以内）",
  "featuresZh": ["功能1", "功能2", "功能3"],
  "useCasesZh": ["场景1", "场景2"],
  "quickStartGuideZh": "一分钟上手指南（中文，步骤用 \\n 分隔）",
  "uninstallGuideZh": "卸载说明（中文）",
  "caveatsZh": "避坑指南（中文）",

  "summaryEn": "One-sentence summary (English, under 30 words)",
  "descriptionEn": "Short description (English)",
  "featuresEn": ["Feature 1", "Feature 2"],
  "useCasesEn": ["Use case 1", "Use case 2"],
  "quickStartGuideEn": "Quick start guide (English)",
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
5. 必须返回合法的 JSON，不要包含 markdown 代码块标记`

export class AIClient {
  constructor(private apiKey: string) {}

  async generate(repo: GitHubRepoInfo, readme: string, timeoutMs = 60_000): Promise<AIResult> {
    const prompt = PROMPT_TEMPLATE
      .replace('{name}', repo.name)
      .replace('{description}', repo.description || '')
      .replace('{stars}', String(repo.stargazers_count))
      .replace('{license}', repo.license?.spdx_id || 'Unknown')
      .replace('{readme}', readme.slice(0, 10_000))

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
        temperature: 0.3,
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

    if (!validateAIResult(result)) {
      throw new Error('AI result validation failed (missing/invalid required fields)')
    }
    return result
  }
}

export function validateAIResult(r: AIResult): boolean {
  if (!r?.name || !r.slug || !r.category) return false
  if (!VALID_CATEGORIES.includes(r.category)) return false
  if (!r.summaryZh || !r.summaryEn) return false
  if (typeof r.qualityScore !== 'number' || r.qualityScore < 0 || r.qualityScore > 1) return false
  return true
}
