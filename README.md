# OpenSource-Hub

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [中文版本](README.zh.md)

**🌐 [www.opensource-hub.com](https://www.opensource-hub.com)** — 在线访问 / Visit Online

OpenSource-Hub is a curated discovery and distribution platform for open-source software. It bridges the gap between GitHub and everyday users by providing human-curated, security-verified open-source tools with an intuitive, consumer-friendly experience.

## Features

- **Curated Catalog**: Hand-picked open-source software across categories like AI, video, privacy, system utilities, and more
- **Code Library**: High-star GitHub repositories including frameworks, libraries, CLI tools, and awesome lists
- **FAQ System**: AI-generated troubleshooting & FAQ from GitHub Issues — community signal scoring, DeepSeek + Qwen review pipeline, multi-language translation
- **Security Verification**: SHA-256 checksums extracted from official GitHub Release pages for download integrity
- **Multi-Platform Support**: Smart download cards that detect your OS (Windows / macOS / Linux) and highlight the right installer
- **Vector Search**: Natural language semantic search powered by Cloudflare Vectorize + Workers AI embeddings
- **Smart Discovery**: Category tags, trending rankings, similar project recommendations
- **Multi-Language UI**: 4 locales (zh / en / ja / ko) via [next-intl](https://next-intl.dev/), including FAQ content
- **SSR + Edge**: App Router Server Components on Cloudflare Workers with Service Binding
- **Open Source Transparency**: Direct links to GitHub, license info, and SHA-256 checksums

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI |
| Internationalization | next-intl |
| Backend / Edge | Cloudflare Workers (API + ETL + Translator) |
| AI Pipeline | DeepSeek v4-pro, Qwen-max via Cloudflare AI Gateway |
| Database | Cloudflare D1 (SQLite) |
| Vector Search | Cloudflare Vectorize + Workers AI (bge-small-en-v1.5) |
| Translation | Workers AI m2m100-1.2b |
| Deployment | Cloudflare Pages + Workers |
| CI / Data Pipeline | GitHub Actions |

## Project Structure

```
.
├── web/                       # Next.js frontend
│   ├── app/[locale]/          # App Router pages (SSR)
│   │   ├── project/[id]/      # App detail + FAQ section
│   │   ├── library/[slug]/    # Library detail + FAQ section
│   │   ├── admin/             # Admin dashboard (ETL, FAQ pipeline, translations)
│   │   └── category/          # Category pages
│   ├── components/            # UI & business components
│   │   └── project-detail/    # FAQ accordion, deep-dive tabs, quick-link
│   ├── lib/                   # API clients, data transforms, JSON-LD builders
│   └── messages/              # i18n files (en, zh, ja, ko)
├── workers/
│   ├── api/                   # REST API Worker (internal via Service Binding)
│   ├── etl/                   # ETL Worker (cron: raw_apps → apps, FAQ pipeline)
│   └── translator/            # Translator Worker (cron: translation_tasks queue)
├── scripts/
│   └── v3/                    # FAQ V3 pipeline scripts
│       ├── collect.ts         # GitHub harvest + community signal scoring → D1
│       └── generate.ts        # AI ETL (DeepSeek + Qwen) → D1
├── migrations/                # D1 database schema
└── .github/workflows/         # CI/CD (deploy workers, harvest FAQ issues)
```

## Data Pipeline Architecture

```
GitHub API
    │
    ▼
raw_apps ──→ ETL Worker ──→ apps / apps_library ──→ translation_tasks ──→ Translator Worker
    │              │
    │              └──→ Vectorize (embeddings)
    │
    └──→ Library Worker ──→ apps_library

GitHub Issues (FAQ)
    │
    ▼
Harvest Action (daily) ──→ raw_faqs (D1)
    │
    ▼
ETL Worker (every 15min) ──→ DeepSeek Few-Shot ──→ Post-Filter ──→ Qwen Review
    │
    ▼
app_faqs + app_faq_translations + app_faq_reviews + translation_tasks
    │
    ▼
Translator Worker (every 5min) ──→ m2m100 ──→ app_faq_translations (zh/ja/ko)
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [npm](https://www.npmjs.com/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### 1. Install dependencies

```bash
cd web && npm install
cd ../workers/api && npm install
cd ../workers/etl && npm install
cd ../workers/translator && npm install
cd ../scripts && npm install
```

### 2. Set up the database

```bash
cd web
npm run db:migrate     # Run all schema migrations
npm run db:seed        # Insert seed data
```

### 3. Run the development server

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Run Workers (optional)

```bash
cd workers/api && npm run dev           # API Worker
cd workers/etl && npm run dev           # ETL Worker
cd workers/translator && npm run dev    # Translator Worker
```

## Deployment

```bash
# Deploy frontend
cd web && npm run deploy

# Deploy Workers
cd workers/api && npm run deploy
cd workers/etl && npm run deploy
cd workers/translator && npm run deploy
```

### Worker Secrets

```bash
# ETL Worker
wrangler secret put OPENAI_API_KEY      # DeepSeek API key
wrangler secret put GITHUB_TOKEN         # GitHub PAT (5000/h rate limit)
wrangler secret put AI_GATEWAY_ACCOUNT  # Cloudflare AI Gateway account
wrangler secret put AI_GATEWAY_TOKEN    # Cloudflare AI Gateway token
wrangler secret put QWEN_API_KEY        # Qwen DashScope API key

# Translator Worker
wrangler secret put TRIGGER_TOKEN       # Admin trigger authentication

# API Worker
wrangler secret put ADMIN_TOKEN         # Admin panel authentication
```

## FAQ Pipeline

The FAQ system automatically generates troubleshooting content from GitHub Issues:

| Stage | Tool | Description |
|-------|------|-------------|
| Harvest | GitHub Actions (daily) | `v3/collect.ts`: wide query, community signal scoring, smart comment selection |
| ETL | ETL Worker (every 15 min) | DeepSeek v4-pro Few-Shot → Post-Filter → Qwen-max Review |
| Translate | Translator Worker (every 5 min) | m2m100 machine translation (zh/ja/ko) |

Admin dashboard at `/admin/faq` shows real-time pipeline progress.

Manual FAQ processing:

```bash
cd scripts
$env:GITHUB_TOKEN = "..."
npx tsx v3/collect.ts --all       # Full harvest
npx tsx v3/generate.ts --all      # Full ETL (batch process)
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License.

## Acknowledgements

- Data sources: [GitHub](https://github.com)
- AI: [DeepSeek](https://deepseek.com), [Qwen](https://tongyi.aliyun.com) via [Cloudflare AI Gateway](https://developers.cloudflare.com/ai-gateway/)
- UI components: [shadcn/ui](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/)
- Translation: [Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)
