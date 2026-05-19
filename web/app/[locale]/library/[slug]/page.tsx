import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import type { Metadata } from 'next'
import {
  ArrowLeft,
  Star,
  ExternalLink,
  Github,
  Globe,
} from 'lucide-react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorState } from '@/components/error-state'
import {
  parseLibraryTags,
  type LibraryItem,
} from '@/lib/api'

type LibraryProps = { params: Promise<{ locale: string; slug: string }> }

export async function generateMetadata({ params }: LibraryProps): Promise<Metadata> {
  const { locale, slug } = await params
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (api) {
      const res = await api.fetch(new Request(`http://internal/api/library/${slug}?lang=${locale}`))
      const item = await res.json() as LibraryItem
      if (item?.name) {
        return {
          title: `${item.name} - OpenSource-Hub`,
          description: (item.summary || item.description || '').slice(0, 160),
          alternates: {
            canonical: `https://www.opensource-hub.com/${locale}/library/${slug}`,
            languages: {
              zh: `https://www.opensource-hub.com/zh/library/${slug}`,
              en: `https://www.opensource-hub.com/en/library/${slug}`,
              ja: `https://www.opensource-hub.com/ja/library/${slug}`,
              ko: `https://www.opensource-hub.com/ko/library/${slug}`,
              'x-default': `https://www.opensource-hub.com/en/library/${slug}`,
            },
          },
        }
      }
    }
  } catch { /* fallback */ }
  return { title: 'OpenSource-Hub' }
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return iso
  }
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}

async function getServerData(locale: string, slug: string) {
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (!api) return null

    const itemRes = await api.fetch(new Request(`http://internal/api/library/${encodeURIComponent(slug)}?lang=${locale}`))
    const item = await itemRes.json() as LibraryItem
    if (!item?.name) return null

    // Fetch related items by project_type
    let related: LibraryItem[] = []
    if (item.project_type) {
      try {
        const relRes = await api.fetch(new Request(`http://internal/api/library?project_type=${encodeURIComponent(item.project_type)}&limit=6&sort=stars&lang=${locale}`))
        const relData = await relRes.json() as any
        related = (relData.data || []).filter((r: LibraryItem) => r.slug !== item.slug).slice(0, 4)
      } catch { /* related non-critical */ }
    }

    return { item, related }
  } catch (e) {
    console.error('[SSR library]', e)
    return null
  }
}

export default async function LibraryDetailPage({ params }: LibraryProps) {
  const { locale, slug } = await params
  const t = await getTranslations({ locale, namespace: 'library' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  const data = await getServerData(locale, slug)

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-12">
          <ErrorState title={te('title')} description={te('description')} />
        </main>
        <Footer />
      </div>
    )
  }

  const { item, related } = data
  const tags = parseLibraryTags(item.tags)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: item.name,
        description: (item.summary || item.description || '').slice(0, 300),
        applicationCategory: item.category_name || item.category || '',
        operatingSystem: 'Any',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Organization', name: item.full_name?.split('/')[0] || '' },
        dateModified: item.last_updated,
        license: item.license || '',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `https://www.opensource-hub.com/${locale}` },
          { '@type': 'ListItem', position: 2, name: t('backToList'), item: `https://www.opensource-hub.com/${locale}/library` },
          { '@type': 'ListItem', position: 3, name: item.name },
        ],
      },
    ],
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* JSON-LD */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <div className="mb-6">
          <Link
            href="/library"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </div>

        {/* Header block */}
        <div className="mb-8">
          <div className="flex flex-wrap items-start gap-3 mb-3">
            <h1 className="text-3xl font-bold break-all">{item.name}</h1>
            <Badge variant="secondary" className="mt-2">
              {t(`type.${item.project_type}`)}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4 break-all">{item.full_name}</p>

          {item.summary && (
            <p className="text-lg text-foreground/90 mb-4">{item.summary}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <a href={item.html_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                <Github className="h-4 w-4" />
                {t('visitRepo')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            {item.homepage && (
              <Button variant="outline" asChild>
                <a href={item.homepage} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5">
                  <Globe className="h-4 w-4" />
                  {t('visitHomepage')}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {item.full_description && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-3">{t('overview')}</h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {item.full_description}
                  </p>
                </CardContent>
              </Card>
            )}

            {item.readme_preview && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-3">{t('readmePreview')}</h2>
                  <pre className="text-xs leading-relaxed whitespace-pre-wrap break-words font-mono text-muted-foreground max-h-[600px] overflow-auto">
                    {item.readme_preview}
                  </pre>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <aside className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-3 text-sm">
                <MetaRow
                  label={t('stars')}
                  value={
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5" />
                      {formatStars(item.stars_count)}
                    </span>
                  }
                />
                {item.language && (
                  <MetaRow label={t('language')} value={item.language} />
                )}
                {item.license && (
                  <MetaRow label={t('license')} value={item.license} />
                )}
                <MetaRow
                  label={t('lastUpdated')}
                  value={formatDate(item.last_updated, locale)}
                />
              </CardContent>
            </Card>

            {tags.length > 0 && (
              <Card>
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold mb-3">{t('tags')}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map(tag => (
                      <Badge key={tag} variant="outline" className="text-[11px]">{tag}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </aside>
        </div>
      </main>

      {related.length > 0 && (
        <section className="border-t bg-secondary/10 px-4 py-12">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-xl font-bold mb-6">同类型项目</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {related.map(r => (
                <Link
                  key={r.id}
                  href={`/library/${r.slug}`}
                  className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-sm truncate mb-1">{r.name}</h3>
                  <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                    {r.summary || r.description}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Star className="h-3 w-3" />{formatStars(r.stars_count)}
                    </span>
                    {r.language && <span>{r.language}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  )
}
