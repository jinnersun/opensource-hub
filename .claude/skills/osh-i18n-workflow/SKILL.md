---
name: osh-i18n-workflow
description: Internationalization workflow for OpenSource-Hub (next-intl). Use when adding translations, debugging locale issues, adding new locale, or changing i18n structure.
---

# i18n Workflow

OpenSource-Hub 的多语言国际化开发、调试和维护工作流。基于 next-intl，支持 4 种语言 (zh/en/ja/ko)。

## When to Use

- 添加新的翻译文本
- 新增语言支持
- 修改翻译 key 或命名空间
- 调试语言切换问题
- 翻译文件结构重构
- SSR 页面中的 i18n 问题

## Architecture

```
web/messages/
  zh.json    ← 默认语言 (defaultLocale)
  en.json
  ja.json
  ko.json

web/i18n/
  routing.ts    ← locale 配置 (locales array, defaultLocale, Link/redirect)
  request.ts    ← getRequestConfig (动态加载 messages)

web/middleware.ts ← i18n 路由匹配 (matcher regex)
```

## Namespace Structure

翻译文件按命名空间组织，每个命名空间是一个顶层 key：

```
zh.json → {
  "metadata": { "title": "...", "description": "..." },
  "common": { "home": "首页", "verified": "校验码", ... },
  "nav": { "discover": "发现", ... },
  "home": { "heroTitle": "...", ... },
  "category": { "browseAll": "...", "empty": "...", "otherCategories": "..." },
  "search": { ... },
  "project": { ... },
  "trending": { ... },
  "library": { ... },
  "footer": { "brand": { "slogan": "..." }, "discover": { "title": "...", "links": [...] } },
  "contact": { ... },
  "privacy": { ... },
  "about": { ... },
  "errors": { "title": "加载失败", "retry": "重试", ... },
  "data": {
    "categories": {
      "ai": { "label": "AI 人工智能", "description": "..." },
      "video": { "label": "视频创作", ... },
      ...
    }
  }
}
```

**`data` 命名空间**: 存放动态内容（分类名、项目名），key 基于数据库 slug。

## Usage Patterns

### Server Components

```typescript
import { getTranslations } from 'next-intl/server'

export default async function Page({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'category' })
  const td = await getTranslations({ locale, namespace: 'data' })

  // ✅ t() 返回 string
  const label = t('browseAll')

  // ✅ 动态 key
  const catLabel = td(`categories.${categoryId}.label`)
}
```

### Client Components

```typescript
'use client'
import { useTranslations } from 'next-intl'

export function MyComponent() {
  const t = useTranslations('category')
  return <span>{t('browseAll')}</span>
}
```

### CRITICAL: Server → Client Boundary

**`getTranslations` 返回函数对象,不能直接传给 Client Component！**

```typescript
// ❌ WRONG — td 是函数，RSC 无法序列化传给客户端组件
<CategorySidebar td={td} />

// ✅ RIGHT — 在 Server Component 中预计算为字符串
const catLabels = categories.map(c => td(`categories.${c.id}.label`))
const allLabel = t('all', { label, count: projects.length })
<CategorySidebar catLabels={catLabels} allLabel={allLabel} />
```

## Adding a New Locale

必须同步修改 3 个文件：

### 1. `web/i18n/routing.ts`
```typescript
export const routing = defineRouting({
  locales: ['zh', 'en', 'ja', 'ko', 'es'],  // 添加新语言
  defaultLocale: 'zh',
  localePrefix: 'always',
})
```

### 2. `web/middleware.ts`
```typescript
export const config = {
  matcher: ['/', '/(zh|en|ja|ko|es)/:path*'],  // 添加新语言到正则
}
```

### 3. `web/messages/{locale}.json`
创建新的翻译文件，包含所有命名空间和 key。

**忘记修改 matcher 正则会导致该 locale 整站 404！**

## Debugging i18n Issues

```
[ ] 检查 middleware.ts matcher 是否包含目标 locale
[ ] 检查 routing.ts locales 数组是否包含目标 locale
[ ] 检查 messages/{locale}.json 是否存在且结构完整
[ ] 检查 Link 组件是否正确导入自 @/i18n/routing
[ ] 检查 SSR 页面是否将翻译预计算为字符串（而非传递函数）
[ ] 检查 footer.tsx 中 sitemap 等根路径链接是否使用原生 <a> 标签
[ ] 检查 generateMetadata 中的 hreflang 配置
```

## Common Traps

1. **新增 locale 忘记改 middleware matcher** → 该 locale 整站 404
2. **`getTranslations` 函数传给 Client Component** → RSC 序列化错误 / 页面 500
3. **内部链接用 `<a href>` 而非 `<Link>`** → 丢失 locale 前缀
4. **根路径链接（sitemap 等）用 `<Link>`** → 被加上 locale 前缀 → 404
5. **`data` 命名空间的 key 用点号访问**: `td(`categories.${id}.label`)` 而非 `td('categories')[id].label`
6. **翻译文件中缺少 key**: next-intl 不会 fallback 到其他 locale，直接报错
