# OpenSource-Hub（开源应用直通车）

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [English Version](README.md)

OpenSource-Hub 是一个面向全球用户的开源软件发现与分发平台。它充当 GitHub 与普通消费者之间的"语义化中间件"，通过人工筛选与安全验证，将晦涩的开源项目仓库转化为安全、易懂、开箱即用的消费级应用体验。

## 核心特性

- **精选目录**：覆盖 AI、视频、隐私、系统工具、开发工具等多个场景的人工精选开源软件
- **安全验证**：集成 VirusTotal 每日安全扫描与信任背书，确保每一款软件都经过安全校验
- **多平台支持**：智能下载卡片自动识别用户操作系统（Windows / macOS / Linux），高亮对应的安装包
- **智能搜索**：支持自然语言搜索和基于场景的发现，通过向量匹配理解用户真实意图
- **多语言界面**：基于 [next-intl](https://next-intl.dev/) 实现完整国际化，支持中英文切换
- **热门趋势**：实时展示下载统计与趋势榜单，帮助用户发现当下最热门的开源工具
- **开源透明**：提供原始 GitHub 仓库直链、开源协议信息、SHA-256 校验码，确保来源可信

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI |
| 国际化 | next-intl |
| 后端 / 边缘计算 | Cloudflare Workers |
| 数据库 | Cloudflare D1 (SQLite) |
| 部署 | Cloudflare Pages + Workers |
| CI / 数据流水线 | GitHub Actions |

## 项目结构

```
.
├── web/                    # Next.js 前端应用
│   ├── app/                # App Router 页面路由
│   ├── components/         # UI 组件与业务组件
│   ├── lib/                # 数据模型、工具函数、API 客户端
│   ├── messages/           # 国际化翻译文件（en, zh）
│   └── public/             # 静态资源
├── workers/api/            # Cloudflare Worker API
├── migrations/             # D1 数据库表结构与种子数据脚本
├── scripts/                # 数据采集与自动化脚本
└── wrangler.toml           # Cloudflare 部署配置
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 20+
- [npm](https://www.npmjs.com/) 或 [pnpm](https://pnpm.io/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### 1. 安装依赖

```bash
cd web
npm install

cd ../workers/api
npm install
```

### 2. 配置环境变量

复制示例环境文件并填入你的配置值：

```bash
cd web
cp .env.local.example .env.local
```

### 3. 初始化数据库

```bash
cd web
npm run db:create      # 创建 D1 数据库
npm run db:migrate     # 执行表结构迁移
npm run db:seed        # 插入种子数据
```

### 4. 启动开发服务器

```bash
cd web
npm run dev
```

在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

### 5. 启动 API Worker（可选）

```bash
cd workers/api
npm run dev
```

## 部署

本项目设计为部署在 Cloudflare 边缘基础设施上：

```bash
# 部署前端（web）
cd web
npm run deploy

# 部署 API Worker
cd workers/api
npm run deploy
```

请确保 `wrangler.toml` 中已正确配置 D1 数据库绑定。

## 参与贡献

欢迎任何形式的贡献！无论是修复错别字、新增功能，还是改进文档，都可以随时提交 Issue 或 Pull Request。

1. Fork 本仓库
2. 创建你的功能分支（`git checkout -b feature/amazing-feature`）
3. 提交更改（`git commit -m 'Add amazing feature'`）
4. 推送到分支（`git push origin feature/amazing-feature`）
5. 打开一个 Pull Request

## 许可证

本项目基于 MIT 许可证开源。

## 致谢

- 数据来源：[GitHub](https://github.com)、[VirusTotal](https://www.virustotal.com)
- UI 组件基于 [shadcn/ui](https://ui.shadcn.com/) 和 [Radix UI](https://www.radix-ui.com/) 构建
