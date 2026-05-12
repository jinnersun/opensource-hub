'use client'

import { useEffect, useState, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/routing'
import {
  ArrowLeft,
  Star,
  ExternalLink,
  Github,
  Globe,
  Loader2,
} from 'lucide-react'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ErrorState } from '@/components/error-state'
import {
  getLibraryItem,
  getLibrary,
  parseLibraryTags,
  type LibraryItem,
} from '@/lib/api'

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function formatDate(iso: string | null, locale: string): string {
  if (!iso) return '-'
  try {
    const d = new Date(iso)
    return d.toLocaleDateString(locale === 'zh' ? 'zh-CN' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

export default function LibraryDetailPage() {
  const t = useTranslations('library')
  const te = useTranslations('errors')
  const intlLocale = useLocale()
  const params = useParams<{ slug: string; locale?: string }>()
  const slug = params?.slug
  // 和列表页保持一致：优先用 URL 段 locale，回back provider locale
  const locale = (params?.locale as string) || intlLocale

  const [item, setItem] = useState<LibraryItem | null>(null)
  const [related, setRelated] = useState<LibraryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    if (!slug) return
    setLoading(true)
    setError(false)
    try {
      const data = await getLibraryItem(slug, locale)
      setItem(data)
      // fetch related items by same project_type
      if (data?.project_type) {
        const rel = await getLibrary({
          projectType: data.project_type,
          limit: 6,
          sort: 'stars',
          locale,
        })
        setRelated((rel.data || []).filter((r: LibraryItem) => r.slug !== data.slug).slice(0, 4))
      }
    } catch (e) {
      console.error('getLibraryItem failed:', e)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [slug, locale])

  useEffect(() => {
    load()
  }, [load])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-5xl mx-auto px-4 py-12">
          <ErrorState
            title={te('title')}
            description={te('description')}
            onRetry={load}
          />
        </main>
        <Footer />
      </div>
    )
  }

  const tags = parseLibraryTags(item.tags)

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-5xl mx-auto px-4 py-8">
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
          <p className="text-sm text-muted-foreground mb-4 break-all">
            {item.full_name}
          </p>

          {item.summary && (
            <p className="text-lg text-foreground/90 mb-4">{item.summary}</p>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Button asChild>
              <a
                href={item.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <Github className="h-4 w-4" />
                {t('visitRepo')}
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            {item.homepage && (
              <Button variant="outline" asChild>
                <a
                  href={item.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5"
                >
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
                  <h2 className="text-lg font-semibold mb-3">
                    {t('overview')}
                  </h2>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">
                    {item.full_description}
                  </p>
                </CardContent>
              </Card>
            )}

            {item.readme_preview && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-lg font-semibold mb-3">
                    {t('readmePreview')}
                  </h2>
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
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-[11px]"
                      >
                        {tag}
                      </Badge>
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

function MetaRow({
  label,
  value,
}: {
  label: string
  value: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  )
}
