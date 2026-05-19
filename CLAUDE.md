# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Frontend dev server (from web/)
npm run dev                    # Next.js dev on localhost:3000
npm run build                  # Production build (uses opennextjs-cloudflare)
npm run lint                   # ESLint
npm run preview                # Build + preview with opennext locally
npm run deploy                 # Build + deploy to Cloudflare Pages

# Workers
cd workers/api     && npm run dev      # API Worker (wrangler dev)
cd workers/api     && npm run deploy
cd workers/etl     && npm run dev
cd workers/translator && npm run dev

# Database
npm run db:migrate             # Apply next migration
npm run db:seed                # Seed data
npm run cf-typegen             # Generate Cloudflare env types
```

## Architecture

### Data flow

```
Browser → Cloudflare Pages (next-on-pages)
              │
              ├─ /api/proxy?path=/api/apps&category=ai → API Worker (Service Binding, internal)
              │                                           │
              │                                           ├─ D1 (SQLite)
              │                                           ├─ Vectorize (semantic search)
              │                                           └─ Workers AI (embeddings)
              │
              └─ SSR pages → Service Binding fetch() → API Worker
```

Everything goes through `/api/proxy`. The API Worker has `workers_dev = false` — it's only reachable internally via Service Binding. The proxy collects all query params except `path`, reconstructs the query string, and forwards to `http://internal{path}?...`. It only forwards `Content-Type` and `Authorization` headers.

In dev, when Service Binding isn't available, the proxy falls back to `localhost:8787`.

### Workers

| Worker | Trigger | Purpose |
|--------|---------|---------|
| `opensource-hub-api` | HTTP (via Service Binding) | REST API for apps, search, categories, admin, sitemap |
| `opensource-hub-etl` | Cron `*/15 * * * *` | GitHub data ingestion, AI content generation, release parsing, vector embedding |
| `opensource-hub-translator` | Cron `*/5 * * * *` | Processes `translation_tasks` queue via CF AI m2m100, batch of 5 |

ETL flow: `raw_apps` → AI processing → `apps` (+ `app_versions`, `app_translations`, Vectorize). High-star repos without releases go to `apps_library` via `promoteToLibrary`.

ETL secrets (set via `wrangler secret put`):
- `OPENAI_API_KEY` — DeepSeek API key for AI content generation
- `GITHUB_TOKEN` — GitHub PAT for 5000/h rate limit
- `ALERT_WEBHOOK_URL` — optional failure alert webhook

### SSR pattern

Server Components in App Router access data via Service Binding to the API Worker. The Cloudflare context is available at `(globalThis as any)[Symbol.for('__cloudflare-context__')]`. Use `env.API.fetch()` to call the API Worker internally:

```typescript
const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
const apiBinding = ctx?.env?.API
const res = await apiBinding.fetch(new Request('http://internal/api/apps?...'))
```

This is currently used on the category detail page; the homepage, project detail, trending, and library pages still use CSR. The proxy route gets `Cache-Control: no-store` for `/admin/*` paths and `public, max-age=60` for everything else.

### Two "apps" tables

- **`apps`** — curated software with downloadable releases (has `app_versions`). Embedding ID: `app_{github_repo_id}`
- **`apps_library`** — code libraries/frameworks/cli tools (no releases, GitHub stars only). Embedding ID: `lib_{github_repo_id}`

Both have their own translation tables: `app_translations` and `apps_library_translations`.

### i18n

4 locales: `zh` (default), `en`, `ja`, `ko`. Uses `next-intl` with namespace-based messages under `web/messages/{locale}.json`.

Namespaces: `metadata`, `common`, `errors`, `notFound`, `errorPage`, `nav`, `home`, `category`, `search`, `project`, `trending`, `library`, `footer`, `contact`, `privacy`, `about`, `data` (dynamic category/project labels)

Adding a locale requires changes in 3 places:
1. `routing.ts` — add to `locales` array
2. `middleware.ts` — add to matcher regex
3. `web/messages/` — create `{locale}.json`

Server Components use `getTranslations({ locale, namespace })`. Client Components use `useTranslations('namespace')`. **Critical**: `getTranslations` returns functions (not strings). Never pass the raw translator function as a prop to a Client Component — pre-compute strings on the server instead.

### Admin panel

Routes under `/admin/*` (Dashboard, ETL, Submissions, Translations, Daily stats). Auth uses `ADMIN_TOKEN` as Bearer token, stored in `sessionStorage`. The admin layout checks auth on mount and redirects to `/admin/login` if the token is invalid or missing — the login page itself is excluded from this check.

## Common traps

1. **`raw_apps` PK is `github_repo_id`** (INTEGER), NOT `id`. Using `.id` returns `undefined`.
2. **New locale → must edit both `middleware.ts` matcher AND `routing.ts` locales**. Forgetting the matcher causes 404 on that locale.
3. **SWC rejects single-line no-brace if/else**: `if (x) a() else b()` — use ternary or add `{}`.
4. **`getTranslations` returns functions**, not strings. Can't pass to `"use client"` components. Pre-compute as strings in the Server Component.
5. **m2m100 language codes are simple**: `zh`, `en`, `ja`, `ko`, `es`, `pt` — NOT extended codes like `zho_Hans`, `ja-JP`.
6. **Proxy URL encoding**: Never use `encodeURIComponent` for proxy paths — `%26` gets decoded by `new URL()` as `&`, splitting query params. Use flat params: collect all except `path` into a new `URLSearchParams`.
7. **API null safety**: Always chain `?.` and provide fallbacks. `stats?.submissions?.pending || 0`.
8. **Admin auth guard must exclude `/admin/login`** — otherwise infinite redirect.
9. **`/api/proxy` doesn't forward all headers** — only `Content-Type` and `Authorization`. If you need other headers, add them in `forward()`.
10. **Internal links use `@/i18n/routing` Link**, not `<a href>`. External links use `<a target="_blank">`.
11. **DeepSeek AI may return non-standard category values** — always validate/normalize before inserting.
12. **`apps_library` has TWO IDs**: `id` (auto-increment) and `github_repo_id` (UNIQUE). For joins use `id`, for vector IDs use `lib_{github_repo_id}`.
13. **Development vs production proxy**: In dev, Service Binding may fail → proxy falls back to `localhost:8787`. Make sure the API Worker is running locally if you need it.

## Skills, agents & commands

| Type | Name | When to Use |
|------|------|-------------|
| Skill | `osh-cloudflare-dev` | Worker/D1/KV/Vectorize development & debugging |
| Skill | `osh-api-proxy` | `/api/proxy` debugging & maintenance |
| Skill | `osh-i18n-workflow` | Multi-language translation & debugging |
| Skill | `osh-ssr-migrate` | Converting CSR pages to Edge SSR |
| Skill | `osh-etl-pipeline` | ETL data pipeline maintenance |
| Skill | `osh-d1-migration` | D1 database migrations |
| Skill | `osh-new-locale` | Adding a new language |
| Skill | `osh-search-debug` | Vector search debugging |
| Agent | `api-reviewer` | Review API Worker route changes |
| Agent | `i18n-checker` | Verify i18n completeness |
| Agent | `proxy-debugger` | Diagnose proxy routing issues |
| Agent | `ssr-validator` | Validate SSR migration correctness |
| Command | `/new-locale` | Scaffold a new locale |
| Command | `/db-migrate` | Create & apply D1 migration |
| Command | `/check-i18n` | Check i18n consistency across all 4 locales |
| Command | `/deploy` | Deploy to Cloudflare (frontend/workers) |

## Coding rules reference

Before modifying code, consult the relevant rule file (`.claude/rules/`):
- Cross-file refactoring → `refactoring.md`
- New routes or auth changes → `routing-and-auth.md`
- Database queries → `database.md`
- Frontend components/pages → `frontend-completeness.md`
- General style → `coding-style.md`
- Cloudflare Workers/D1 → `cloudflare-patterns.md`
