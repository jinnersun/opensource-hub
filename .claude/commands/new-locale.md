---
name: new-locale
description: Scaffold a new locale/language for OpenSource-Hub. Adds locale to routing, middleware, creates message file, updates hreflang.
allowed_tools: ["Read", "Write", "Edit", "Grep", "Glob", "Bash"]
---

# /new-locale <locale_code>

Add a new language to OpenSource-Hub. Invoke with the ISO-639-1 code (e.g., `es`, `fr`, `de`).

## Goal

Add complete support for a new locale across all required files.

## Steps

### 1. Validate Input
- Accept a 2-letter ISO-639-1 code
- Verify m2m100 supports this code (if using AI translation)
- Confirm with user: "Add {language_name} ({code}) support?"

### 2. Update `web/i18n/routing.ts`
- Add the new code to the `locales` array
- Keep `defaultLocale: 'zh'`

### 3. Update `web/middleware.ts`
- Add the new code to the matcher regex pattern
- Example: `'/(zh|en|ja|ko|NEW)/:path*'`

### 4. Create `web/messages/{code}.json`
- Copy from `web/messages/en.json` as template
- Replace all string values with {language_name} translations
- Pay special attention to:
  - `data.categories.*.label` and `data.categories.*.description`
  - `footer.*.links` arrays (same structure, translated labels)
  - `privacy.sections` and `about` content

### 5. Update hreflang in SSR pages
- Check all pages with `generateMetadata` for `alternates.languages`
- Add the new locale entry

### 6. Update Translator Worker (if needed)
- `workers/translator/wrangler.toml`: add to `TARGET_LOCALES`
- `workers/translator/src/index.ts`: add to locale validation if needed

### 7. Verify
```bash
# Start dev server
cd web && npm run dev
# Test at http://localhost:3000/{code}
```

## Common Files Touched
- `web/i18n/routing.ts`
- `web/middleware.ts`
- `web/messages/{code}.json` (NEW)
- `web/app/[locale]/category/[id]/page.tsx`
- `workers/translator/wrangler.toml`

## Notes
- The middleware matcher change is the most commonly missed step — double check!
- If the new language is not in m2m100's supported languages, the Translator Worker cannot auto-translate for it
