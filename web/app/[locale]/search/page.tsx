"use client"

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SearchBox } from "@/components/search-box"
import { ProjectCard } from "@/components/project-card"
import { ErrorState } from "@/components/error-state"
import { searchApps, transformAppForDisplay, type Project } from "@/lib/api"
import { Search, Loader2, Frown, Star, ExternalLink, Library } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { parseLibraryTags } from "@/lib/api"
import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'searchPage' })
  const tn = await getTranslations({ locale, namespace: 'nav' })
  return {
    title: `${t('title')} - OpenSource-Hub`,
    description: t('enterKeyword'),
    robots: { index: false, follow: true },
  }
}

function LibrarySearchCard({ item }: { item: any }) {
  const tags = parseLibraryTags(item.tags).slice(0, 3)
  return (
    <Card className="h-full hover:shadow-md transition-shadow flex flex-col border-dashed">
      <CardContent className="p-5 flex flex-col flex-1">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-base truncate">{item.name}</h3>
            <p className="text-xs text-muted-foreground truncate">{item.full_name}</p>
          </div>
          <Badge variant="outline" className="shrink-0 text-[11px] gap-1">
            <Library className="size-3" />
            代码宝库
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
          {item.summary || item.description}
        </p>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {tags.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[11px] px-1.5 py-0">{tag}</Badge>
            ))}
          </div>
        )}
        <div className="mt-auto flex items-center justify-between text-xs text-muted-foreground pt-3 border-t">
          <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5" />{(item.stars_count/1000).toFixed(1)}k</span>
          {item.language && <span>{item.language}</span>}
          <a href={item.html_url} target="_blank" rel="noopener noreferrer"
             className="flex items-center gap-1 hover:text-foreground">
            查看源码<ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  )
}

function SearchResults() {
  const t = useTranslations('searchPage')
  const te = useTranslations('errors')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [projects, setProjects] = useState<Project[]>([])
  const [libProjects, setLibProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const [total, setTotal] = useState(0)

  const doSearch = useCallback(async () => {
    if (!query.trim()) {
      setProjects([])
      setTotal(0)
      return
    }
    setLoading(true)
    setError(false)
    try {
      const result = await searchApps(query, 30, locale)
      const apps: Project[] = []
      const libs: any[] = []
      for (const item of result.data) {
        if ((item as any)._source === 'library') {
          libs.push(item)
        } else {
          apps.push(transformAppForDisplay(item as any))
        }
      }
      setProjects(apps)
      setLibProjects(libs)
      setTotal(result.count)
    } catch (err) {
      console.error('Search failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [query, locale])

  useEffect(() => {
    doSearch()
  }, [doSearch])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search box */}
        <div className="mx-auto max-w-2xl mb-8">
          <h1 className="text-2xl font-bold mb-4 text-center">{t('title')}</h1>
          <SearchBox />
        </div>

        {/* Results area */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="size-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="py-20">
            <ErrorState title={te('title')} description={te('description')} onRetry={doSearch} />
          </div>
        ) : !query.trim() ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Search className="size-12 mb-4 opacity-30" />
            <p className="text-lg">{t('enterKeyword')}</p>
          </div>
        ) : projects.length === 0 && libProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Frown className="size-12 mb-4 opacity-30" />
            <p className="text-lg">{t('noResults')}</p>
            <p className="text-sm mt-1">{t('noResultsHint')}</p>
          </div>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t('resultCount', { count: total, query })}
              </p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
              {libProjects.map((lib) => (
                <LibrarySearchCard key={`lib_${lib.id}`} item={lib} />
              ))}
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SearchResults />
    </Suspense>
  )
}
