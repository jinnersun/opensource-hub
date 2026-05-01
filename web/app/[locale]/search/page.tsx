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
import { Search, Loader2, Frown } from "lucide-react"

function SearchResults() {
  const t = useTranslations('searchPage')
  const te = useTranslations('errors')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const query = searchParams.get('q') || ''

  const [projects, setProjects] = useState<Project[]>([])
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
      setProjects(result.data.map(transformAppForDisplay))
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
        ) : projects.length === 0 ? (
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
