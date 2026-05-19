---
name: check-i18n
description: Check i18n completeness across all 4 OpenSource-Hub locale files.
allowed_tools: ["Read", "Grep", "Glob"]
---

# /check-i18n

Verify i18n completeness and consistency across all locale files.

## Goal

Ensure zh.json, en.json, ja.json, and ko.json are structurally equivalent and all required keys exist.

## Steps

### 1. Compare Top-Level Namespaces
Read all 4 locale files and compare their top-level key sets.
Any namespace present in one but missing in another is an error.

### 2. Deep Key Comparison
For each namespace, compare nested keys:
- Same keys at every nesting level
- Arrays have same length (footer links, privacy sections)
- `data.categories.*` has entries for all categories in all files

### 3. Check Configuration Files
- `routing.ts`: all 4 locales in `locales` array
- `middleware.ts`: all 4 locales in matcher regex

### 4. Check SSR Pages
- `generateMetadata` has `alternates.languages` with all 4 locales
- No raw `getTranslations` function passed to client components

### 5. Report
Output format:
```
## i18n Completeness Report

### Namespace Coverage by Locale
| Namespace | zh | en | ja | ko |
|-----------|---|---|----|----|

### Missing Keys
- [locale]: path.to.missing.key

### Configuration
- routing.ts: [PASS/FAIL]
- middleware.ts: [PASS/FAIL]

### Verdict
X/4 locales fully consistent. Y issues found.
```

## Common Files Checked
- `web/messages/zh.json`
- `web/messages/en.json`
- `web/messages/ja.json`
- `web/messages/ko.json`
- `web/i18n/routing.ts`
- `web/middleware.ts`
- `web/app/[locale]/category/[id]/page.tsx`
