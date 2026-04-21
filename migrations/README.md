# Cloudflare D1 数据库文档

## 📋 数据库概览

本项目使用 Cloudflare D1 作为主要关系型数据库，存储 OpenSource-Hub 的核心业务数据。

### 数据库架构

```
┌─────────────────────────────────────────┐
│           D1 Database                   │
├─────────────────────────────────────────┤
│  📦 apps (软件主表)                      │
│  📦 app_versions (版本与下载链接)         │
│  📦 app_ai_content (AI 结构化内容)       │
│  📦 app_security (安全审计)              │
│  📦 download_stats (下载统计)            │
│  📦 search_analytics (搜索分析)          │
│  📦 categories (分类字典)                │
│  📦 tags (标签字典)                      │
│  📦 system_config (系统配置)             │
└─────────────────────────────────────────┘
```

## 🚀 快速开始

### 1. 安装 Wrangler CLI

```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare

```bash
wrangler login
```

### 3. 创建 D1 数据库

```bash
# 创建数据库
wrangler d1 create opensource-hub-db
```

创建成功后，会返回一个 `database_id`，将其复制到 `wrangler.toml` 文件中：

```toml
[[d1_databases]]
binding = "DB"
database_name = "opensource-hub-db"
database_id = "实际返回的ID"  # 替换这里
```

### 4. 执行数据库迁移

```bash
# 执行初始表结构迁移
wrangler d1 execute opensource-hub-db --file migrations/001_initial_schema.sql
```

### 5. 验证表结构

```bash
# 查看所有表
wrangler d1 execute opensource-hub-db --command ".tables"

# 查看 apps 表结构
wrangler d1 execute opensource-hub-db --command ".schema apps"
```

## 📊 数据表详细说明

### 1. apps (软件主表)

**用途**: 存储开源软件的基本信息

**核心字段**:
- `id`: UUID 主键
- `name`: 应用名称
- `slug`: URL 友好的标识符 (如: `obs-studio`)
- `category`: JTBD 场景分类 (如: `#影音处理`)
- `tags`: 场景标签 JSON 数组
- `github_url`: GitHub 仓库地址
- `license`: 开源协议
- `stars_count`: GitHub Stars 数
- `status`: 状态 (active/archived/pending_review)

**示例查询**:
```sql
-- 查询所有活跃的应用
SELECT * FROM apps WHERE status = 'active' ORDER BY stars_count DESC;

-- 按分类查询
SELECT * FROM apps WHERE category = '#AI生产力' AND is_featured = 1;
```

---

### 2. app_versions (版本与下载链接)

**用途**: 存储不同操作系统和架构的安装包信息

**核心字段**:
- `app_id`: 关联 apps 表
- `version`: 版本号
- `os_type`: windows/macos/linux
- `arch`: x64/arm64/universal
- `file_type`: exe/dmg/msi/deb/rpm/zip/tar.gz
- `download_url`: GitHub Releases 下载链接
- `sha256`: 文件校验码
- `is_stable`: 是否稳定版

**示例查询**:
```sql
-- 获取应用的最新稳定版 (Windows)
SELECT * FROM app_versions 
WHERE app_id = 'xxx' 
  AND os_type = 'windows' 
  AND is_stable = 1 
ORDER BY release_date DESC 
LIMIT 1;
```

---

### 3. app_ai_content (AI 结构化内容)

**用途**: 存储 LLM 处理后的白话说明书

**核心字段**:
- `summary`: 一句话白话总结
- `what_it_does`: 能帮你做什么
- `what_it_cant_do`: 不能做什么/避坑指南
- `is_portable`: 是否绿色版
- `requirements`: 运行库依赖
- `uninstall_guide`: 卸载清理说明
- `needs_human_review`: 是否需要人工审核

**示例查询**:
```sql
-- 查询需要人工审核的内容
SELECT a.name, c.summary, c.confidence_score
FROM app_ai_content c
JOIN apps a ON c.app_id = a.id
WHERE c.needs_human_review = 1;
```

---

### 4. app_security (安全审计)

**用途**: 存储安全扫描结果

**核心字段**:
- `sha256`: 文件哈希
- `virustotal_url`: VirusTotal 报告链接
- `virustotal_score`: 安全评分
- `audit_status`: pending/passed/flagged/failed

---

### 5. download_stats (下载统计)

**用途**: 每日下载统计数据

**示例查询**:
```sql
-- 查询最近 7 天下载量 TOP 10
SELECT a.name, SUM(s.download_count) as total_downloads
FROM download_stats s
JOIN apps a ON s.app_id = a.id
WHERE s.stat_date >= date('now', '-7 days')
GROUP BY a.id
ORDER BY total_downloads DESC
LIMIT 10;
```

---

### 6. search_analytics (搜索分析)

**用途**: 分析用户搜索行为，优化选品

**示例查询**:
```sql
-- 查询搜索无结果的关键词 (用于选品参考)
SELECT search_query, search_count
FROM search_analytics
WHERE has_results = 0
ORDER BY search_count DESC
LIMIT 20;
```

## 🔧 常用操作

### 导入数据

```bash
# 从 SQL 文件导入
wrangler d1 execute opensource-hub-db --file migrations/001_initial_schema.sql

# 从 JSON 导入 (需要自定义脚本)
node scripts/import-data.js
```

### 导出数据

```bash
# 导出整个数据库
wrangler d1 execute opensource-hub-db --command ".dump" > backup.sql

# 导出单个表
wrangler d1 execute opensource-hub-db --command ".dump apps" > apps_backup.sql
```

### 重置数据库

```bash
# 删除所有表 (危险操作!)
wrangler d1 execute opensource-hub-db --command "DROP TABLE IF EXISTS apps; DROP TABLE IF EXISTS app_versions; ..."

# 重新执行迁移
wrangler d1 execute opensource-hub-db --file migrations/001_initial_schema.sql
```

## 📈 性能优化建议

### 1. 索引使用

已创建的索引覆盖以下查询场景:
- 按分类筛选
- 按状态筛选
- 按推荐/热门排序
- 按时间排序

### 2. 查询优化

```sql
-- ✅ 好的做法: 使用索引字段
SELECT * FROM apps WHERE category = '#AI生产力' ORDER BY stars_count DESC;

-- ❌ 避免: 全表扫描
SELECT * FROM apps WHERE description LIKE '%视频%';  -- 使用全文搜索或向量搜索
```

### 3. 分页查询

```sql
-- 使用 LIMIT/OFFSET 分页
SELECT * FROM apps 
WHERE status = 'active' 
ORDER BY stars_count DESC 
LIMIT 20 OFFSET 0;  -- 第 1 页

LIMIT 20 OFFSET 20; # 第 2 页
```

## 🔐 安全建议

1. **不要在客户端暴露数据库凭据**
2. **使用 Cloudflare Workers 作为中间层**
3. **实施速率限制** (免费额度: 10万读/天)
4. **定期备份数据**

## 📝 迁移管理

### 创建新迁移

```bash
# 创建迁移文件
touch migrations/002_add_user_tables.sql

# 编写 SQL
# 执行迁移
wrangler d1 execute opensource-hub-db --file migrations/002_add_user_tables.sql
```

### 迁移文件命名规范

```
NNN_description.sql

示例:
001_initial_schema.sql
002_add_user_tables.sql
003_add_audit_log.sql
```

## 🔗 相关资源

- [Cloudflare D1 文档](https://developers.cloudflare.com/d1/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [SQLite 文档](https://www.sqlite.org/docs.html)

## ❓ 常见问题

### Q: 如何查看数据库使用量?

```bash
wrangler d1 info opensource-hub-db
```

### Q: 免费额度用完了怎么办?

- 优化查询，减少不必要的读取
- 增加 KV 缓存命中率
- 考虑升级到付费计划 ($5/月起)

### Q: 如何与 Supabase 配合使用?

- D1 存储核心业务数据
- Supabase 存储用户数据和向量 embeddings
- 通过 Workers 协调两者数据同步
