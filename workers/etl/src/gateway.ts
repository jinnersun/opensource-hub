/**
 * Cloudflare AI Gateway 统一调用工具
 *
 * 三个 Gateway 端点:
 *   deepseek      → https://gateway.ai.cloudflare.com/v1/{account}/deepseek/chat/completions
 *   my-gemini-proxy → https://gateway.ai.cloudflare.com/v1/{account}/my-gemini-proxy/v1beta/models/gemini-2.0-flash:generateContent
 *   qwen          → https://gateway.ai.cloudflare.com/v1/{account}/qwen/compatible-mode/v1/chat/completions
 */

// ---- Gateway URL 构建 ----

function gatewayBase(account: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${account}`
}

export function deepseekUrl(account: string): string {
  return `${gatewayBase(account)}/deepseek/chat/completions`
}

export function geminiUrl(account: string): string {
  return `${gatewayBase(account)}/my-gemini-proxy/v1beta/models/gemini-2.0-flash:generateContent`
}

export function qwenUrl(account: string): string {
  return `${gatewayBase(account)}/qwen/compatible-mode/v1/chat/completions`
}

// ---- DeepSeek (OpenAI-compatible) ----

export async function callDeepSeek(
  account: string,
  apiKey: string,
  body: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number },
  timeoutMs = 60000
): Promise<string> {
  const resp = await fetch(deepseekUrl(account), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek-v4-flash',
      ...body,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    if (resp.status === 429) throw new Error(`DeepSeek rate limit: ${resp.status} ${text.slice(0, 200)}`)
    throw new Error(`DeepSeek API error: ${resp.status} ${text.slice(0, 200)}`)
  }

  const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

// ---- Gemini ----

export async function callGemini(
  account: string,
  apiKey: string,
  prompt: string,
  timeoutMs = 30000
): Promise<string> {
  const resp = await fetch(geminiUrl(account), {
    method: 'POST',
    headers: {
      'x-goog-api-key': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Gemini API error: ${resp.status} ${text.slice(0, 200)}`)
  }

  const data = await resp.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ---- Qwen (OpenAI-compatible) ----

export async function callQwen(
  account: string,
  apiKey: string,
  body: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number },
  timeoutMs = 30000
): Promise<string> {
  const resp = await fetch(qwenUrl(account), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'qwen-plus',
      ...body,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })

  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    if (resp.status === 429) throw new Error(`Qwen rate limit: ${resp.status} ${text.slice(0, 200)}`)
    throw new Error(`Qwen API error: ${resp.status} ${text.slice(0, 200)}`)
  }

  const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

// ---- 批量测试接口 ----

export interface GatewayTestResult {
  provider: string
  ok: boolean
  latencyMs: number
  preview: string
  error?: string
}

export async function testAllGateways(account: string, keys: {
  deepseek: string
  gemini: string
  qwen: string
}): Promise<GatewayTestResult[]> {
  const results: GatewayTestResult[] = []

  // DeepSeek
  const dsStart = Date.now()
  try {
    const text = await callDeepSeek(account, keys.deepseek, {
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 10,
      temperature: 0,
    }, 15000)
    results.push({ provider: 'deepseek', ok: text.includes('OK'), latencyMs: Date.now() - dsStart, preview: text.slice(0, 80) })
  } catch (e: any) {
    results.push({ provider: 'deepseek', ok: false, latencyMs: Date.now() - dsStart, preview: '', error: e.message })
  }

  // Gemini
  const gmStart = Date.now()
  try {
    const text = await callGemini(account, keys.gemini, 'Reply with exactly: OK', 15000)
    results.push({ provider: 'gemini', ok: text.includes('OK'), latencyMs: Date.now() - gmStart, preview: text.slice(0, 80) })
  } catch (e: any) {
    results.push({ provider: 'gemini', ok: false, latencyMs: Date.now() - gmStart, preview: '', error: e.message })
  }

  // Qwen
  const qwStart = Date.now()
  try {
    const text = await callQwen(account, keys.qwen, {
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 10,
      temperature: 0,
    }, 15000)
    results.push({ provider: 'qwen', ok: text.includes('OK'), latencyMs: Date.now() - qwStart, preview: text.slice(0, 80) })
  } catch (e: any) {
    results.push({ provider: 'qwen', ok: false, latencyMs: Date.now() - qwStart, preview: '', error: e.message })
  }

  return results
}
