/**
 * Cloudflare AI Gateway 统一调用（B 模式：Key 存在 Gateway，代码不传）
 *
 * 三个 Gateway:
 *   deepseek       → chat/completions (OpenAI 兼容)
 *   my-gemini-proxy → generateContent
 *   qwen           → chat/completions (OpenAI 兼容)
 */

function gatewayBase(account: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${account}`
}

// ---- URL 构建 ----

export function deepseekUrl(account: string): string {
  return `${gatewayBase(account)}/deepseek/chat/completions`
}
export function geminiUrl(account: string): string {
  return `${gatewayBase(account)}/my-gemini-proxy/v1beta/models/gemini-2.0-flash:generateContent`
}
export function qwenUrl(account: string): string {
  return `${gatewayBase(account)}/qwen/compatible-mode/v1/chat/completions`
}

// ---- 调用函数（B 模式不传 Key，Gateway 自动注入） ----

export async function callDeepSeek(
  account: string,
  body: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number },
  timeoutMs = 60000
): Promise<string> {
  const resp = await fetch(deepseekUrl(account), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'deepseek-v4-flash', ...body, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`DeepSeek ${resp.status}: ${text.slice(0, 200)}`)
  }
  const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

export async function callGemini(account: string, prompt: string, timeoutMs = 30000): Promise<string> {
  const resp = await fetch(geminiUrl(account), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Gemini ${resp.status}: ${text.slice(0, 200)}`)
  }
  const data = await resp.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

export async function callQwen(
  account: string,
  body: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number },
  timeoutMs = 30000
): Promise<string> {
  const resp = await fetch(qwenUrl(account), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'qwen-plus', ...body, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`Qwen ${resp.status}: ${text.slice(0, 200)}`)
  }
  const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || ''
}

// ---- 测试 ----

export interface GatewayTestResult {
  provider: string; ok: boolean; latencyMs: number; preview: string; error?: string
}

export async function testAllGateways(account: string): Promise<GatewayTestResult[]> {
  const results: GatewayTestResult[] = []

  const dsStart = Date.now()
  try {
    const text = await callDeepSeek(account, { messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 10, temperature: 0 }, 15000)
    results.push({ provider: 'deepseek', ok: text.includes('OK'), latencyMs: Date.now() - dsStart, preview: text.slice(0, 80) })
  } catch (e: any) {
    results.push({ provider: 'deepseek', ok: false, latencyMs: Date.now() - dsStart, preview: '', error: e.message })
  }

  const gmStart = Date.now()
  try {
    const text = await callGemini(account, 'Reply with exactly: OK', 15000)
    results.push({ provider: 'gemini', ok: text.includes('OK'), latencyMs: Date.now() - gmStart, preview: text.slice(0, 80) })
  } catch (e: any) {
    results.push({ provider: 'gemini', ok: false, latencyMs: Date.now() - gmStart, preview: '', error: e.message })
  }

  const qwStart = Date.now()
  try {
    const text = await callQwen(account, { messages: [{ role: 'user', content: 'Reply with exactly: OK' }], max_tokens: 10, temperature: 0 }, 15000)
    results.push({ provider: 'qwen', ok: text.includes('OK'), latencyMs: Date.now() - qwStart, preview: text.slice(0, 80) })
  } catch (e: any) {
    results.push({ provider: 'qwen', ok: false, latencyMs: Date.now() - qwStart, preview: '', error: e.message })
  }

  return results
}
