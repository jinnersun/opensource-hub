# Cloudflare 开发模式规范

> 覆盖 Cloudflare Workers / Pages / D1 / KV / Vectorize / Service Binding 的专属规范
> 补充 coding-style.md 和 database.md 中未覆盖的 Cloudflare 上下文

## Service Binding 模式

### API Worker 访问
```typescript
// ✅ 正确 — 通过 Service Binding 内网访问
const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
const apiBinding = ctx?.env?.API
const res = await apiBinding.fetch(new Request('http://internal/api/endpoint?...'))

// ❌ 错误 — API Worker workers_dev=false，无公网 URL
await fetch('https://api-worker.xxx.workers.dev/api/endpoint')
```

### Host 格式
- Service Binding 请求必须用 `http://internal` 作为 host
- 路径为 `/api/xxx` 或 `/admin/xxx`
- Query params 直接拼在 URL 上

### Dev Fallback
```typescript
// 开发环境 Service Binding 不可用时，fallback 到 localhost
try {
  response = await apiBinding.fetch(new Request(apiUrl, init))
} catch {
  response = await fetch(`http://localhost:8787${apiPath}?...`, devInit)
}
```

## D1 数据库

### 绑定声明
```toml
# wrangler.toml
[[d1_databases]]
binding = "DB"
database_name = "opensource-hub-db"
database_id = "9989fa14-ca29-46ef-8c9f-9ab55f6b47d7"
```

### 查询规范
```typescript
// ✅ 参数化查询
const rows = await env.DB.prepare(
  'SELECT a.id, a.name FROM apps a WHERE a.category = ? AND a.status = ?'
).bind(category, 'active').all()

// ❌ 字符串拼接 — SQL 注入风险
const rows = await env.DB.prepare(
  `SELECT * FROM apps WHERE category = '${category}'`
).all()

// ❌ SELECT * — 列名可能不存在或多余
```

### 双表架构
- `apps` → `app_translations` (JOIN ON `app_translations.app_id = apps.id`)
- `apps_library` → `apps_library_translations` (JOIN ON `apps_library_translations.library_id = apps_library.id`)
- 两个表的主键不同：`apps.id` 是 TEXT，`apps_library.id` 是 INTEGER AUTOINCREMENT
- 向量嵌入 ID 格式不同：`app_{github_repo_id}` vs `lib_{github_repo_id}`

## Workers AI

### Embedding 生成
```typescript
const aiRes = await env.AI.run('@cf/baai/bge-small-en-v1.5', {
  text: ['text to embed']
}) as { data: number[][] }
const vector = aiRes.data[0] // Float32Array(384)
```

### 翻译 (m2m100)
```typescript
const result = await env.AI.run('@cf/meta/m2m100-1.2b', {
  text: sourceText,
  source_lang: 'en',
  target_lang: 'ja',  // 简单 ISO-639-1，不是 ja-JP 或 zho_Hans
})
```

### 语言代码速查
| 语言 | m2m100 code | 正确 | 错误 |
|------|------------|------|------|
| 中文 | `zh` | ✅ | ❌ `zho_Hans`, `zh-CN` |
| 英文 | `en` | ✅ | ❌ `eng`, `en-US` |
| 日文 | `ja` | ✅ | ❌ `jpn`, `ja-JP` |
| 韩文 | `ko` | ✅ | ❌ `kor`, `ko-KR` |
| 西班牙 | `es` | ✅ | ❌ `spa`, `es-ES` |
| 葡萄牙 | `pt` | ✅ | ❌ `por`, `pt-BR` |

## Vectorize

### 索引操作
```typescript
// 插入/更新向量 (幂等)
await env.VECTORIZE.upsert([{
  id: `app_${github_repo_id}`,
  values: vector, // Float32Array(384)
  metadata: { name, category }
}])

// 查询
const results = await env.VECTORIZE.query(vector, {
  topK: 20,
  returnValues: false,
  returnMetadata: true,
})
```

### 向量 ID 格式
- Apps: `app_{github_repo_id}`
- Library: `lib_{github_repo_id}`
- ID 不匹配 → 搜索不到该条目

## Cron 触发器

```toml
[triggers]
crons = ["*/15 * * * *"]  # 每 15 分钟
```

- Cron 基于 **UTC 时间**，不是本地时间
- `ctx.waitUntil()` 包裹长时间运行的异步任务
- 单次 invocation 有执行时间限制

## wrangler.toml 配置

### 必须字段
```toml
name = "worker-name"
main = "src/index.ts"
compatibility_date = "2024-04-01"

# Service Binding
[[services]]
binding = "API"
service = "other-worker-name"

# D1
[[d1_databases]]
binding = "DB"
database_name = "opensource-hub-db"
database_id = "xxx"

# AI
[ai]
binding = "AI"

# Vectorize
[[vectorize]]
binding = "VECTORIZE"
index_name = "index-name"
```

## 部署检查清单

```
[ ] workers_dev 设置正确（API Worker 应为 false）
[ ] 所有 binding 在 wrangler.toml 中声明
[ ] secrets 通过 wrangler secret put 配置（不在代码中硬编码）
[ ] cron 表达式正确（基于 UTC）
[ ] ctx.waitUntil() 包裹后台任务
[ ] 前端通过 /api/proxy 代理访问（不直连 Worker URL）
[ ] 开发环境 fallback 到 localhost:8787
[ ] D1 查询全部参数化
[ ] Vectorize ID 格式正确 (app_/lib_ prefix)
[ ] m2m100 语言代码为简单 ISO-639-1
```
