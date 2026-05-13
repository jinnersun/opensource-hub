# 数据库规范

> 对应 Bug 类型 C：没核对数据库 Schema

## 规则

每次写 SQL 查询或前端数据展示前：
1. 确认表的实际列名和主键（读迁移脚本）
2. 前端接口类型与实际返回字段一致
3. 禁止用 `SELECT *` 然后猜测字段名

## 表结构速查

| 表 | 主键 | 常用字段 |
|----|------|---------|
| `raw_apps` | `github_repo_id` (INTEGER) | full_name, etl_status, error_log, retry_count, source |
| `apps` | `id` (TEXT, `app_{repo_id}`) | name, slug, category, stars_count, status |
| `apps_library` | `id` (INTEGER AUTOINCREMENT) + `github_repo_id` (UNIQUE) | name, project_type, stars_count, status |
| `app_translations` | `id` (TEXT) | app_id, locale, summary, description, full_description |
| `app_versions` | `id` (TEXT) | app_id, os_type, arch, download_url, sha256 |
| `translation_tasks` | `id` (INTEGER AUTOINCREMENT) | app_id, source_locale, target_locale, status |
| `user_submissions` | `id` (TEXT, UUID) | source, name, repo_url, description, status |

## 注意

- `apps_library` 有两个 ID：`id`（自增）和 `github_repo_id`（UNIQUE）。向量嵌入用 `lib_{github_repo_id}`
- `raw_apps` 没有自增 `id`，用 `github_repo_id`
- `app_translations` 的 locale 值：zh, en, ja, ko, es, pt-BR
- `translation_tasks` 的 UNIQUE 约束是 `(app_id, target_locale)`

## 操作步骤

```
1. 查迁移脚本确认字段名：grep "CREATE TABLE.*表名" migrations/
2. 写 SQL 用明确列名，不用 SELECT *
3. 前端 TypeScript 接口字段名与 SQL 列名/别名一致
4. 特别注意主键名：是 id、github_repo_id、还是自定义
```
