'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { Link } from '@/i18n/routing'
import {
  Library as LibraryIcon,
  Loader2,
  Star,
  ExternalLink,
  Search as SearchIcon,
  ArrowUpDown,
} from 'lucide-react'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'
import { ErrorState } from '@/components/error-state'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getLibrary,
  getLibraryFacets,
  parseLibraryTags,
  type LibraryItem,
  type LibraryFacets,
} from '@/lib/api'

const PROJECT_TYPE_ORDER = [
  'all',
  'framework',
  'library',
  'cli-tool',
  'application',
  'tutorial',
  'awesome-list',
  'dataset-model',
  'other',
] as const

type ProjectTypeTab = (typeof PROJECT_TYPE_ORDER)[number]

const PAGE_SIZE = 24

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

export default function LibraryPage() {
  const t = useTranslations('library')
  const te = useTranslations('errors')
  // 用 URL 上的 [locale] 段作为真实 locale，避免 provider 在 client 导航后仍返回旧值
  const params = useParams<{ locale?: string }>()
  const intlLocale = useLocale()
  const locale = (params?.locale as string) || intlLocale

  const [projectType, setProjectType] = useState<ProjectTypeTab>('all')
  const [sort, setSort] = useState<'stars' | 'updated'>('stars')
  const [keyword, setKeyword] = useState('')
  const [items, setItems] = useState<LibraryItem[]>([])
  const [facets, setFacets] = useState<LibraryFacets | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const [error, setError] = useState(false)

  const loadList = useCallback(
    async (reset = true) => {
      if (reset) {
        setLoading(true)
        setError(false)
      } else {
        setLoadingMore(true)
      }
      try {
        const offset = reset ? 0 : items.length
        const resp = await getLibrary({
          projectType: projectType === 'all' ? undefined : projectType,
          limit: PAGE_SIZE,
          offset,
          sort,
          locale,
        })
        const next = resp.data || []
        setItems(prev => (reset ? next : [...prev, ...next]))
        setHasMore(!!resp.pagination?.hasMore)
      } catch (e) {
        console.error('getLibrary failed:', e)
        if (reset) setError(true)
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectType, sort, locale],
  )

  const loadFacets = useCallback(async () => {
    try {
      const f = await getLibraryFacets()
      setFacets(f)
    } catch (e) {
      console.error('getLibraryFacets failed:', e)
    }
  }, [])

  useEffect(() => {
    loadList(true)
  }, [loadList])

  useEffect(() => {
    loadFacets()
  }, [loadFacets])

  const filtered = useMemo(() => {
    if (!keyword.trim()) return items
    const kw = keyword.trim().toLowerCase()
    return items.filter(it => {
      const hay = [
        it.name,
        it.full_name,
        it.description || '',
        it.summary || '',
        it.language || '',
        it.tags || '',
      ]
        .join(' ')
        .toLowerCase()
      return hay.includes(kw)
    })
  }, [items, keyword])

  const typeCountMap = useMemo(() => {
    const map = new Map<string, number>()
    if (facets?.projectTypes) {
      for (const row of facets.projectTypes) {
        map.set(row.project_type, row.count)
      }
    }
    return map
  }, [facets])

  const totalCount = useMemo(() => {
    let total = 0
    typeCountMap.forEach(v => (total += v))
    return total
  }, [typeCountMap])

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-12">
          <ErrorState
            title={te('title')}
            description={te('description')}
            onRetry={() => loadList(true)}
          />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <LibraryIcon className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl">
            {t('subtitle')}
          </p>
        </div>

        {/* Toolbar: type tabs + sort + search */}
        <div className="mb-8 space-y-4">
          <div className="flex flex-wrap gap-2">
            {PROJECT_TYPE_ORDER.map(pt => {
              const active = projectType === pt
              const count =
                pt === 'all' ? totalCount : typeCountMap.get(pt) ?? 0
              return (
                <button
                  key={pt}
                  onClick={() => setProjectType(pt)}
                  className={
                    'rounded-full px-4 py-1.5 text-sm font-medium transition-all border ' +
                    (active
                      ? 'bg-foreground text-background border-foreground'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted')
                  }
                >
                  {t(`type.${pt}`)}
                  {count > 0 && (
                    <span className="ml-1.5 text-xs opacity-70">
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
            <div className="relative flex-1 max-w-md">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('searchPlaceholder')}
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              <Select
                value={sort}
                onValueChange={v => setSort(v as 'stars' | 'updated')}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stars">{t('sort.stars')}</SelectItem>
                  <SelectItem value="updated">{t('sort.updated')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
            {t('empty')}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filtered.map(it => (
                <LibraryCard key={it.id} item={it} t={t} />
              ))}
            </div>

            {hasMore && !keyword.trim() && (
              <div className="mt-10 flex justify-center">
                <Button
                  variant="outline"
                  disabled={loadingMore}
                  onClick={() => loadList(false)}
                >
                  {loadingMore && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

function LibraryCard({
  item,
  t,
}: {
  item: LibraryItem
  t: ReturnType<typeof useTranslations>
}) {
  const tags = parseLibraryTags(item.tags).slice(0, 3)
  const title = item.summary || item.description || item.name
  const detail = item.full_description || item.description || ''

  return (
    <Card className="h-full hover:shadow-md transition-shadow flex flex-col">
      <CardContent className="p-5 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate">{item.name}</h3>
            <p className="text-xs text-muted-foreground truncate">
              {item.full_name}
            </p>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {t(`type.${item.project_type}`)}
          </Badge>
        </div>

        {/* Summary */}
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {title}
        </p>

        {/* Detail (full_description) */}
        {detail && detail !== title && (
          <p className="text-xs text-muted-foreground/80 line-clamp-3 mb-3">
            {detail}
          </p>
        )}

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.map(tag => (
              <Badge key={tag} variant="outline" className="text-[11px] px-1.5 py-0">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Footer meta */}
        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              {formatStars(item.stars_count)}
            </span>
            {item.language && <span>{item.language}</span>}
          </div>
          <Link
            href={`/library/${item.slug}`}
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            {t('viewDetail')}
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}
