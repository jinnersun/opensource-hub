---
name: osh-new-locale
description: Add a new language/locale to OpenSource-Hub. Use when user wants to add support for a new language like Spanish, French, German, etc.
---

# Add New Locale

为 OpenSource-Hub 添加新语言支持的完整工作流。

## When to Use

- 新增语言支持（如 es, fr, de, pt-BR）
- 用户要求 "添加 XX 语言"
- 扩展国际化覆盖范围

## Required Changes (All 5 Locations)

### 1. `web/i18n/routing.ts`
```typescript
export const routing = defineRouting({
  locales: ['zh', 'en', 'ja', 'ko', 'es'],  // ← 添加新 locale
  defaultLocale: 'zh',
  localePrefix: 'always',
})
```

### 2. `web/middleware.ts`
```typescript
export const config = {
  // ← 添加新 locale 到正则
  matcher: ['/', '/(zh|en|ja|ko|es)/:path*'],
}
```
**❗ 忘记修改此处会导致该 locale 整站 404！**

### 3. `web/messages/{locale}.json`
创建完整翻译文件。至少包含这些命名空间：

```json
{
  "metadata": { "title": "...", "description": "..." },
  "common": { "home": "...", "get": "...", "verified": "...", ... },
  "errors": { "title": "...", "description": "...", "retry": "...", ... },
  "notFound": { "title": "...", "description": "...", "goBack": "...", "goHome": "..." },
  "errorPage": { "title": "...", "description": "...", "retry": "...", "goHome": "..." },
  "nav": { "discover": "...", "trending": "...", "library": "...", ... },
  "home": { ... },
  "category": { "browseAll": "...", "empty": "...", "otherCategories": "...", "all": "..." },
  "search": { ... },
  "project": { ... },
  "trending": { ... },
  "library": { ... },
  "footer": {
    "brand": { "slogan": "...", "techSignal": "..." },
    "discover": { "title": "...", "links": [...] },
    "resources": { "title": "...", "links": [...] },
    "legal": { "title": "...", "links": [...] },
    "copyright": "..."
  },
  "contact": { "title": "...", "description": "...", ... },
  "privacy": { "title": "...", "sections": [...] },
  "about": { "title": "...", "description": "...", ... },
  "data": {
    "categories": {
      "ai": { "label": "...", "description": "..." },
      "video": { "label": "...", "description": "..." }
      // ... all categories
    }
  }
}
```

**策略**: 可以先复制 `en.json`，替换所有值为目标语言翻译。`data.categories` 中的 `label` 和 `description` 需要翻译。

### 4. 页面 hreflang 更新

在已有 SSR 页面（当前 `category/[id]/page.tsx`）的 `generateMetadata` 中添加新 locale：

```typescript
languages: {
  zh: `/zh/category/${id}`,
  en: `/en/category/${id}`,
  ja: `/ja/category/${id}`,
  ko: `/ko/category/${id}`,
  es: `/es/category/${id}`,  // ← 添加
  'x-default': `/en/category/${id}`,
},
```

### 5. Translator Worker 配置

如果新语言需要通过 AI 翻译，更新 `workers/translator/wrangler.toml`：

```toml
[vars]
TARGET_LOCALES = "ja,ko,es,pt-BR,fr"  # ← 添加新语言
```

以及 `workers/translator/src/index.ts` 中验证 locale 的逻辑。

## Verification Checklist

```
[ ] routing.ts locales 数组包含新语言
[ ] middleware.ts matcher 正则包含新语言
[ ] messages/{locale}.json 存在且所有 key 齐全
[ ] header/language-switcher 组件包含新语言选项
[ ] SSR 页面 generateMetadata hreflang 更新
[ ] Translator Worker TARGET_LOCALES 更新（如需 AI 翻译）
[ ] 本地 dev 测试: http://localhost:3000/{locale}
[ ] 检查所有内部链接正确使用 i18n Link 组件
[ ] 检查外部链接和根路径链接使用原生 <a> 标签
```

## Common Traps

1. **忘改 middleware matcher** → 新 locale 404
2. **翻译文件结构不完整** → next-intl 找不到 key 报错
3. **data.categories 的 key 遗漏** → 分类页名称显示 raw slug
4. **footer links 中 links 数组格式** → 必须包含 `{ label, href }` 对象
5. **m2m100 不支持的语言代码** → 使用简单 ISO-639-1（如 `fr` 而非 `fr-FR`）
