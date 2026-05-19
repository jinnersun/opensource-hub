---
name: osh-api-proxy
description: Debug and maintain the /api/proxy route in OpenSource-Hub. Use when API calls fail, proxy returns errors, Service Binding isn't working, or adding new HTTP methods/headers.
---

# API Proxy Development

OpenSource-Hub 的核心数据通道 `/api/proxy` 的开发、调试和维护工作流。

## When to Use

- 前端 API 调用返回 500/404/401
- Service Binding 连接失败
- 需要新增 HTTP 方法支持（当前仅 GET/POST）
- 需要转发新的请求头
- 调试缓存策略问题
- 修改 `web/app/api/proxy/route.ts`

## How the Proxy Works

```
Browser fetch('/api/proxy?path=/api/home&lang=zh&category=ai')
    │
    ▼
web/app/api/proxy/route.ts
    │  1. 提取 path 参数 → /api/home
    │  2. 收集其他参数 → lang=zh&category=ai
    │  3. 拼接: http://internal/api/home?lang=zh&category=ai
    │
    ▼
Try: env.API.fetch(new Request('http://internal/api/home?lang=zh&category=ai'))
    │  (Service Binding — 生产环境 / open-next preview)
    │
    ├─ 成功 → 返回数据
    │
    └─ 失败 → Fallback: fetch('http://localhost:8787/api/home?lang=zh&category=ai')
              (开发环境)
```

## Key Constraints

1. **只转发两个请求头**: `Content-Type` 和 `Authorization`
2. **仅支持 GET 和 POST** — 如需 PUT/DELETE，需修改 `forward()` 函数
3. **Admin 路由不缓存**: `Cache-Control: no-store`
4. **公开路由缓存 60 秒**: `Cache-Control: public, max-age=60`

## Critical Bug: URL Encoding

**永远不要用 `encodeURIComponent` 编码代理路径参数！**

```typescript
// ❌ WRONG — %26 被 new URL() 解码为 &，导致参数分裂
const apiUrl = `/api/proxy?path=${encodeURIComponent('/api/apps?category=ai&limit=10')}`
// URL 变成: /api/proxy?path=/api/apps%3Fcategory%3Dai%26limit%3D10
// new URL() 解析后: path=/api/apps?category=ai&limit=10 ← limit=10 被当成 proxy 的参数！

// ✅ RIGHT — 用 flat params 模式
const sp = new URLSearchParams({ path: '/api/apps' })
sp.set('category', 'ai')
sp.set('limit', '10')
fetch(`/api/proxy?${sp.toString()}`)
// URL: /api/proxy?path=/api/apps&category=ai&limit=10
// proxy 内部收集 path 之外的所有参数，拼接成 /api/apps?category=ai&limit=10
```

## Flat Params Pattern (前端 API 客户端)

`web/lib/api.ts` 中的 `buildApiUrl()` 已实现此模式：

```typescript
function buildApiUrl(path: string, params?: Record<string,string>): string {
  const sp = new URLSearchParams({ path })
  if (params) Object.entries(params).forEach(([k,v]) => sp.set(k, String(v)))
  return `/api/proxy?${sp.toString()}`
}
```

所有 `apiRequest()` 调用都使用 `path + params` 分离模式：
- `apiRequest('/api/home', { lang: locale })`
- `apiRequest('/api/apps', { category: 'ai', limit: '24', lang: 'zh' })`

## Adding a New HTTP Method

如需支持 PUT/DELETE，修改 `web/app/api/proxy/route.ts`：

```typescript
// 在文件末尾添加
export async function PUT(request: Request) {
  const body = await request.text().catch(() => undefined)
  return forward(request, 'PUT', body)
}

export async function DELETE(request: Request) {
  return forward(request, 'DELETE')
}
```

## Adding a New Forwarded Header

修改 `forward()` 中的 header 转发逻辑：

```typescript
// 当前只转发这两个
if (auth) (init.headers as Record<string,string>)['Authorization'] = auth

// 添加新的头转发
const customHeader = request.headers.get('X-Custom-Header')
if (customHeader) (init.headers as Record<string,string>)['X-Custom-Header'] = customHeader
```

## Debugging Checklist

```
[ ] 检查 path 参数是否正确（不以 ? 开头，不包含 URL 编码）
[ ] 确认 API Worker 正在运行（dev: localhost:8787, prod: Service Binding）
[ ] 检查 Authorization header 是否被正确转发（admin 路由 401 常见原因）
[ ] 查看浏览器 Network 面板，确认请求 URL 格式
[ ] 检查是否有 %26 等编码字符（说明用了 encodeURIComponent）
[ ] Admin 路由确认 Cache-Control: no-store（否则可能读到旧缓存）
[ ] POST 请求确认 body 被正确转发
[ ] 检查 Service Binding fallback 是否正常工作
```

## Common Error Patterns

| Error | Likely Cause |
|-------|-------------|
| `Missing path parameter` | URL 中没有 `path` query param |
| `Service binding not available` (dev) | API Worker 未在 localhost:8787 运行 |
| `401 Unauthorized` | Authorization header 未转发或 token 错误 |
| `405 Method Not Allowed` | 使用了 GET/POST 以外的方法 |
| 参数丢失 | `%26` 编码导致参数被 `new URL()` 拆分 |
| Admin 数据不刷新 | Cache-Control 设置错误 |
