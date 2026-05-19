---
name: osh-search-debug
description: Debug and maintain vector search in OpenSource-Hub. Use when search results are wrong, empty, or irrelevant; Vectorize index needs maintenance; or search performance is poor.
---

# Search Debugging

OpenSource-Hub 的语义搜索调试和维护工作流。
基于 Cloudflare Vectorize + bge-small-en-v1.5 (384维) + D1 SQL 回退。

## When to Use

- 搜索返回空结果或结果不相关
- 新增项目在搜索中找不到
- Vectorize 索引需要回填或重建
- 搜索性能问题
- 调试搜索 SQL 查询

## Search Architecture

```
User Query → /api/search?q=...
    │
    ▼
API Worker: searchApps(db, params, env)
    │
    ├─ 1. Generate query embedding
    │     AI.run('@cf/baai/bge-small-en-v1.5', { text: [query] })
    │     → Float32Array(384)
    │
    ├─ 2. Vectorize query
    │     VECTORIZE.query(values, { topK: 20, returnValues: false })
    │     → [{ id: "app_123", score: 0.85 }, ...]
    │
    ├─ 3. D1 text fallback (if vector results < threshold)
    │     SELECT ... WHERE name LIKE ? OR description LIKE ?
    │
    └─ 4. Merge + rank + return
```

## Embedding Details

- **Model**: `@cf/baai/bge-small-en-v1.5`
- **Dimensions**: 384
- **Index**: `opensource-hub-search`
- **Embedding ID format**:
  - Apps: `app_{github_repo_id}` (e.g., `app_123456`)
  - Library: `lib_{github_repo_id}` (e.g., `lib_789012`)
- **Embedding content**: `name + description + summary(zh) + summary(en) + tags + category`

## Debugging Search Issues

### 1. Check if item is in Vectorize

```sql
-- Check if the app exists in D1
SELECT id, name, stars_count FROM apps WHERE slug = ?;

-- Get the github_repo_id for vector ID
-- app ID format: app_{github_repo_id}
```

### 2. Test embedding generation

```bash
# Use ETL worker diag endpoint
curl http://internal/etl/diag
# Returns: { ai: { ok: true, dimensions: 384 }, vectorize: { ok: true } }
```

### 3. Regenerate embeddings for missing items

```bash
# Backfill apps embeddings (paginated)
curl -X POST "http://internal/etl/backfill-embeddings?batch=10&offset=0" \
  -H "Authorization: Bearer ${TRIGGER_TOKEN}"

# Backfill library embeddings
curl -X POST "http://internal/etl/backfill-library-embeddings?batch=10&offset=0" \
  -H "Authorization: Bearer ${TRIGGER_TOKEN}"
```

### 4. Verify embedding content

The embedding is generated from combined text:
```typescript
const text = `${app.name} ${app.description} ${summaryZh} ${summaryEn} ${tags.join(' ')} ${category}`
```

If search results are poor:
- Check that `app_translations` has `summary` for both zh and en
- Check that `tags` are properly populated (JSON array string)
- Check that `category` is valid

### 5. Check search SQL

The D1 fallback query searches across multiple fields:

```sql
SELECT a.*, COALESCE(t_req.summary, t_zh.summary) as summary
FROM apps a
LEFT JOIN app_translations t_req ON t_req.app_id = a.id AND t_req.locale = ?
LEFT JOIN app_translations t_zh ON t_zh.app_id = a.id AND t_zh.locale = 'zh'
WHERE a.status = 'active'
  AND (a.name LIKE ? OR a.description LIKE ? OR t_req.summary LIKE ? OR t_zh.summary LIKE ?)
```

## Search Ranking

Results are ranked by combining:
1. **Vector similarity score** (from Vectorize) — primary signal
2. **Text relevance** (from SQL LIKE) — fallback
3. **Stars count** — popularity boost
4. **Trending score** — recency boost

## Common Issues

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Empty results for known app | No embedding in Vectorize | Run backfill |
| Results for wrong language | Missing translation | Check app_translations |
| New apps not found | ETL didn't generate embedding | Check ETL status, run backfill |
| All results low relevance | Query text doesn't match embedding content | Check embedding generation input |
| Search 500 error | Vectorize binding missing | Check API Worker wrangler.toml |
| Library items not in search | Missing lib_ prefix embedding | Run backfill-library-embeddings |

## Verification

```bash
# Test search API directly
curl "http://localhost:8787/api/search?q=video+editor&lang=en"

# Test via proxy
curl "http://localhost:3000/api/proxy?path=/api/search&q=video+editor&lang=en"

# Check expected results include known items
```
