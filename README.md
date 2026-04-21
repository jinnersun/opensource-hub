# OpenSource-Hub

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

> [中文版本](README.zh.md)

OpenSource-Hub is a curated discovery and distribution platform for open-source software. It bridges the gap between GitHub and everyday users by providing human-curated, security-verified open-source tools with an intuitive, consumer-friendly experience.

## Features

- **Curated Catalog**: Hand-picked open-source software across categories like AI, video, privacy, system utilities, and more
- **Security Verification**: Integrated with VirusTotal for daily security scanning and trust verification
- **Multi-Platform Support**: Smart download cards that detect your OS (Windows / macOS / Linux) and highlight the right installer
- **Intelligent Search**: Natural language search and scenario-based discovery powered by vector matching
- **Multi-Language UI**: Full internationalization support (English / Chinese) via [next-intl](https://next-intl.dev/)
- **Trending Insights**: Real-time trending charts and download statistics
- **Open Source Transparency**: Direct links to original GitHub repositories, license info, and SHA-256 checksums

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS, Radix UI |
| Internationalization | next-intl |
| Backend / Edge | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Deployment | Cloudflare Pages + Workers |
| CI / Data Pipeline | GitHub Actions |

## Project Structure

```
.
├── web/                    # Next.js frontend application
│   ├── app/                # App Router pages
│   ├── components/         # UI & business components
│   ├── lib/                # Data models, utilities, API clients
│   ├── messages/           # i18n translation files (en, zh)
│   └── public/             # Static assets
├── workers/api/            # Cloudflare Worker API
├── migrations/             # D1 database schema & seed scripts
├── scripts/                # Data harvesting & automation scripts
└── wrangler.toml           # Cloudflare deployment configuration
```

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [npm](https://www.npmjs.com/) or [pnpm](https://pnpm.io/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### 1. Install dependencies

```bash
cd web
npm install

cd ../workers/api
npm install
```

### 2. Configure environment

Copy the example environment file and fill in your values:

```bash
cd web
cp .env.local.example .env.local
```

### 3. Set up the database

```bash
cd web
npm run db:create      # Create D1 database
npm run db:migrate     # Run schema migrations
npm run db:seed        # Insert seed data
```

### 4. Run the development server

```bash
cd web
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Run the API worker (optional)

```bash
cd workers/api
npm run dev
```

## Deployment

The project is designed to deploy on Cloudflare's edge infrastructure:

```bash
# Deploy frontend (web)
cd web
npm run deploy

# Deploy API worker
cd workers/api
npm run deploy
```

Make sure your `wrangler.toml` is properly configured with your D1 database bindings.

## Contributing

Contributions are welcome! Whether it's fixing a typo, adding a new feature, or improving documentation, feel free to open an issue or submit a pull request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Acknowledgements

- Data sources: [GitHub](https://github.com), [VirusTotal](https://www.virustotal.com)
- UI components built with [shadcn/ui](https://ui.shadcn.com/) and [Radix UI](https://www.radix-ui.com/)
