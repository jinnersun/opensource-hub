---
name: osh-etl-pipeline
description: ETL pipeline maintenance for OpenSource-Hub. Use when debugging ETL Workers, fixing data ingestion, managing AI content generation, or handling raw_apps/apps/apps_library pipelines.
---

# ETL Pipeline Maintenance

OpenSource-Hub 的 ETL 数据管道开发、调试和维护工作流。
从 GitHub 采集 → AI 处理 → 数据库入库 → 向量嵌入的完整链路。

## When to Use

- ETL Worker 报错或数据未更新
- 新增数据源或修改数据采集逻辑
- AI 内容生成结果异常（分类不对、内容质量差）
- 向量搜索召回率低需要回填
- `raw_apps` 状态异常需要手动修复
- 调试 `promoteToLibrary` 逻辑

## ETL Pipeline Flow

```
Cron (*/15 min) or POST /etl/trigger
    │
    ▼
scheduler.ts: runEtl(env)
    │
    ├─ 1. Fetch GitHub repos from raw_apps (status=pending, due now)
    │     └─ Uses GITHUB_TOKEN for 5000 req/h
    │
    ├─ 2. Fetch latest release (github.ts + release.ts)
    │     └─ Parses release assets per OS/arch
    │
    ├─ 3. AI content generation (ai.ts)
    │     └─ DeepSeek v4 Flash: summary, features, caveats, useCases
    │     └─ normalizeAIResult() + validateAIResult() before insert
    │
    ├─ 4. Persist to D1 (persistence.ts)
    │     ├─ apps table (or apps_library via promoteToLibrary)
    │     ├─ app_versions (download URLs, SHA-256)
    │     ├─ app_translations (AI content per locale)
    │     └─ translation_tasks (queue for Translator Worker)
    │
    ├─ 5. Vector embedding (upsertEmbedding)
    │     └─ bge-small-en-v1.5 → 384 dimensions
    │     └─ Vectorize upsert (idempotent)
    │
    └─ 6. Record metrics to KV
```

## Key Tables

| Table | PK | Purpose |
|-------|-----|---------|
| `raw_apps` | `github_repo_id` (INTEGER) | ETL staging: GitHub repos to process |
| `apps` | `id` (TEXT, `app_{repo_id}`) | Curated apps with releases |
| `apps_library` | `id` (INTEGER AUTOINC) + `github_repo_id` (UNIQUE) | Libraries/frameworks without releases |
| `app_versions` | `id` (TEXT) | Download assets per OS/arch |
| `app_translations` | `id` (TEXT) | AI content per locale |
| `apps_library_translations` | `id` (TEXT) | Library AI content per locale |
| `translation_tasks` | `id` (INTEGER AUTOINC) | Queued translation jobs |

## CRITICAL: Two Apps Tables

```
apps              ← 有 downloadable release 的项目
  embedding ID:   app_{github_repo_id}
  translations:   app_translations (JOIN ON app_id)

apps_library      ← 高星但无 release 的库/框架
  embedding ID:   lib_{github_repo_id}
  translations:   apps_library_translations (JOIN ON library_id = apps_library.id)
```

**`apps_library` 有两个 ID**: `id` (自增) 用于 JOIN，`github_repo_id` (UNIQUE) 用于向量嵌入 ID。

## Common Issues & Fixes

### ETL 处理失败 (raw_apps.etl_status = 'failed')

```sql
-- 查看失败原因
SELECT github_repo_id, full_name, error_log, retry_count
FROM raw_apps WHERE etl_status = 'failed'
ORDER BY last_processed_at DESC LIMIT 20;

-- 重置为 pending (允许重试)
UPDATE raw_apps SET etl_status = 'pending', retry_count = 0
WHERE github_repo_id = ?;
```

### AI 分类不正确

DeepSeek 可能返回非标准 category 值。ETL 已有 `normalizeAIResult()` 和 `validateAIResult()`：

```typescript
// workers/etl/src/ai.ts
// 无效分类会被替换为默认值或跳过
```

如果某批次分类全错，使用 staging tables 回滚：
- `raw_apps_staging` / `apps_staging` 保存 AI 处理前的快照

### 向量嵌入缺失

```bash
# 手动触发回填（分页执行）
curl -X POST "http://internal/etl/backfill-embeddings?batch=10&offset=0" \
  -H "Authorization: Bearer ${TRIGGER_TOKEN}"

# 库项目回填
curl -X POST "http://internal/etl/backfill-library-embeddings?batch=10&offset=0" \
  -H "Authorization: Bearer ${TRIGGER_TOKEN}"
```

### Rate Limiting (GitHub API)

```
# raw_apps.etl_status = 'rate_limited' → 自动退避
# next_check_at 会被设为当前时间 + exponential backoff
SELECT github_repo_id, next_check_at
FROM raw_apps WHERE etl_status = 'rate_limited';
```

### 翻译任务未创建

ETL 在 AI 处理后自动创建 `translation_tasks`。如果遗漏：

```sql
-- 检查未翻译的 zh→其他语言任务
SELECT a.id, a.name FROM apps a
WHERE a.status = 'active'
AND NOT EXISTS (
  SELECT 1 FROM translation_tasks tt
  WHERE tt.app_id = a.id AND tt.target_locale = 'en'
);
```

## ETL Debugging

```bash
# 查看 ETL 状态
curl http://internal/etl/status

# 查看累计指标
curl http://internal/etl/metrics

# 诊断绑定状态 (AI + Vectorize)
curl http://internal/etl/diag

# 手动触发 ETL
curl -X POST http://internal/etl/trigger \
  -H "Authorization: Bearer ${TRIGGER_TOKEN}"

# 仅刷新版本 (不重跑 AI)
curl -X POST "http://internal/etl/refresh-versions?limit=20" \
  -H "Authorization: Bearer ${TRIGGER_TOKEN}"
```

## Modification Checklist

```
[ ] raw_apps PK 使用 github_repo_id (不是 id)
[ ] AI 生成结果经过 normalizeAIResult + validateAIResult
[ ] 向量嵌入 ID 格式: app_{repo_id} 或 lib_{repo_id}
[ ] 翻译任务 language codes 使用简单码 (zh/en/ja/ko)
[ ] 写入 staging 表后再迁移到正式表
[ ] GITHUB_TOKEN 限流处理 (rate_limited 状态 + 退避)
[ ] ctx.waitUntil() 包裹异步操作
```
