/**
 * Cloudflare AI Gateway 统一调用 (Universal Endpoint + BYOK)
 * 代码中不传 Provider API Key，Gateway 从 Vault 自动注入
 */

export interface GatewayClient {
  account: string
  token: string
  qwenKey?: string
  qwenWorkspace?: string  // 百炼业务空间
}

function url(account: string, gateway: string, provider: string, path: string): string {
  return `https://gateway.ai.cloudflare.com/v1/${account}/${gateway}/${provider}/${path}`
}

const headers = (token: string) => ({
  'Content-Type': 'application/json',
  'cf-aig-authorization': `Bearer ${token}`,
})

// DeepSeek ✅ verified (provider=deepseek, model=deepseek-chat)
export async function callDeepSeek(
  client: GatewayClient,
  body: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number },
  timeoutMs = 60000
): Promise<string> {
  const resp = await fetch(url(client.account, 'deepseek', 'deepseek', 'v1/chat/completions'), {
    method: 'POST',
    headers: headers(client.token),
    body: JSON.stringify({ model: 'deepseek-chat', ...body, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return handleOpenAIResp(resp, 'deepseek')
}

// Qwen
export async function callQwen(
  client: GatewayClient,
  body: { messages: Array<{ role: string; content: string }>; temperature?: number; max_tokens?: number },
  timeoutMs = 60000
): Promise<string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (client.qwenKey) {
    h['Authorization'] = `Bearer ${client.qwenKey}`
  }
  if (client.qwenWorkspace) {
    h['X-DashScope-WorkSpace'] = client.qwenWorkspace
  }
  // Qwen 不走 Gateway，直连百炼 DashScope OpenAI 兼容端点
  const resp = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
    method: 'POST',
    headers: h,
    body: JSON.stringify({ model: 'qwen-plus', ...body, stream: false }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return handleOpenAIResp(resp, 'qwen')
}

// Gemini ✅
export async function callGemini(client: GatewayClient, prompt: string, timeoutMs = 30000): Promise<string> {
  const resp = await fetch(
    url(client.account, 'my-gemini-proxy', 'google-ai-studio', 'v1beta/models/gemini-2.5-flash:generateContent'),
    {
      method: 'POST',
      headers: headers(client.token),
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    }
  )
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`gemini ${resp.status}: ${text.slice(0, 300)}`)
  }
  const data = await resp.json() as { candidates: Array<{ content: { parts: Array<{ text: string }> } }> }
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

async function handleOpenAIResp(resp: Response, name: string): Promise<string> {
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`${name} ${resp.status}: ${text.slice(0, 300)}`)
  }
  const data = await resp.json() as { choices: Array<{ message: { content: string } }> }
  return data.choices?.[0]?.message?.content || ''
}
