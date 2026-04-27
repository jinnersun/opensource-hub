'use client'

import { useState, useEffect, useCallback } from "react"
import { useTranslations } from 'next-intl'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SearchBox } from "@/components/search-box"
import { CategoryTags } from "@/components/category-tags"
import { ProjectCard } from "@/components/project-card"
import { SecurityDashboard } from "@/components/security-dashboard"
import { CategoryCard } from "@/components/category-card"
import { SubmitRequestDialog } from "@/components/submit-request-dialog"
import { ErrorState } from "@/components/error-state"
import { getHomeData, transformAppForDisplay, transformCategoryForDisplay, type Project, type Category } from "@/lib/api"
import { Link } from '@/i18n/routing'
import { Flame, ArrowRight, Sparkles, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomePage() {
  const t = useTranslations('home')
  const te = useTranslations('errors')
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [trendingProjects, setTrendingProjects] = useState<Project[]>([])
  const [newArrivals, setNewArrivals] = useState<Project[]>([])
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await getHomeData()
      setAllCategories(data.categories.map(transformCategoryForDisplay))
      setTrendingProjects(data.trending.map(transformAppForDisplay))
      setNewArrivals(data.newArrivals.map(transformAppForDisplay))
      setFeaturedProjects(data.featured.map(transformAppForDisplay))
    } catch (err) {
      console.error('API request failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          {/* Hero skeleton */}
          <section className="border-b bg-gradient-to-b from-background to-secondary/20 px-4 py-16 sm:py-24">
            <div className="mx-auto max-w-4xl text-center">
              <Skeleton className="mx-auto mb-4 h-6 w-48 rounded-full" />
              <Skeleton className="mx-auto h-12 w-96 mb-4" />
              <Skeleton className="mx-auto h-6 w-80 mb-10" />
              <Skeleton className="mx-auto h-14 w-full max-w-2xl rounded-2xl" />
            </div>
          </section>
          {/* Category skeleton */}
          <section className="border-b bg-secondary/10 px-4 py-12">
            <div className="mx-auto max-w-7xl">
              <Skeleton className="h-8 w-48 mb-2" />
              <Skeleton className="h-5 w-72 mb-8" />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-5 space-y-3">
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                ))}
              </div>
            </div>
          </section>
          {/* Trending skeleton */}
          <section className="px-4 py-12">
            <div className="mx-auto max-w-7xl">
              <Skeleton className="h-8 w-36 mb-2" />
              <Skeleton className="h-5 w-64 mb-8" />
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-5 space-y-3">
                    <Skeleton className="size-10 rounded-lg" />
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            </div>
          </section>
        </main>
        <Footer />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <ErrorState title={te('title')} description={te('description')} onRetry={loadData} />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b bg-gradient-to-b from-background to-secondary/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border bg-secondary/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="inline-block size-1.5 rounded-full bg-emerald-500" />
              {t('heroBadge')}
            </div>
            <h1 className="text-balance text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              {t('heroTitle')}
            </h1>
            <p className="mt-4 text-pretty text-lg text-muted-foreground sm:text-xl">
              {t('heroSubtitle')}
            </p>

            <div className="mt-10 flex justify-center">
              <SearchBox />
            </div>

            <div className="mt-8">
              <CategoryTags />
            </div>
          </div>

          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -left-40 -top-40 size-80 rounded-full bg-gradient-to-br from-blue-500/15 to-cyan-500/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 -right-40 size-80 rounded-full bg-gradient-to-br from-emerald-500/15 to-teal-500/15 blur-3xl" />
        </section>

        {/* Categories Section */}
        <section className="border-b bg-secondary/10 px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold sm:text-3xl">{t('categoriesTitle')}</h2>
                <p className="mt-1 text-muted-foreground">
                  {t('categoriesSubtitle')}
                </p>
              </div>
              <Link href="/category">
                <Button variant="ghost" className="gap-2">
                  {t('viewAll')}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {allCategories.map((category) => (
                <CategoryCard key={category.id} category={category} />
              ))}
            </div>
          </div>
        </section>

        {/* Trending Section */}
        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className="size-6 text-orange-500" />
                <div>
                  <h2 className="text-2xl font-bold sm:text-3xl">{t('trendingTitle')}</h2>
                  <p className="mt-1 text-muted-foreground">
                    {t('trendingSubtitle')}
                  </p>
                </div>
              </div>
              <Link href="/trending">
                <Button variant="ghost" className="gap-2">
                  {t('moreTrending')}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {trendingProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>

        {/* New Arrivals Section */}
        {newArrivals.length > 0 && (
          <section className="border-t bg-secondary/10 px-4 py-12 sm:py-16">
            <div className="mx-auto max-w-7xl">
              <div className="mb-8 flex items-center gap-3">
                <Sparkles className="size-6 text-violet-500" />
                <div>
                  <h2 className="text-2xl font-bold sm:text-3xl">{t('newArrivals')}</h2>
                  <p className="mt-1 text-muted-foreground">
                    {t('newArrivalsSubtitle')}
                  </p>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {newArrivals.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Main: Featured Projects + Security Sidebar */}
        <section id="featured" className="border-t bg-secondary/10 px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="flex gap-8 xl:gap-10">
              {/* Left: grid */}
              <div className="min-w-0 flex-1">
                <div className="mb-8">
                  <h2 className="text-2xl font-bold sm:text-3xl">{t('featuredTitle')}</h2>
                  <p className="mt-1 text-muted-foreground">
                    {t('featuredSubtitle')}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {featuredProjects.map((project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              </div>

              {/* Right: security report sticky sidebar */}
              <div className="hidden w-72 shrink-0 xl:block">
                <div className="sticky top-20 space-y-6">
                  <SecurityDashboard />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Mobile security report */}
        <section className="border-t px-4 py-10 xl:hidden">
          <div className="mx-auto max-w-lg">
            <SecurityDashboard />
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t bg-secondary/30 px-4 py-14 sm:py-18">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{t('ctaTitle')}</h2>
            <p className="mt-3 text-muted-foreground">
              {t('ctaSubtitle')}
            </p>
            <Button
              className="mt-6 rounded-full px-6 py-3 text-sm font-medium"
              onClick={() => setRequestDialogOpen(true)}
            >
              {t('ctaButton')}
            </Button>
          </div>
        </section>
      </main>

      <Footer />

      <SubmitRequestDialog
        open={requestDialogOpen}
        onClose={() => setRequestDialogOpen(false)}
      />
    </div>
  )
}
