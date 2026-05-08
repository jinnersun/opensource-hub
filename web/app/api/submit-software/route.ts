/**
 * 提交软件：转发到 workers/api POST /api/submissions
 * - 不再进行本地 Mock 存储
 * - 所有数据进入 D1 user_submissions 表，等待人工审核
 * - source=software
 */
import { NextResponse } from 'next/server'

export const runtime = 'edge'

async function callApiWorker(body: unknown, headers: Headers): Promise<Response> {
  const apiPath = '/api/submissions'

  // 优先 Service Binding（生产环境 Cloudflare Pages）
  try {
    const cloudflareContext = (globalThis as unknown as Record<symbol, unknown>)[
      Symbol.for('__cloudflare-context__')
    ] as { env?: { API?: { fetch: typeof fetch } } } | undefined
    const apiBinding = cloudflareContext?.env?.API
    if (apiBinding && typeof apiBinding.fetch === 'function') {
      const apiRequest = new Request(`http://internal${apiPath}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'CF-Connecting-IP': headers.get('CF-Connecting-IP') || '',
          'User-Agent': headers.get('user-agent') || '',
        },
        body: JSON.stringify(body),
      })
      return await apiBinding.fetch(apiRequest)
    }
  } catch (err) {
    console.warn('Service Binding unavailable, fallback to direct URL', err)
  }

  // Fallback：开发或 SSR 无 binding 时走配置的 API URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8787'
  return await fetch(`${baseUrl}${apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'CF-Connecting-IP': headers.get('CF-Connecting-IP') || '',
      'User-Agent': headers.get('user-agent') || '',
    },
    body: JSON.stringify(body),
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: '请求体格式错误' }, { status: 400 })
    }

    const { name, repoUrl, description, email } = body as Record<string, unknown>

    if (!name || !repoUrl || !description) {
      return NextResponse.json(
        { error: '软件名称、仓库链接和功能描述为必填项' },
        { status: 400 },
      )
    }
    if (typeof repoUrl !== 'string' || !repoUrl.includes('github.com')) {
      return NextResponse.json({ error: '请提供有效的 GitHub 仓库链接' }, { status: 400 })
    }

    const res = await callApiWorker(
      { source: 'software', name, repoUrl, description, email: email || null },
      request.headers as Headers,
    )

    const text = await res.text()
    return new Response(text, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('submit-software error:', err)
    return NextResponse.json({ error: '提交失败' }, { status: 500 })
  }
}
