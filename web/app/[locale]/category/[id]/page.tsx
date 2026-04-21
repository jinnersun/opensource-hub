'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { useParams } from 'next/navigation'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ProjectCard } from '@/components/project-card'
import { CategoryCard } from '@/components/category-card'
import { ErrorState } from '@/components/error-state'
import { getApps, getCategories, transformAppForDisplay, transformCategoryForDisplay } from '@/lib/api'
import type { Project, Category } from '@/lib/api'
import { Link } from '@/i18n/routing'
import { ArrowLeft, Package, Loader2 } from 'lucide-react'

const categoryEmojis: Record<string, string> = {
  'ai': '✨',
  'video': '🎬',
  'office': '📋',
  'privacy': '🔒',
  'system': '⚙️',
  'design': '🎨',
}

export default function CategoryDetailPage() {
  const t = useTranslations('category')
  const te = useTranslations('errors')
  const td = useTranslations('data')
  const params = useParams()
  const categoryId = params.id as string
  
  const [categoryProjects, setCategoryProjects] = useState<Project[]>([])
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [appsResult, cats] = await Promise.all([
        getApps({ category: categoryId }),
        getCategories(),
      ])
      setCategoryProjects((appsResult.data || []).map(transformAppForDisplay))
      const displayCats = cats.map(transformCategoryForDisplay)
      setAllCategories(displayCats)
      const found = displayCats.find(c => c.id === categoryId)
      setCurrentCategory(found || null)
    } catch (err) {
      console.error('API request failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [categoryId])

  useEffect(() => {
    loadData()
  }, [loadData])

  const label = currentCategory?.label || td(`categories.${categoryId}.label`)
  const description = currentCategory?.description || td(`categories.${categoryId}.description`)
  const emoji = categoryEmojis[categoryId] || '📦'
  const otherCategories = allCategories.filter(c => c.id !== categoryId).slice(0, 3)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-12">
          <ErrorState title={te('title')} description={te('description')} onRetry={loadData} />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/category" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
            {t('browseAll')}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{label}</span>
        </div>

        {/* Two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left sidebar: Category info */}
          <aside className="w-full lg:w-72 shrink-0">
            <div className="rounded-2xl border bg-card p-6 sticky top-20">
              <div className="text-4xl mb-3">{emoji}</div>
              <h1 className="text-2xl font-bold mb-2">{label}</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                {description}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="size-4" />
                <span>{t('all', { label, count: categoryProjects.length })}</span>
              </div>
            </div>

            {/* Other categories */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">{t('otherCategories')}</h3>
              <div className="space-y-2">
                {otherCategories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/category/${cat.id}`}
                    className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted"
                  >
                    <span className="text-lg">{categoryEmojis[cat.id] || '📦'}</span>
                    <span className="font-medium">{td(`categories.${cat.id}.label`)}</span>
                  </Link>
                ))}
              </div>
            </div>
          </aside>

          {/* Right: Projects */}
          <div className="flex-1 min-w-0">
            {categoryProjects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {categoryProjects.map((project) => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20">
                <span className="text-5xl mb-4">🔍</span>
                <p className="text-lg text-muted-foreground">
                  {t('empty', { label })}
                </p>
                <Link href="/category" className="mt-4 text-sm text-foreground underline underline-offset-4 hover:text-foreground/80">
                  {t('browseAll')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
