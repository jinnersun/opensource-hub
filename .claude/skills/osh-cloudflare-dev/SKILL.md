---
name: osh-cloudflare-dev
description: Cloudflare Workers/D1/KV/Vectorize development patterns for OpenSource-Hub. Use when deploying, debugging, or modifying any Worker (API/ETL/Translator).
---

# Cloudflare Worker Development

OpenSource-Hub 专属的 Cloudflare Workers 开发、调试和部署工作流。

## When to Use

- 修改 `workers/api/index.ts`、`workers/etl/src/`、`workers/translator/src/` 下的任何文件
- 添加新的 API 端点或 Worker 路由
- 调试 Service Binding、D1、KV、Vectorize 相关问题
- 部署 Worker 到 Cloudflare
- 配置 cron 触发器或环境变量

## Architecture Overview

```
Browser → Cloudflare Pages (Next.js via open-next)
              │
              ├── /api/proxy?path=... → API Worker (Service Binding, workers_dev=false)
              │                              ├── D1 (opensource-hub-db)
              │                              ├── Vectorize (opensource-hub-search)
              │                              └── AI (@cf/baai/bge-small-en-v1.5)
              │
              ├── ETL Worker (cron: */15 * * * *)
              │     └── GitHub API → raw_apps → AI content → apps/apps_library + Vectorize
              │
              └── Translator Worker (cron: */5 * * * *)
                    └── translation_tasks → m2m100 → app_translations/apps_library_translations
```

## Key Files

| File | Purpose |
|------|---------|
| `workers/api/index.ts` | REST API (apps, search, categories, admin, sitemap) |
| `workers/api/wrangler.toml` | API Worker config (D1, AI, Vectorize bindings) |
| `workers/etl/src/index.ts` | ETL Worker entry (scheduled + HTTP trigger) |
| `workers/etl/src/scheduler.ts` | Main ETL loop: fetch → AI → persist |
| `workers/etl/src/persistence.ts` | D1 writes + Vectorize upserts |
| `workers/etl/src/ai.ts` | DeepSeek AI content generation |
| `workers/translator/src/index.ts` | Translation task processor |
| `web/wrangler.toml` | Frontend Pages config (Service Binding to API Worker) |

## Worker Development Workflow

### 1. Local Development

```bash
# API Worker (port 8787)
cd workers/api && npm run dev

# ETL Worker (requires secrets)
cd workers/etl && npm run dev

# Translator Worker
cd workers/translator && npm run dev
```

**重要**: API Worker 的 `workers_dev = false`，本地开发时前端 proxy 会自动 fallback 到 `localhost:8787`。

### 2. Secrets Management

ETL Worker 需要的 secrets（通过 `wrangler secret put` 配置）：

```bash
cd workers/etl
wrangler secret put OPENAI_API_KEY    # DeepSeek API Key
wrangler secret put GITHUB_TOKEN      # GitHub PAT (5000 req/h)
wrangler secret put TRIGGER_TOKEN     # ETL/Translator 触发鉴权
```

API Worker 需要的 secrets：

```bash
cd workers/api
wrangler secret put ADMIN_TOKEN       # Admin 面板登录密码
wrangler secret put TRIGGER_TOKEN     # 触发 ETL/翻译任务鉴权
```

### 3. Adding a New API Endpoint

在 `workers/api/index.ts` 的 `fetch()` handler 中添加路由：

```typescript
// GET 路由示例
if (url.pathname === '/api/my-endpoint' && request.method === 'GET') {
  const data = await env.DB.prepare('SELECT ...').all()
  return Response.json({ data })
}

// POST 路由（需要鉴权）
if (url.pathname === '/api/my-endpoint' && request.method === 'POST') {
  const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!auth || auth !== env.ADMIN_TOKEN) {
    return new Response('Unauthorized', { status: 401 })
  }
  // handle POST
}
```

### 4. Changing Worker Bindings

修改 `wrangler.toml` 后必须重新部署才能生效：

```bash
cd workers/api && npm run deploy
```

## Common Traps

1. **`workers_dev = false`** — API Worker 没有公网 URL，只能通过 Service Binding 访问。前端代码不能直接 fetch API Worker 的 URL。

2. **Service Binding 格式**: `env.API.fetch(new Request('http://internal/path?...'))` — 必须用 `http://internal` 作为 host。

3. **D1 参数化查询**: 始终用 `?` 占位符 + `.bind()`，不用字符串拼接。

4. **Vectorize 向量维度**: `bge-small-en-v1.5` 输出 384 维，创建索引时需匹配。

5. **m2m100 语言代码**: 用简单 ISO-639-1（`zh`, `en`, `ja`, `ko`），不用 `zho_Hans` 等扩展码。

6. **cron 触发器的时区**: cron 表达式基于 UTC，不是本地时间。

7. **前端 SSR 不能直连 D1**: open-next 不兼容 `ctx.env.DB`，必须走 Service Binding → API Worker。

8. **`ctx.waitUntil()`**: 异步后台任务必须用 `ctx.waitUntil()` 包裹，否则会在 response 返回后被取消。

## Verification Checklist

```
[ ] wrangler dev 本地运行正常
[ ] API 端点在 /api/proxy?path= 下可访问
[ ] D1 查询使用参数化
[ ] Admin 路由有鉴权
[ ] 新绑定已在 wrangler.toml 中声明
[ ] cron 表达式已更新 wrangler.toml
[ ] secrets 已配置（生产环境）
```
