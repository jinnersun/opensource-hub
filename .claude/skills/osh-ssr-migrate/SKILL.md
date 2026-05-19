---
name: osh-ssr-migrate
description: Migrate CSR pages to Edge SSR in OpenSource-Hub. Use when converting a client-rendered page to server-side rendering with Service Binding data fetching.
---

# SSR Migration

从 Client-Side Rendering (CSR) 迁移到 Edge Server-Side Rendering (SSR) 的工作流。
OpenSource-Hub 通过 Service Binding + `__cloudflare-context__` 实现 SSR 数据获取。

## When to Use

- 将现有 `"use client"` 页面改为 Server Component
- 新页面需要 SSR（SEO、首屏性能）
- 调试 SSR 页面 500 错误
- 理解 RSC (React Server Components) 序列化边界

## Migration Workflow

### Phase 1: Analyze Current Page

```bash
# 检查当前页面的数据获取方式
grep -n "useEffect\|fetch\|useState.*\[\]" -- "web/app/[locale]/target/page.tsx"

# 检查依赖的组件是否是 client-only
grep -n '"use client"' -- "web/components/used-component.tsx"
```

### Phase 2: Server Component Pattern

```typescript
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

type Props = { params: Promise<{ locale: string; id: string }> }

// ✅ SEO metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'data' })
  return {
    title: `${t(`categories.${id}.label`)} - OpenSource-Hub`,
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/category/${id}`,
      languages: { zh: `/zh/category/${id}`, en: `/en/category/${id}`, ... },
    },
  }
}

// ✅ Data fetching via Service Binding
async function getServerData(locale: string, id: string) {
  const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
  const api = ctx?.env?.API
  if (!api) return null

  const res = await api.fetch(new Request(
    `http://internal/api/apps?category=${encodeURIComponent(id)}&limit=24&lang=${locale}`
  ))
  const data = await res.json()
  return data
}

export default async function Page({ params }: Props) {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'category' })
  const td = await getTranslations({ locale, namespace: 'data' })

  const data = await getServerData(locale, id)

  if (!data) return <ErrorState />

  // ✅ Pre-compute translation strings
  const label = td(`categories.${id}.label`)
  const catLabels = data.categories.map(c => td(`categories.${c.id}.label`))

  return (
    <div>
      <h1>{label}</h1>
      <ProjectList projects={data.projects} />
      {/* ✅ Client components for interactivity */}
      <Suspense fallback={<Spinner />}>
        <LoadMore categoryId={id} locale={locale} hasMore={data.hasMore} />
      </Suspense>
      {/* ✅ Pass pre-computed strings, NOT functions */}
      <Sidebar catLabels={catLabels} label={label} />
    </div>
  )
}
```

### Phase 3: Extract Client Components

将需要交互的部分提取为 `"use client"` 组件：

```
web/app/[locale]/category/[id]/
  page.tsx           ← Server Component
  _components/
    category-sidebar.tsx ← Client (接收 string props)
    load-more.tsx        ← Client (分页加载)
```

### Phase 4: Verify

```
[ ] page.tsx 没有 "use client" 指令
[ ] 数据通过 Service Binding 获取 (不是 useEffect + fetch)
[ ] 所有 getTranslations 返回值已预计算为字符串
[ ] 传给 Client Component 的 props 都是可序列化类型 (string/number/boolean/array/object)
[ ] 没有传函数给 Client Component
[ ] generateMetadata 正确配置 canonical + hreflang
[ ] Client Component 正确接收预计算字符串（非函数）
[ ] 错误状态处理（data 为 null 时显示 ErrorState）
```

## RSC Serialization Boundary

**Server Component → Client Component 传递的 props 必须是可序列化的：**

| Type | Serializable |
|------|-------------|
| string, number, boolean | ✅ |
| null, undefined | ✅ |
| Array, plain Object | ✅ |
| Date | ✅ (序列化为 string) |
| Function | ❌ |
| Class instance | ❌ |
| Symbol | ❌ |
| JSX Element | ❌ (但可作为 children) |
| Promise | ❌ |

## Common Traps

1. **直连 D1**: `ctx.env.DB` 在 open-next 下不可用 → 必须走 Service Binding → API Worker
2. **函数传给客户端**: `getTranslations` 返回函数 → 预计算为字符串
3. **忘记 generateMetadata**: SSR 页面需要 metadata 才有 SEO 价值
4. **`Suspense` 边界缺失**: Client Component 在 `<Suspense>` 外会阻塞整个页面
5. **hybrid 模式**: 页面主体用 SSR，交互部分用 Client Component，不要全量迁移

## Migration Priority

建议按以下顺序迁移（SEO 价值从高到低）：

| Priority | Page | Reason |
|----------|------|--------|
| P0 | `category/[id]` | ✅ Done — 分类详情 SEO 价值高 |
| P1 | `project/[id]` | 项目详情页 SEO 价值最高 |
| P2 | `/` (homepage) | 首页首屏性能 |
| P3 | `/category` | 分类列表 |
| P4 | `/trending` | 趋势页时效性强 |
| P5 | `/search` | 搜索页已 CSR 为主 |
