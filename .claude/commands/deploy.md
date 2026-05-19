---
name: deploy
description: Guide through deploying OpenSource-Hub (frontend + workers) to Cloudflare.
allowed_tools: ["Read", "Bash", "Grep"]
---

# /deploy <target>

Deploy OpenSource-Hub to Cloudflare. Choose from: `frontend`, `api`, `etl`, `translator`, or `all`.

## Goal

Deploy the specified component(s) to Cloudflare with proper verification.

## Deploy Targets

### Frontend (`web/`)
```bash
cd web
npm run deploy
# Runs: opennextjs-cloudflare build && opennextjs-cloudflare deploy
```

### API Worker (`workers/api/`)
```bash
cd workers/api
npm run deploy
# Runs: wrangler deploy
```

**Pre-flight check**: Confirm secrets are configured:
```bash
cd workers/api
wrangler secret list
# Required: ADMIN_TOKEN, TRIGGER_TOKEN
```

### ETL Worker (`workers/etl/`)
```bash
cd workers/etl
npm run deploy
# Runs: wrangler deploy
```

**Pre-flight check**: Confirm secrets are configured:
```bash
cd workers/etl
wrangler secret list
# Required: OPENAI_API_KEY, GITHUB_TOKEN, TRIGGER_TOKEN
```

### Translator Worker (`workers/translator/`)
```bash
cd workers/translator
npm run deploy
# Runs: wrangler deploy
```

### All (deploy order: API → ETL → Translator → Frontend)
```bash
cd workers/api && npm run deploy && cd ../etl && npm run deploy && cd ../translator && npm run deploy && cd ../../web && npm run deploy
```

## Verification

After deployment:

### API Worker
```bash
curl "https://www.opensource-hub.com/api/proxy?path=/api/health"
# Expected: { "status": "ok", "version": "1.0.0" }
```

### Frontend
```bash
curl -I "https://www.opensource-hub.com/en"
# Expected: HTTP/2 200
```

### ETL Worker
```bash
# Check ETL status via admin panel or:
curl "https://www.opensource-hub.com/api/proxy?path=/admin/stats" \
  -H "Authorization: Bearer ${ADMIN_TOKEN}"
```

## Pre-Deployment Checklist
```
[ ] All changes committed and pushed
[ ] Build passes locally (npm run build)
[ ] No console.log left in code (only console.error/warn)
[ ] Worker secrets confirmed present (wrangler secret list)
[ ] wrangler.toml config reviewed for each worker
[ ] Migration applied if schema changed
```
