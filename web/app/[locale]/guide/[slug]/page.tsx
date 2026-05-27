import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ProjectCard } from '@/components/project-card'
import { ErrorState } from '@/components/error-state'
import { transformAppForDisplay } from '@/lib/api'
import { Link } from '@/i18n/routing'
import { ArrowRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { guides } from '@/config/guides'

type Props = { params: Promise<{ locale: string; slug: string }> }

export const dynamicParams = false

export function generateStaticParams() {
  const locales = ['zh', 'en', 'ja', 'ko']
  return locales.flatMap(locale =>
    guides.map(g => ({ locale, slug: g.slug }))
  )
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params
  const guide = guides.find(g => g.slug === slug)
  if (!guide) return { title: 'OpenSource-Hub' }

  return {
    title: `${guide.title[locale] || guide.title.en} - OpenSource-Hub`,
    description: guide.description[locale] || guide.description.en,
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/guide/${slug}`,
      languages: {
        zh: `https://www.opensource-hub.com/zh/guide/${slug}`,
        en: `https://www.opensource-hub.com/en/guide/${slug}`,
        ja: `https://www.opensource-hub.com/ja/guide/${slug}`,
        ko: `https://www.opensource-hub.com/ko/guide/${slug}`,
        'x-default': `https://www.opensource-hub.com/en/guide/${slug}`,
      },
    },
  }
}

async function getGuideData(locale: string, slug: string) {
  try {
    const guide = guides.find(g => g.slug === slug)
    if (!guide) return null

    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (!api) return null

    // 批量多标签 OR 查询（1 次 API 调用替代 N 次）
    const tagsParam = guide.tags.map(encodeURIComponent).join(',')
    const res = await api.fetch(
      new Request(`http://internal/api/apps?tag=${tagsParam}&limit=50&lang=${locale}`)
    )
    const data = await res.json() as any

    // 去重 + 按 stars 排序 + 取 top N
    const seen = new Set<string>()
    const apps = (data.data || [])
      .map(transformAppForDisplay)
      .filter((a: any) => {
        const key = a.id || a.slug
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a: any, b: any) => b.stars - a.stars)
      .slice(0, guide.maxApps || 5)

    return { guide, apps }
  } catch (e) {
    console.error('[SSR guide]', e)
    return null
  }
}

export default async function GuidePage({ params }: Props) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: 'search' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  const data = await getGuideData(locale, slug)

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-12">
          <ErrorState title={te('title')} description={te('description')} />
        </main>
        <Footer />
      </div>
    )
  }

  const { guide, apps } = data
  const title = guide.title[locale] || guide.title.en
  const intro = guide.intro[locale] || guide.intro.en

  // JSON-LD: ItemList + FAQPage
  const faqSlug = title.toLowerCase().replace(/^best (free )?/, '')
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'ItemList',
        name: title,
        description: guide.description[locale] || guide.description.en,
        numberOfItems: apps.length,
        itemListElement: apps.map((app: any, i: number) => ({
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
      },
      {
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: `What are the best free ${faqSlug}?`,
            acceptedAnswer: {
              '@type': 'Answer',
              text: intro,
            },
          },
          {
            '@type': 'Question',
            name: 'Are these tools really free and open source?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Yes. All tools listed here are verified open source software with GitHub-verified SHA-256 checksums. No trials, no watermarks, no hidden fees.',
            },
          },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <span>/</span>
          <span className="text-foreground font-medium">{title}</span>
        </div>

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-3xl font-bold sm:text-4xl mb-4">{title}</h1>
          <div className="prose prose-neutral max-w-3xl">
            <p className="text-lg text-muted-foreground leading-relaxed">{intro}</p>
          </div>
        </div>

        {/* App Cards */}
        {apps.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 mb-12">
            {apps.map((app: any) => (
              <ProjectCard key={app.id} project={app} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 mb-12">
            <p className="text-lg text-muted-foreground">No applications found yet.</p>
          </div>
        )}

        {/* CTA */}
        <div className="border-t pt-8 text-center">
          <p className="text-muted-foreground mb-4">
            Looking for something else? Search our full catalog of open source software.
          </p>
          <Link href="/search">
            <Button variant="outline" className="gap-2">
              <Search className="size-4" />
              Search All Tools
              <ArrowRight className="size-4" />
            </Button>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  )
}
