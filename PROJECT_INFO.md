# OpenSource-Hub 项目基础信息

> 最后更新: 2026-05-07
> 文档版本: V2.0

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
| **前端** | Next.js 16 + React 19 + Tailwind CSS 4 + Radix UI + shadcn/ui | App Router，SSR/SSG |
| **部署** | Cloudflare Pages | opennextjs-cloudflare 构建 |
| **后端 API** | Cloudflare Workers（原生 Fetch API） | 7 个 REST 端点，Service Binding 内网 |
| **ETL** | Cloudflare Workers（cron 30min + HTTP） | 定时异步处理管道 |
| **数据库** | Cloudflare D1（SQLite，12 张表） | 边缘数据库 |
| **缓存** | Cloudflare KV | ETL 指标存储 |
| **国际化** | next-intl（zh/en） | UI + 数据库翻译表双轨 |
| **数据采集** | GitHub Actions + TypeScript（tsx） | 每日 2:00 UTC |
| **AI 引擎** | DeepSeek v4 Flash（api.deepseek.com） | 中英双语内容生成 |

### 2.2 架构特点

```
用户浏览器
    ↓
Cloudflare Pages (Next.js 前端)
    ↓ /api/proxy (Service Binding 内网)
API Worker → D1 数据库 + KV 缓存
    
数据管道:
GitHub Actions (每日) → D1 raw_apps
                           ↓
                    ETL Worker (每 30 分钟)
                      ├─ ETag 增量检查
                      ├─ 准入漏斗 (stars≥500/license/活跃度)
                      ├─ DeepSeek AI 双语生成
                      ├─ GitHub Releases 抓包 + SHA256
                      └─ D1 batch 写入 (apps + translations + versions)
                           ↓
                    API Worker → 前端展示
```

---

## 三、Cloudflare 资源配置

### 3.1 D1 数据库

| 项目 | 值 |
|------|-----|
| **数据库名称** | `opensource-hub-db` |
| **Database ID** | `9989fa14-ca29-46ef-8c9f-9ab55f6b47d7` |
| **版本** | production |

**数据表清单**（12 张）:
- `apps` — 应用主表
- `app_versions` — 版本和下载链接（含 sha256）
- `app_translations` — 多语言翻译表（zh/en）
- `app_ai_content` — AI 生成内容（legacy，COALESCE fallback）
- `app_security` — 安全审计信息
- `categories` — 分类表（含 name_en / lucide_icon / color）
- `tags` — 标签表
- `raw_apps` — 原始数据表（ETL 状态机）
- `star_snapshots` — Star 快照表（结构已建）
- `activities` — 实时动态表（结构已建）
- `system_config` — 系统配置表
- `download_stats` — 下载统计
- `search_analytics` — 搜索分析

### 3.2 KV Namespace

| 项目 | 值 |
|------|-----|
| **Namespace 名称** | `opensource-hub-etl` |
| **Namespace ID** | `4a1bc5fb651342528766c6f4248d4e69` |
| **用途** | ETL 累计指标存储 |

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
│   ├── harvest-raw.yml         # 数据采集（每日 2:00 UTC）
│   ├── deploy-etl.yml          # ETL 自动部署
│   └── deploy-api.yml          # API 自动部署
│
├── data/                       # 数据文件
│   └── repos.json             # 种子项目列表
│
├── doc/                        # 文档目录
│   ├── PRD.md                 # 产品需求文档
│   ├── TASK_PLAN.md           # 开发任务规划
│   ├── data-source-and-schema.md  # 数据源与表结构
│   ├── 内容数据国际化方案.md
│   ├── 热门动态实时动态数据获取方案.md
│   ├── 类同项目解决办法.md
│   ├── devplan/               # 开发计划
│   │   ├── development-plan-v2.md
│   │   ├── github-harvesting-summary.md
│   │   ├── github-data-harvesting-etl-architecture.md
│   │   └── ...
│   └── roadmap/
│       └── v1.0-roadmap.md
│
├── migrations/                 # 数据库迁移脚本（001~009）
│
├── scripts/                    # 工具脚本
│   ├── github-harvester-raw.ts    # 原始数据采集
│   ├── github-harvester.ts        # 旧版采集（已废弃）
│   └── package.json
│
├── web/                        # Next.js 前端项目
│   ├── app/                    # 应用路由（8 个页面）
│   ├── components/             # React 组件（26 个业务组件 + UI kit）
│   ├── lib/                    # 工具库（api.ts / data.ts / utils.ts）
│   ├── messages/               # 国际化翻译文件（zh.json / en.json）
│   └── package.json
│
├── workers/                    # Cloudflare Workers
│   ├── api/                    # API Worker
│   │   └── index.ts           # 7 个 REST 端点
│   └── etl/                    # ETL Worker
│       └── src/
│           ├── index.ts        # 入口 + HTTP 路由
│           ├── scheduler.ts    # 调度器
│           ├── ai.ts           # DeepSeek 客户端
│           ├── github.ts       # GitHub API 客户端（ETag）
│           ├── release.ts      # Releases 抓取 + SHA256
│           ├── persistence.ts  # D1 写入
│           ├── scheduling.ts   # 准入漏斗 + 退避
│           └── types.ts        # 共享类型
│
└── wrangler.toml               # 根配置（D1 绑定）
```

---

## 五、Workers 项目

### 5.1 API Worker

| 项目 | 值 |
|------|-----|
| **路径** | `workers/api/` |
| **功能** | 提供 RESTful API，Service Binding 内网 |
| **绑定** | D1 数据库 |

**端点**:
- `GET /api/home` — 首页聚合（4 路并发：精选/分类/趋势/新品）
- `GET /api/apps` — 应用列表（分类/搜索/分页/精选）
- `GET /api/apps/:slug` — 应用详情（含翻译 fallback + 安全信息）
- `GET /api/categories` — 分类列表（含 app 计数）
- `GET /api/trending` — 热门（day/week/alltime）
- `GET /api/search` — 搜索（记录 search_analytics）
- `GET /api/health` — 健康检查

### 5.2 ETL Worker

| 项目 | 值 |
|------|-----|
| **路径** | `workers/etl/` |
| **名称** | `opensource-hub-etl` |
| **触发方式** | cron 每 30 分钟 + HTTP 手动 |
| **绑定** | D1 + KV |

**HTTP 端点**:
- `POST /etl/trigger` — 手动触发 ETL
- `POST /etl/refresh-versions?limit=20` — 增量刷新版本数据
- `GET /etl/status` — 按状态分组统计
- `GET /etl/metrics` — 累计指标

---

## 六、开发进度

### 6.1 已完成

- ✅ 8 个前端页面（首页/详情/分类/搜索/趋势/关于/联系/隐私）
- ✅ 中英双语 UI + 内容数据国际化
- ✅ API Worker 7 个端点 + locale 多语言支持
- ✅ ETL Worker 全链路（GitHub Actions → raw_apps → ETL → apps）
- ✅ 3 个 GitHub Actions 工作流
- ✅ DeepSeek AI 中英双语内容生成
- ✅ GitHub Releases 自动抓取（平台识别 + SHA256）
- ✅ ETag 增量检测 + 准入漏斗 + 状态机 + KV 指标

### 6.2 进行中

- 🚧 语义搜索升级（Cloudflare Vectorize 向量检索）
- 🚧 类同项目关联推荐

### 6.3 已完成

- ✅ ETL 全量处理种子项目（数据持续扩展中）

### 6.4 待规划

- ⬜ 管理后台面板（与域名一起延后处理）
- ⬜ 更多语言支持（日语、韩语）

### 6.5 已放弃

- ❌ VirusTotal 集成 — 改为展示 GitHub Release 官方 SHA-256 校验码
- ❌ activities / star_snapshots 表数据采集 — 用 apps 表字段 + ETL 增量刷新替代

---

## 七、环境配置

### 7.1 开发环境

```bash
# Node.js 版本
Node.js 20+

# 包管理器
npm

# 全局工具
wrangler 4.86.0
```

### 7.2 密钥

**ETL Worker Secrets**:
- `OPENAI_API_KEY` → DeepSeek API Key（名称沿用 OpenAI 兼容）
- `GITHUB_TOKEN` → GitHub PAT
- `ALERT_WEBHOOK_URL` → 可选

**GitHub Secrets**:
- `GH_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`
- `D1_DATABASE_ID`
- `CLOUDFLARE_API_TOKEN`

---

## 八、常用命令

### 数据库操作

```bash
npx wrangler d1 list
npx wrangler d1 execute opensource-hub-db --command "SELECT COUNT(*) FROM apps" --remote
npx wrangler d1 execute opensource-hub-db --file migrations/007_create_raw_apps_table.sql --remote
```

### Workers 部署

```bash
cd workers/api && npx wrangler deploy
cd workers/etl && npx wrangler deploy
```

### 数据采集

```bash
cd scripts
npm run harvest:raw
```

### 前端开发

```bash
cd web
npm run dev       # 开发模式
npm run build     # 构建
npm run deploy    # 部署到 CF Pages
```

---

## 九、成本

| 服务 | 月成本 |
|------|--------|
| Cloudflare Pages | 免费 |
| Cloudflare Workers | 免费 |
| Cloudflare D1 | 免费 |
| Cloudflare KV | 免费 |
| GitHub Actions | 免费 |
| DeepSeek API | ~¥4/月 |
| **总计** | **~¥4/月** |

---

## 十、重要链接

| 资源 | 链接 |
|------|------|
| **GitHub 仓库** | https://github.com/jinnersun/opensource-hub |
| **Cloudflare Dashboard** | https://dash.cloudflare.com |
| **Pages 部署** | opensource-hub-web.358042175.workers.dev |
| **API Worker** | opensource-hub-api（公网关闭，仅 Service Binding） |
| **ETL Worker** | opensource-hub-etl（已部署） |
| **AI 引擎** | DeepSeek v4 Flash (api.deepseek.com) |

---

**文档维护**: 随项目进展持续更新
**最后验证**: 2026-05-12
