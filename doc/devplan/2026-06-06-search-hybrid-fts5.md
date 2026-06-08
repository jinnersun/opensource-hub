# Hybrid Search: FTS5 Trigram + Vector + AI Rewrite

> 创建日期: 2026-06-06 | 状态: 规划中

## 问题

1. **拼写错误无结果**：`hrllo` 搜不到 `hello`。SQL LIKE 零容错，向量模型把 typo 当噪音。
2. **中文搜索失效**：`C盘清理工具` 无结果。`bge-small-en-v1.5` 是纯英文模型，中文查询被 embed 成随机向量。
3. **Disk cleanup 结果不对**：返回的是不相关的视频工具，而非系统清理类软件。

## 三层防线架构

| # | 工具 | 处理什么 | 延迟 | 触发条件 |
|---|------|---------|:--:|------|
| 1 | D1 FTS5 Trigram | 拼写错误、中文分词、专有名词 | ~5ms | 每次搜索 |
| 2 | Vectorize (bge-m3) | 语义意图、自然语言问题 | ~50ms | 每次搜索 |
| 3 | DeepSeek Flash Rewrite | 极端 typo，前两层都失败时纠错 | ~400ms | 仅前两层 0 结果时 |

## Phase 1: D1 FTS5 Trigram

### 建表

```sql
CREATE VIRTUAL TABLE apps_search_index USING fts5(
  app_id UNINDEXED,
  name,
  summary,
  description,
  full_description,
  tags,
  tokenize='trigram'
);

-- 同步 apps
INSERT INTO apps_search_index(app_id, name, summary, description, full_description, tags)
SELECT id, name, summary, description, full_description, tags FROM apps WHERE status='active';

-- 同步 apps_library
CREATE VIRTUAL TABLE libs_search_index USING fts5(
  lib_id UNINDEXED,
  name,
  summary,
  description,
  full_description,
  tags,
  tokenize='trigram'
);

INSERT INTO libs_search_index(lib_id, name, summary, description, full_description, tags)
SELECT github_repo_id, name, summary, description, full_description, tags FROM apps_library WHERE status='active';
```

### Trigram 原理

`hello` 被切分为 `hel, ell, llo`。搜索 `hrllo` 被切分为 `hrl, rll, llo`。`llo` 交集命中 → 模糊匹配成功。

### 触发器（自动同步）

```sql
-- apps 同步
CREATE TRIGGER apps_fts_insert AFTER INSERT ON apps BEGIN
  INSERT INTO apps_search_index(app_id, name, summary, description, full_description, tags)
  VALUES (new.id, new.name, new.summary, new.description, new.full_description, new.tags);
END;

CREATE TRIGGER apps_fts_update AFTER UPDATE ON apps BEGIN
  DELETE FROM apps_search_index WHERE app_id = old.id;
  INSERT INTO apps_search_index(app_id, name, summary, description, full_description, tags)
  VALUES (new.id, new.name, new.summary, new.description, new.full_description, new.tags);
END;
```

### 查询

```sql
-- 模糊搜索：即使输入 hrllo 也能匹配 hello
SELECT a.* FROM apps a
JOIN apps_search_index idx ON a.id = idx.app_id
WHERE apps_search_index MATCH 'hrllo'
ORDER BY rank LIMIT 20;

-- 中文搜索："C盘清理工具" → 被 trigram 切分为多个三元组后匹配
SELECT a.* FROM apps a
JOIN apps_search_index idx ON a.id = idx.app_id
WHERE apps_search_index MATCH 'C盘清理工具'
ORDER BY rank LIMIT 20;
```

## Phase 2: 混合检索 + RRF

### Worker 搜索路由

```typescript
// 并发双路
const [ftsResults, vectorIds] = await Promise.all([
  db.prepare(`SELECT a.* FROM apps a JOIN apps_search_index idx ON a.id = idx.app_id WHERE apps_search_index MATCH ? ORDER BY rank LIMIT 20`).bind(query).all(),
  vectorSearch(env, query),  // 现有 Vectorize 搜索
])

// RRF 合并
const merged = rrfMerge(ftsResults, vectorResults)
```

### RRF 公式

```
score(doc) = Σ 1/(k + rank_i(doc))
k = 60 (常数)
```

## Phase 3: AI 纠错兜底

仅当前两层都返回 0 结果时触发：

```
User: "hrlll dkker" → FTS5: 0 results → Vectorize: 0 results
  → DeepSeek Flash: "Did you mean 'hello docker'?"
  → 用 corrected query 重新搜索
  → 返回结果 + "搜索建议: hello docker"
```

### Prompt

```
Correct spelling and extract keywords from this search query.
Output JSON: {"corrected": "corrected query", "suggestions": ["alt1", "alt2"]}
Input: hrlll dkker
Output: {"corrected": "hello docker", "suggestions": ["docker hello world", "docker tutorial"]}
```

## 实施顺序

| # | 步骤 | 预估 |
|---|------|:--:|
| 1 | Migration: FTS5 虚拟表 + 触发器 | 10 min |
| 2 | 修改 `search.ts`：双路并发 FTS5 + Vectorize | 15 min |
| 3 | RRF 合并算法 | 10 min |
| 4 | DeepSeek Rewrite 兜底 | 10 min |
| 5 | 存量数据灌入 FTS5 表 | 一次性脚本 |
