"use client"

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { CategoryCard } from "@/components/category-card"
import { ProjectCard } from "@/components/project-card"
import { ErrorState } from "@/components/error-state"
import { getCategories, getTrending, transformAppForDisplay, transformCategoryForDisplay } from "@/lib/api"
import type { Project, Category } from "@/lib/api"
import { Link } from '@/i18n/routing'
import { LayoutGrid, Flame, Loader2 } from "lucide-react"



export default function CategoryPage() {
  const t = useTranslations('category')
  const te = useTranslations('errors')
  const locale = useLocale()
  const [categories, setCategories] = useState<Category[]>([])
  const [hotProjects, setHotProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [cats, trending] = await Promise.all([
        getCategories(),
        getTrending('week', 3, locale),
      ])
      setCategories(cats.map(transformCategoryForDisplay))
      setHotProjects(trending.map(transformAppForDisplay))
    } catch (err) {
      console.error('API request failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [locale])

  useEffect(() => {
    loadData()
  }, [loadData])

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

      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Page Title */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center justify-center rounded-full bg-muted p-3">
            <LayoutGrid className="size-6 text-foreground" />
          </div>
          <h1 className="mb-3 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {t('browseAll')}
          </h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            {t('browseDesc')}
            <br className="hidden sm:block" />
            {t('browseCta')}
          </p>
        </div>

        {/* Category Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <CategoryCard key={category.id} category={category} />
          ))}
        </div>

        {/* Hot Recommendations */}
        <section className="mt-16 border-t pt-12">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-orange-500/10">
              <Flame className="size-5 text-orange-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{t('hotRecommend')}</h2>
              <p className="text-sm text-muted-foreground">{t('hotDesc')}</p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hotProjects.map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </section>

        {/* Bottom hint */}
        <div className="mt-16 text-center">
          <p className="text-sm text-muted-foreground">
            {t('notFound')}
            <Link href="/" className="ml-1 text-foreground underline underline-offset-4 hover:text-foreground/80">
              {t('backHome')}
            </Link>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
