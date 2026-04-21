# 🚀 OpenSource-Hub 数据库快速入门指南

## 📦 已完成的工作

✅ **数据库表结构设计** - 9 张核心表
✅ **迁移文件** - 包含完整的 SQL 建表语句
✅ **示例数据** - OBS Studio、Rufus 等真实案例
✅ **查询示例** - 15 个常用 SQL 查询
✅ **初始化脚本** - Windows/Mac/Linux 全平台支持
✅ **配置文件** - wrangler.toml 已配置

---

## 🎯 下一步操作

### 方式一：使用脚本自动初始化（推荐）

#### Windows 用户：
```bash
# 在项目根目录执行
scripts\init-db.bat
```

#### Mac/Linux 用户：
```bash
# 赋予执行权限
chmod +x scripts/init-db.sh

# 执行初始化
bash scripts/init-db.sh
```

---

### 方式二：手动逐步执行

#### 步骤 1: 安装 Wrangler CLI

```bash
npm install -g wrangler
```

#### 步骤 2: 登录 Cloudflare

```bash
wrangler login
```

会打开浏览器，授权 Cloudflare 访问。

#### 步骤 3: 创建 D1 数据库

```bash
# 方式 A: 使用快捷命令 (在 web 目录)
cd web
npm run db:create

# 方式 B: 直接使用 wrangler (在项目根目录)
wrangler d1 create opensource-hub-db
```

**重要**: 创建成功后会返回一个 `database_id`，类似：
```json
{
  "database_id": "abc123def-4567-8901-ghij-klmnopqrstuv",
  "database_name": "opensource-hub-db"
}
```

#### 步骤 4: 更新 wrangler.toml

打开项目根目录的 `wrangler.toml`，将 `database_id` 替换为实际值：

```toml
[[d1_databases]]
binding = "DB"
database_name = "opensource-hub-db"
database_id = "这里替换为实际的database_id"  # ← 替换这里
```

#### 步骤 5: 执行数据库迁移

```bash
# 方式 A: 使用快捷命令 (在 web 目录)
cd web
npm run db:migrate

# 方式 B: 直接使用 wrangler (在项目根目录)
wrangler d1 execute opensource-hub-db --file migrations/001_initial_schema.sql
```

#### 步骤 6: 导入示例数据（可选）

```bash
# 方式 A: 使用快捷命令
cd web
npm run db:seed

# 方式 B: 直接使用 wrangler
wrangler d1 execute opensource-hub-db --file migrations/002_seed_data.sql
```

---

## ✅ 验证数据库

### 查看所有表

```bash
wrangler d1 execute opensource-hub-db --command ".tables"
```

应该看到以下表：
```
apps                  categories           tags
app_versions          system_config        download_stats
app_ai_content        search_analytics     app_security
```

### 查看表结构

```bash
wrangler d1 execute opensource-hub-db --command ".schema apps"
```

### 查看示例数据

```bash
wrangler d1 execute opensource-hub-db --command "SELECT name, category, stars_count FROM apps LIMIT 5;"
```

### 使用 D1 Studio (可视化界面)

```bash
cd web
npm run db:studio
```

会打开一个 Web 界面，可以可视化查询和管理数据库。

---

## 📊 数据库架构概览

```
┌─────────────────────────────────────────────┐
│           D1 Database (核心数据)             │
├─────────────────────────────────────────────┤
│                                             │
│  📦 apps              # 软件主表            │
│     ├─ 基本信息 (名称、描述、分类)           │
│     ├─ GitHub 信息 (Stars、License)         │
│     └─ 状态管理 (active/archived)           │
│                                             │
│  📦 app_versions      # 版本与下载          │
│     ├─ 多平台支持 (Windows/Mac/Linux)       │
│     ├─ 多架构支持 (x64/arm64)               │
│     └─ 下载链接 + SHA256                    │
│                                             │
│  📦 app_ai_content    # AI 结构化内容       │
│     ├─ 白话说明书 (一句话总结)               │
│     ├─ 功能列表 (能做什么/不能做什么)        │
│     ├─ 上手指南                            │
│     └─ 依赖说明 (运行库、卸载指南)           │
│                                             │
│  📦 app_security      # 安全审计            │
│     ├─ VirusTotal 报告                     │
│     └─ 审核状态                            │
│                                             │
│  📦 download_stats    # 下载统计            │
│  📦 search_analytics  # 搜索分析            │
│  📦 categories        # 分类字典            │
│  📦 tags              # 标签字典            │
│  📦 system_config     # 系统配置            │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔗 与 Supabase 的分工

| 功能 | 存储位置 | 原因 |
|------|---------|------|
| 软件基本信息 | **D1** | 读多写少，适合边缘缓存 |
| 版本与下载链接 | **D1** | 高频访问，需要快速响应 |
| AI 生成内容 | **D1** | 静态内容，缓存友好 |
| 安全审计 | **D1** | 展示用，不需要复杂查询 |
| 下载统计 | **D1** | 聚合查询，SQLite 足够 |
| **向量 embeddings** | **Supabase** | 需要 pgvector 扩展 |
| **用户认证** | **Supabase** | 需要 OAuth/第三方登录 |
| **用户收藏** | **Supabase** | 关联用户数据 |
| **纠错建议** | **Supabase** | UGC 内容，需要审核流 |

---

## 📝 常用命令速查

```bash
# 数据库管理
npm run db:create          # 创建数据库
npm run db:migrate         # 执行迁移
npm run db:seed            # 导入示例数据
npm run db:studio          # 打开可视化工具

# 直接 wrangler 命令
wrangler d1 info opensource-hub-db                    # 查看数据库信息
wrangler d1 execute opensource-hub-db --command "SELECT COUNT(*) FROM apps;"  # 执行查询
wrangler d1 execute opensource-hub-db --file migrations/003_query_examples.sql  # 执行文件

# 备份与恢复
wrangler d1 execute opensource-hub-db --command ".dump" > backup.sql          # 备份
wrangler d1 execute opensource-hub-db --file backup.sql                        # 恢复
```

---

## 🎓 学习资源

- [Cloudflare D1 官方文档](https://developers.cloudflare.com/d1/)
- [Wrangler CLI 文档](https://developers.cloudflare.com/workers/wrangler/)
- [SQLite 语法参考](https://www.sqlite.org/lang.html)
- 项目内文档: `migrations/README.md`
- 查询示例: `migrations/003_query_examples.sql`

---

## ❓ 常见问题

### Q1: 创建数据库时报错 "already exists"

数据库已存在，可以直接执行迁移：
```bash
npm run db:migrate
```

### Q2: 如何获取 database_id?

```bash
wrangler d1 list
```

会列出所有数据库及其 ID。

### Q3: 免费额度用完了怎么办?

- 优化查询，减少不必要的读取
- 增加 KV 缓存 (后续会配置)
- 升级到付费计划 ($5/月起)

查看当前用量：
```bash
wrangler d1 info opensource-hub-db
```

### Q4: 如何重置数据库?

```bash
# 删除所有表
wrangler d1 execute opensource-hub-db --command "DROP TABLE IF EXISTS apps; DROP TABLE IF EXISTS app_versions; ..."

# 重新迁移
npm run db:migrate
npm run db:seed
```

---

## 🎉 完成！

数据库初始化完成后，您就可以：

1. ✅ 开始开发前端页面
2. ✅ 连接 Cloudflare Workers 作为 API 层
3. ✅ 导入更多示例数据
4. ✅ 配置 Supabase 向量搜索

**下一步建议**: 配置 Supabase 数据库（用于向量搜索和用户认证）
