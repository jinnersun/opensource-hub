'use client'

import { useState, useEffect } from "react"
import { useTranslations } from 'next-intl'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SearchBox } from "@/components/search-box"
import { CategoryTags } from "@/components/category-tags"
import { ProjectCard } from "@/components/project-card"
import { SecurityDashboard } from "@/components/security-dashboard"
import { CategoryCard } from "@/components/category-card"
import { SubmitRequestDialog } from "@/components/submit-request-dialog"
import { getHomeData, transformAppForDisplay, transformCategoryForDisplay } from "@/lib/api"
import { categories as fallbackCategories, projects as fallbackProjects, getTrendingByPeriod, type Project, type Category } from "@/lib/data"
import { Link } from '@/i18n/routing'
import { Flame, ArrowRight, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HomePage() {
  const t = useTranslations('home')
  const [requestDialogOpen, setRequestDialogOpen] = useState(false)
  const [allCategories, setAllCategories] = useState<Category[]>([])
  const [trendingProjects, setTrendingProjects] = useState<Project[]>([])
  const [featuredProjects, setFeaturedProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'fallback'>('fallback')

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getHomeData()
        // 分类
        setAllCategories(data.categories.map(transformCategoryForDisplay))
        // 热门
        setTrendingProjects(data.trending.map(transformAppForDisplay))
        // 推荐
        setFeaturedProjects(data.featured.map(transformAppForDisplay))
        setDataSource('api')
      } catch (err) {
        console.warn('API unavailable, using fallback data', err)
        // Fallback 到 mock 数据
        setAllCategories(fallbackCategories)
        setTrendingProjects(getTrendingByPeriod("week").slice(0, 4))
        setFeaturedProjects(fallbackProjects)
        setDataSource('fallback')
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
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

      {/* 数据源标识 - 上线前删除 */}
      <div className={`fixed bottom-2 right-2 z-50 rounded-full px-3 py-1 text-xs font-mono shadow-lg ${dataSource === 'api' ? 'bg-emerald-500/90 text-white' : 'bg-amber-500/90 text-white'}`}>
        {dataSource === 'api' ? '🟢 D1 数据库' : '🟡 Mock 数据'}
      </div>
    </div>
  )
}
