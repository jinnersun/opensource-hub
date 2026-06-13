import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ProjectCard } from '@/components/project-card'
import { ErrorState } from '@/components/error-state'
import { transformAppForDisplay, type Project } from '@/lib/api'
import { Link } from '@/i18n/routing'
import { ArrowLeft, Tag, Loader2 } from 'lucide-react'

type Props = { params: Promise<{ locale: string; slug: string }> }

// 不设 dynamicParams = false：build 时 Worker 不可用导致 generateStaticParams 返回空
// 改为运行时 SSR on-demand，此时 Service Binding 可用

// 标签翻译映射表（热门标签，未覆盖的 fallback 到 formatTagName）
const TAG_TRANSLATIONS: Record<string, Record<string, string>> = {
  'screen-recording': { zh: '屏幕录制', en: 'Screen Recording', ja: 'スクリーン録画', ko: '화면 녹화' },
  'video-editing':   { zh: '视频编辑',   en: 'Video Editing',    ja: '動画編集',       ko: '동영상 편집' },
  'video-download':  { zh: '视频下载',   en: 'Video Download',   ja: '動画ダウンロード', ko: '동영상 다운로드' },
  'pdf-editor':      { zh: 'PDF 编辑',   en: 'PDF Editor',       ja: 'PDF エディター',  ko: 'PDF 편집' },
  'privacy':         { zh: '隐私保护',   en: 'Privacy',          ja: 'プライバシー',     ko: '개인정보 보호' },
  'design':          { zh: '设计工具',   en: 'Design',           ja: 'デザイン',         ko: '디자인' },
  'photo-editing':   { zh: '图片编辑',   en: 'Photo Editing',    ja: '写真編集',         ko: '사진 편집' },
  'note-taking':     { zh: '笔记',       en: 'Note Taking',      ja: 'ノート',           ko: '노트' },
  'system-cleaner':  { zh: '系统清理',   en: 'System Cleaner',   ja: 'システムクリーン', ko: '시스템 정리' },
  'music-download':  { zh: '音乐下载',   en: 'Music Download',   ja: '音楽ダウンロード', ko: '음악 다운로드' },
}

function formatTagName(slug: string): string {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function getTagDisplayName(slug: string, locale: string): string {
  return TAG_TRANSLATIONS[slug]?.[locale] || formatTagName(slug)
}

export async function generateStaticParams() {
  const locales = ['zh', 'en', 'ja', 'ko']
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (!api) return []
    const res = await api.fetch(new Request('http://internal/api/tags'))
    const { tags } = await res.json() as { tags: string[] }
    return locales.flatMap(locale => tags.map(tag => ({ locale, slug: tag })))
  } catch { return [] }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const { locale, slug } = await params
    const tagDisplay = getTagDisplayName(slug, locale)
    return {
      title: `${tagDisplay} - OpenSource-Hub`,
      description: `Discover the best open source ${formatTagName(slug).toLowerCase()} tools. Free, secure, and community-trusted.`,
      alternates: {
        canonical: `https://www.opensource-hub.com/${locale}/tag/${slug}`,
        languages: {
          zh: `https://www.opensource-hub.com/zh/tag/${slug}`,
          en: `https://www.opensource-hub.com/en/tag/${slug}`,
          ja: `https://www.opensource-hub.com/ja/tag/${slug}`,
          ko: `https://www.opensource-hub.com/ko/tag/${slug}`,
          'x-default': `https://www.opensource-hub.com/en/tag/${slug}`,
        },
      },
    }
  } catch (error) {
    console.error('[generateMetadata tag]', error)
    return {}
  }
}

async function getTagData(locale: string, slug: string) {
  console.log('[SSR tag] ========== 开始获取Tag数据 ==========')
  console.log('[SSR tag] 参数: locale=', locale, ', slug=', slug)
  
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    console.log('[SSR tag] Cloudflare context:', ctx ? '存在' : '不存在')
    
    const api = ctx?.env?.API
    console.log('[SSR tag] API binding:', api ? '可用' : '不可用')
    
    if (!api) {
      console.error('[SSR tag] ❌ Service Binding not available')
      return { error: 'api_unavailable', apps: [], appCount: 0, isEmpty: true, debug: 'no_api_binding' }
    }

    // 通过 slug 反查原始标签名
    console.log('[SSR tag] 正在调用 /api/tags...')
    const mapRes = await api.fetch(new Request('http://internal/api/tags'))
    console.log('[SSR tag] /api/tags 响应状态:', mapRes.status)
    
    if (!mapRes.ok) {
      console.error('[SSR tag] ❌ /api/tags failed:', mapRes.status)
      return { error: 'api_error', apps: [], appCount: 0, isEmpty: true, debug: 'tags_api_failed' }
    }
    
    const { map, tags } = await mapRes.json() as { map: Record<string, string>; tags: string[] }
    console.log('[SSR tag] 获取到标签数量:', tags?.length || 0)
    
    const originalTag = map[slug] || slug
    console.log('[SSR tag] Slug映射: ', slug, '->', originalTag)

    console.log('[SSR tag] 正在调用 /api/apps?tag=...')
    const res = await api.fetch(
      new Request(`http://internal/api/apps?tag=${encodeURIComponent(originalTag)}&limit=50&lang=${locale}`)
    )
    console.log('[SSR tag] /api/apps 响应状态:', res.status)
    
    if (!res.ok) {
      const errorText = await res.text().catch(() => 'unknown')
      console.error('[SSR tag] ❌ /api/apps failed:', res.status, errorText)
      return { error: 'api_error', apps: [], appCount: 0, isEmpty: true, debug: 'apps_api_failed' }
    }
    
    const data = await res.json() as any
    console.log('[SSR tag] API返回应用数量:', data?.data?.length || 0)
    
    const apps = (data.data || [])
      .map(transformAppForDisplay)
      .sort((a: Project, b: Project) => b.stars - a.stars)

    console.log('[SSR tag] ✅ 成功获取数据，应用数:', apps.length)
    return { tag: originalTag, appCount: apps.length, apps, isEmpty: apps.length === 0, debug: 'success' }
  } catch (e: any) {
    console.error('[SSR tag] ❌ Exception:', e?.message || e, e?.stack)
    return { error: e?.message || 'unknown', apps: [], appCount: 0, isEmpty: true, debug: 'exception' }
  }
}

export default async function TagPage({ params }: Props) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: 'category' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  console.log('[TagPage] ========== 页面组件开始渲染 ==========')
  console.log('[TagPage] params: locale=', locale, ', slug=', slug)

  const data = await getTagData(locale, slug)
  console.log('[TagPage] getTagData返回:', JSON.stringify({
    error: data.error,
    debug: (data as any).debug,
    appCount: data.appCount,
    isEmpty: data.isEmpty
  }))

  // data 现在总是有值，不会 null
  const { apps, appCount, isEmpty, error, tag, debug } = data as any
  const tagDisplay = getTagDisplayName(slug, locale)
  
  console.log('[TagPage] 解构后: apps=', apps?.length, ', appCount=', appCount, ', isEmpty=', isEmpty, ', error=', error)
  
  // 如果有错误，记录日志但仍渲染页面（空状态）
  if (error) {
    console.error('[TagPage] ❌ 错误:', error, ', Slug:', slug, ', Debug:', debug)
  } else {
    console.log('[TagPage] ✅ 数据正常，开始渲染页面')
  }

  // JSON-LD ItemList
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `Best ${formatTagName(slug)} Tools`,
    description: `Curated list of open source ${formatTagName(slug).toLowerCase()} tools`,
    numberOfItems: appCount,
    itemListElement: apps.map((app: Project, i: number) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: app.name,
        description: app.description,
        applicationCategory: app.categoryLabel || 'Software',
        operatingSystem: Object.keys(app.platforms || {}).join(', ') || 'Cross-platform',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      },
    })),
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* 调试信息 - 临时显示 */}
        <div className="mb-4 p-4 bg-yellow-100 border border-yellow-400 rounded text-sm font-mono">
          <p><strong>🔍 调试信息:</strong></p>
          <p>Debug: {debug || 'N/A'}</p>
          <p>Error: {error || 'None'}</p>
          <p>App Count: {appCount}</p>
          <p>isEmpty: {String(isEmpty)}</p>
          <p>Slug: {slug}</p>
          <p>Tag: {tag || 'N/A'}</p>
        </div>

        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            {t('browseAll')}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{tagDisplay}</span>
        </div>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Tag className="size-7 text-muted-foreground" />
            {tagDisplay}
          </h1>
          {isEmpty ? (
            <p className="mt-3 text-muted-foreground">
              {t('noAppsForTag') || `No applications found for "${tagDisplay}" yet.`}
            </p>
          ) : (
            <p className="mt-3 text-muted-foreground">{appCount} open source tools found</p>
          )}
        </div>

        {/* Empty state */}
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20">
            <span className="text-5xl mb-4">🏷️</span>
            <p className="text-lg text-muted-foreground">
              {t('empty', { label: tagDisplay })}
            </p>
            <Link href="/search" className="mt-4 text-sm text-foreground underline underline-offset-4">
              {t('browseAll')}
            </Link>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {apps.map((project: Project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
