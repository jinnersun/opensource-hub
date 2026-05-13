# OpenSource-Hub 项目规范

## 技术栈
Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + next-intl
Cloudflare Workers + D1 (SQLite) + KV + Vectorize + Workers AI
DeepSeek v4 Flash (AI 内容生成) / m2m100-1.2b (翻译)

## 架构约束
- API Worker: `workers_dev=false`，只能通过 Service Binding 内网访问
- 前端到 API 全部走 `/api/proxy?path=` 代理转发
- 代理只转发 `Content-Type` 和 `Authorization` 两个头
- ETL Worker + Translator Worker 通过 cron 触发
- 数据库通过 D1 binding 访问，所有 SQL 参数化防注入

## 编码前必读
每次修改涉及以下任一场景时，先读取对应的规则文件：
- 跨文件重构 → `.claude/rules/refactoring.md`
- 新增路由/鉴权 → `.claude/rules/routing-and-auth.md`
- 数据库操作 → `.claude/rules/database.md`
- 前端组件/页面 → `.claude/rules/frontend-completeness.md`
- 通用规范 → `.claude/rules/coding-style.md`

## 常见陷阱速查
1. `raw_apps` 主键是 `github_repo_id`（不是 `id`）
2. 新增 locale 必须同步改 `middleware.ts` matcher + `routing.ts` locales
3. `if (x) a else b` 单行无花括号会被 SWC 拒绝，用三元或 `{}`
4. API 返回值的嵌套属性必须加 `?.` 或判空
5. `/api/proxy` 转发 POST 时必须带 `Authorization` 请求头
6. 鉴权守卫要排除登录页自身

## 项目结构
```
web/                    # Next.js 前端
  app/[locale]/         # i18n 路由页面
  components/           # React 组件
  lib/api.ts            # API 客户端 + 数据转换
  messages/             # i18n 翻译文件 (zh/en/ja/ko)
  i18n/routing.ts       # locale 配置
  middleware.ts          # i18n 路由匹配
workers/
  api/index.ts          # API Worker (REST + admin)
  etl/src/              # ETL Worker (数据管道)
  translator/src/       # Translator Worker (翻译管道)
migrations/             # D1 迁移脚本 (001~012)
scripts/                # 数据采集脚本
```
