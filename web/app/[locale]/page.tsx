import { getTranslations } from 'next-intl/server'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { SearchBox } from "@/components/search-box"
import { CategoryTags } from "@/components/category-tags"
import { ProjectCard } from "@/components/project-card"
import { CategoryCard } from "@/components/category-card"
import { ErrorState } from "@/components/error-state"
import { transformAppForDisplay, transformCategoryForDisplay, type Project, type Category } from "@/lib/api"
import { Link } from '@/i18n/routing'
import { Flame, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { HomeCTA } from "./_components/home-cta"

type Props = { params: Promise<{ locale: string }> }

async function getServerData(locale: string) {
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (!api) return null

    const res = await api.fetch(new Request(`http://internal/api/home?lang=${locale}`))
    const data = await res.json() as any

    if (!data) return null

    return {
      categories: (data.categories || []).map(transformCategoryForDisplay),
      trending: (data.trending || []).map(transformAppForDisplay),
      newArrivals: (data.newArrivals || []).map(transformAppForDisplay),
      featured: (data.featured || []).map(transformAppForDisplay),
    }
  } catch (e) {
    console.error('[SSR homepage]', e)
    return null
  }
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'home' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  const data = await getServerData(locale)

  if (!data) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex-1">
          <ErrorState title={te('title')} description={te('description')} />
        </main>
        <Footer />
      </div>
    )
  }

  const { categories, trending, newArrivals, featured } = data

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
                <p className="mt-1 text-muted-foreground">{t('categoriesSubtitle')}</p>
              </div>
              <Link href="/category">
                <Button variant="ghost" className="gap-2">
                  {t('viewAll')}
                  <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map((category: any) => (
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
                  <p className="mt-1 text-muted-foreground">{t('trendingSubtitle')}</p>
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
              {trending.map((project: any) => (
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
                  <p className="mt-1 text-muted-foreground">{t('newArrivalsSubtitle')}</p>
                </div>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {newArrivals.map((project: any) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Featured Projects */}
        <section id="featured" className="border-t bg-secondary/10 px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold sm:text-3xl">{t('featuredTitle')}</h2>
              <p className="mt-1 text-muted-foreground">{t('featuredSubtitle')}</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {featured.map((project: any) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section (Client Component for dialog state) */}
        <HomeCTA />
      </main>

      <Footer />
    </div>
  )
}
