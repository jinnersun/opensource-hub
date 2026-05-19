---
name: osh-d1-migration
description: D1 database migration workflow for OpenSource-Hub. Use when creating schema changes, adding tables, modifying columns, or applying migrations.
---

# D1 Migration

OpenSource-Hub 的 Cloudflare D1 数据库迁移工作流。基于 SQLite，所有查询必须参数化。

## When to Use

- 创建新表或修改现有表结构
- 添加索引或约束
- 数据回填/修复脚本
- 调试 SQL 查询性能问题
- 核对数据库字段名（避免 SELECT * 猜测字段）

## Migration Workflow

### 1. Create Migration File

```
migrations/014_your_migration_name.sql
```

命名规范: `{序号}_{描述性名称}.sql`

### 2. Migration Content Template

```sql
-- Migration: 014_your_migration_name
-- Description: What this migration does
-- Date: YYYY-MM-DD

-- Add your DDL/DML here

-- Example: Add a column
-- ALTER TABLE apps ADD COLUMN new_field TEXT;

-- Example: Create index
-- CREATE INDEX IF NOT EXISTS idx_apps_new_field ON apps(new_field);

-- Example: Backfill data
-- UPDATE apps SET new_field = 'default' WHERE new_field IS NULL;
```

### 3. Apply Migration

```bash
# Apply specific migration
cd web
wrangler d1 execute opensource-hub-db --file ../migrations/014_your_migration_name.sql

# Or apply via npm script
npm run db:migrate
```

### 4. Verify

```bash
# Check table schema
wrangler d1 execute opensource-hub-db --command "PRAGMA table_info(table_name);"

# Verify data
wrangler d1 execute opensource-hub-db --command "SELECT COUNT(*) FROM table_name;"
```

## Table Reference

| Table | Primary Key | Key Foreign Keys |
|-------|------------|------------------|
| `raw_apps` | `github_repo_id` (INTEGER) | — |
| `apps` | `id` (TEXT, `app_{repo_id}`) | `category` → categories.slug |
| `apps_library` | `id` (INTEGER AUTOINCREMENT) | `github_repo_id` (UNIQUE) |
| `app_versions` | `id` (TEXT) | `app_id` → apps.id |
| `app_translations` | `id` (TEXT) | `app_id` → apps.id, `locale` |
| `apps_library_translations` | `id` (TEXT) | `library_id` → apps_library.id, `locale` |
| `translation_tasks` | `id` (INTEGER AUTOINCREMENT) | `app_id`, UNIQUE(`app_id`, `target_locale`) |
| `categories` | `slug` (TEXT) | — |
| `user_submissions` | `id` (TEXT, UUID) | — |

## Field Reference (Common Pitfalls)

### `apps` table
- `id`: `app_{github_repo_id}` format
- `slug`: URL-safe name
- `category`: FK to categories.slug
- `stars_count`: INTEGER
- `status`: 'active' | 'archived'

### `raw_apps` table
- **PK is `github_repo_id`** (NOT `id`! ❌)
- `etl_status`: 'pending' | 'processing' | 'completed' | 'skipped' | 'failed' | 'rate_limited' | 'library_imported'
- `retry_count`: auto-incremented on failure
- `next_check_at`: rate limiting backoff timestamp
- `source`: 'github-awesome' | 'github-search' | etc.

### `apps_library` table
- `id`: auto-increment INTEGER ← for JOINs
- `github_repo_id`: UNIQUE INTEGER ← for vector IDs
- `project_type`: 'framework' | 'library' | 'cli-tool' | 'application' | 'tutorial' | 'awesome-list' | 'dataset-model' | 'other'

### Translation tables
- `app_translations.app_id` ↔ `apps.id` (`app_{repo_id}`)
- `apps_library_translations.library_id` ↔ `apps_library.id` (auto-increment)
- `locale` values: 'zh', 'en', 'ja', 'ko', 'es', 'pt-BR'

## SQL Rules

### Always parameterize
```sql
-- ✅ Correct
SELECT * FROM apps WHERE category = ? AND status = ?
-- Bind: .bind(category, status)

-- ❌ Wrong — SQL injection risk
SELECT * FROM apps WHERE category = '${category}'
```

### Use explicit column names
```sql
-- ✅ Correct
SELECT a.id, a.name, a.stars_count FROM apps a WHERE a.status = 'active'

-- ❌ Wrong — guessing column names
SELECT * FROM apps WHERE status = 'active'
```

### JOIN patterns
```sql
-- apps + translations (fallback: zh → en)
SELECT a.id, a.name,
  COALESCE(t_req.summary, t_zh.summary) as summary
FROM apps a
LEFT JOIN app_translations t_req ON t_req.app_id = a.id AND t_req.locale = ?
LEFT JOIN app_translations t_zh ON t_zh.app_id = a.id AND t_zh.locale = 'zh'
```

### apps vs apps_library confusion
```sql
-- ✅ apps: JOIN on app_translations.app_id = apps.id
-- ✅ apps_library: JOIN on apps_library_translations.library_id = apps_library.id

-- ❌ Using apps_library_translations.app_id — this column doesn't exist!
```

## Post-Migration Checklist

```
[ ] Migration file in migrations/ with correct sequence number
[ ] All SQL uses parameterized queries (? placeholders)
[ ] No SELECT * (use explicit column names)
[ ] Index added for new JOIN/FK columns
[ ] Verified with PRAGMA table_info()
[ ] Tested on local D1 before deploying
[ ] Backward compatible (no DROP COLUMN without migration plan)
```
