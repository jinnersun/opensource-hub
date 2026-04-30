# OpenSource-Hub 项目基础信息

> 最后更新: 2026-04-30  
> 文档版本: V1.0

---

## 一、项目概述

**项目名称**: OpenSource-Hub（开源应用直通车）  
**项目定位**: 消除"开源软件消费门槛"的数字资产分发平台  
**核心理念**: 将晦涩的 GitHub 开源项目转化为安全、易懂、开箱即用的消费级应用商店  

**目标用户**:
- 核心用户：缺乏编程知识的普通电脑用户、办公白领、自媒体创作者
- 次级用户：寻求高效替代方案的 IT 从业者
- 贡献者：愿意参与开源社区建设的技术发烧友

---

## 二、技术架构

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| **前端** | Next.js 16 | React 框架，支持 SSR/SSG |
| **部署** | Cloudflare Pages | 前端托管 + 边缘计算 |
| **后端 API** | Cloudflare Workers (Hono) | Serverless API |
| **数据库** | Cloudflare D1 | SQLite 边缘数据库 |
| **缓存** | Cloudflare KV | 键值存储 |
| **国际化** | next-intl | i18n 解决方案 |
| **数据采集** | GitHub Actions + TypeScript | 自动化采集流水线 |
| **AI 处理** | OpenAI GPT-4o-mini | 多语言内容生成 |

### 2.2 架构特点

```
用户浏览器
    ↓
Cloudflare Pages (前端静态资源)
    ↓
Cloudflare Workers (API 代理 + 动态路由)
    ↓
Cloudflare D1 (数据库) + KV (缓存)
    
数据采集:
GitHub Actions → 采集原始数据 → D1 raw_apps
                              ↓
                    Cloudflare Worker ETL (异步)
                              ↓
                    D1 apps + app_translations
```

---

## 三、Cloudflare 资源配置

### 3.1 D1 数据库

| 项目 | 值 |
|------|-----|
| **数据库名称** | `opensource-hub-db` |
| **Database ID** | `9989fa14-ca29-46ef-8c9f-9ab55f6b47d7` |
| **版本** | production |
| **当前大小** | 0.28 MB |
| **创建时间** | 2026-04-20 |

**数据表清单**:
- `apps` - 应用主表
- `app_versions` - 版本和下载链接
- `app_ai_content` - AI 生成内容（中文）
- `app_translations` - 多语言翻译表
- `app_security` - 安全审计信息
- `categories` - 分类表
- `tags` - 标签表
- `raw_apps` - 原始数据表（新增，2026-04-30）
- `star_snapshots` - Star 快照表
- `activities` - 实时动态表
- `system_config` - 系统配置表
- `download_stats` - 下载统计
- `search_analytics` - 搜索分析

### 3.2 KV Namespace

| 项目 | 值 |
|------|-----|
| **Namespace 名称** | `opensource-hub-etl` |
| **Namespace ID** | `4a1bc5fb651342528766c6f4248d4e69` |
| **用途** | ETL 指标存储、AI 翻译缓存 |

### 3.3 Cloudflare Account

| 项目 | 值 |
|------|-----|
| **Account ID** | `063b426850c4c65d45b0809040ec8a71` |
| **关联邮箱** | 358042175@163.com |
| **权限** | Super Administrator |

---

## 四、项目结构

```
OpenSource-Hub/
├── .github/workflows/          # GitHub Actions 工作流
│   ├── harvest-raw.yml         # 数据采集工作流（新增）
│   ├── deploy-etl.yml          # ETL 部署工作流（新增）
│   └── deploy.yml              # 主部署工作流
│
├── data/                       # 数据文件
│   └── seed-v2.sql            # 种子数据 V2
│
├── doc/                        # 文档目录
│   ├── devplan/               # 开发计划
│   │   ├── development-plan-v2.md
│   │   ├── github-data-harvesting-etl-architecture.md  # 架构设计（新增）
│   │   ├── github-harvesting-implementation-guide.md   # 实施指南（新增）
│   │   └── github-harvesting-summary.md                # 实施总结（新增）
│   ├── roadmap/               # 路线图
│   ├── PRD.md                 # 产品需求文档
│   └── 内容数据国际化方案.md
│
├── migrations/                 # 数据库迁移脚本
│   ├── 001_initial_schema.sql
│   ├── 002_seed_data.sql
│   ├── 003_add_category_fields.sql
│   └── 007_create_raw_apps_table.sql  # 原始数据表（新增）
│
├── scripts/                    # 工具脚本
│   ├── github-harvester.ts           # 旧版采集脚本（混合处理）
│   ├── github-harvester-raw.ts       # 新版采集脚本（仅采集）
│   └── package.json
│
├── web/                        # Next.js 前端项目
│   ├── app/                    # 应用路由
│   ├── components/             # React 组件
│   ├── lib/                    # 工具库
│   ├── messages/               # 国际化翻译文件
│   └── package.json
│
├── workers/                    # Cloudflare Workers
│   ├── api/                    # API Worker
│   │   └── index.ts
│   └── etl/                    # ETL Worker（新增）
│       ├── src/index.ts
│       ├── package.json
│       ├── wrangler.toml
│       └── tsconfig.json
│
└── wrangler.toml               # 根配置
```

---

## 五、 Workers 项目

### 5.1 API Worker

| 项目 | 值 |
|------|-----|
| **路径** | `workers/api/` |
| **框架** | Hono |
| **功能** | 提供 RESTful API |
| **绑定** | D1 数据库 |

**主要端点**:
- `GET /api/apps` - 获取应用列表
- `GET /api/apps/:slug` - 获取应用详情
- `GET /api/categories` - 获取分类列表
- `GET /api/search` - 搜索应用
- `GET /api/trending` - 热门动态
- `GET /api/activities` - 实时动态

### 5.2 ETL Worker（新增）

| 项目 | 值 |
|------|-----|
| **路径** | `workers/etl/` |
| **名称** | `opensource-hub-etl` |
| **触发方式** | 定时（每 2 小时）+ HTTP |
| **绑定** | D1 + KV |
| **状态** | ⏳ 待部署 |

**HTTP 端点**:
- `POST /etl/trigger` - 手动触发 ETL
- `GET /etl/metrics` - 查看处理指标
- `GET /etl/status` - 查看待处理数量

---

## 六、数据采集架构

### 6.1 新架构（分层处理）

```
GitHub Actions (5 分钟)          Cloudflare Worker ETL (异步)
  ↓                                    ↓
采集原始数据                      监控 raw_apps 表
  ↓                                    ↓
写入 D1 raw_apps 表  ──────→    调用 AI 处理
                                     ↓
                                写入 apps + app_translations
```

### 6.2 核心特性

- ✅ **职责分离**：采集和处理完全解耦
- ✅ **状态机**：完整的 ETL 状态流转（pending/processing/completed/failed/rate_limited/skipped）
- ✅ **失败隔离**：采集失败不影响已处理数据
- ✅ **自动重试**：最多重试 3 次
- ✅ **超时保护**：30 分钟超时回退
- ✅ **可观测性**：完整监控指标

### 6.3 GitHub Actions 工作流

| 工作流 | 触发方式 | 功能 |
|--------|---------|------|
| `harvest-raw.yml` | 每日 2:00 UTC | 采集原始数据 |
| `deploy-etl.yml` | 推送 workers/etl | 部署 ETL Worker |

---

## 七、国际化支持

### 7.1 UI 文本

- ✅ 中文 (zh) - `messages/zh.json`
- ✅ 英文 (en) - `messages/en.json`

### 7.2 内容数据

- ✅ `app_translations` 表支持多语言
- ✅ API 支持 `?locale=` 参数
- ✅ COALESCE fallback 机制

### 7.3 分类数据

- ✅ `categories` 表包含 `name` / `name_en`
- ✅ 前端根据 locale 选择显示

---

## 八、开发进度

### 8.1 已完成

- ✅ Sprint 1: 数据映射修复 + 详情页补全
- ✅ Sprint 2: 种子数据 + 搜索 + UX
- ✅ Sprint 3: 数据清理 + 多语言 Schema 改造
- ✅ 前端页面框架（6 个页面）
- ✅ API + D1 Service Binding
- ✅ 国际化（UI + 内容数据）
- ✅ 数据采集架构重构（代码和文档）

### 8.2 进行中

- ⏳ ETL Worker 部署
- ⏳ GitHub Actions 配置
- ⏳ 完整流程测试

### 8.3 待规划

- ⬜ VirusTotal 集成
- ⬜ 语义搜索升级（向量检索）
- ⬜ 后台管理面板
- ⬜ 更多语言支持（日语、韩语）

---

## 九、环境配置

### 9.1 开发环境

```bash
# Node.js 版本
Node.js 20+

# 包管理器
npm

# 全局工具
wrangler 4.86.0
```

### 9.2 环境变量

**前端 (web/.env.local)**:
```env
# 按需配置
```

**采集脚本 (scripts/.env)**:
```env
GITHUB_TOKEN=
CLOUDFLARE_ACCOUNT_ID=063b426850c4c65d45b0809040ec8a71
D1_DATABASE_ID=9989fa14-ca29-46ef-8c9f-9ab55f6b47d7
CLOUDFLARE_API_TOKEN=
```

**ETL Worker Secrets**:
- `OPENAI_API_KEY` - ⏳ 待配置
- `ALERT_WEBHOOK_URL` - ⏳ 待配置（可选）

### 9.3 GitHub Secrets

需要在 GitHub 仓库配置以下 Secrets：
- `GITHUB_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` = `063b426850c4c65d45b0809040ec8a71`
- `D1_DATABASE_ID` = `9989fa14-ca29-46ef-8c9f-9ab55f6b47d7`
- `CLOUDFLARE_API_TOKEN`
- `OPENAI_API_KEY`

---

## 十、常用命令

### 10.1 数据库操作

```bash
# 查看数据库列表
npx wrangler d1 list

# 执行迁移
npx wrangler d1 execute opensource-hub-db --file migrations/007_create_raw_apps_table.sql --remote

# 执行查询
npx wrangler d1 execute opensource-hub-db --command "SELECT COUNT(*) FROM apps" --remote
```

### 10.2 Workers 部署

```bash
# API Worker
cd workers/api
npx wrangler deploy

# ETL Worker
cd workers/etl
npx wrangler deploy
```

### 10.3 数据采集

```bash
# 运行原始数据采集
cd scripts
npm run harvest:raw

# 使用自定义仓库列表
npm run harvest:raw:file
```

### 10.4 前端开发

```bash
# 开发模式
cd web
npm run dev

# 构建
npm run build

# 部署
npx wrangler pages deploy
```

---

## 十一、成本分析

### 11.1 当前成本

| 服务 | 月成本 |
|------|--------|
| Cloudflare Pages | 免费 |
| Cloudflare Workers | 免费 |
| Cloudflare D1 | 免费 |
| Cloudflare KV | 免费 |
| GitHub Actions | 免费 |
| OpenAI API | ~¥4/月 |
| **总计** | **~¥4/月** |

### 11.2 免费额度

- Workers: 每日 10 万次请求
- D1: 每日 500 万次行读取
- KV: 每日 10 万次读取
- Pages: 无限请求
- GitHub Actions: 每月 2000 分钟

---

## 十二、重要链接

| 资源 | 链接 |
|------|------|
| **GitHub 仓库** | https://github.com/your-username/OpenSource-Hub |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **API Worker** | 待部署 |
| **ETL Worker** | 待部署 |
| **前端页面** | 待部署 |

---

## 十三、团队成员

| 角色 | 联系方式 |
|------|---------|
| 项目负责人 | 358042175@163.com |
| 开发 | AI Assistant |

---

## 十四、下一步计划

### 立即执行

1. ✅ 创建 `raw_apps` 表 - 已完成
2. ✅ 创建 KV Namespace - 已完成
3. ⏳ 配置 GitHub Secrets
4. ⏳ 部署 ETL Worker
5. ⏳ 测试完整流程

### 本周完成

- 完成 ETL Worker 部署和测试
- 配置 GitHub Actions 定时任务
- 验证数据采集 → ETL → 前端展示全链路

### 本月完成

- 采集 30 个种子项目的真实数据
- 完善 AI 生成内容质量
- 上线公开测试版

---

**文档维护**: 随项目进展持续更新  
**最后验证**: 2026-04-30
