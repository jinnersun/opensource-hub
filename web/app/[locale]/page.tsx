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

const COMMON_TAG_EMOJIS: Record<string, { emoji: string; zh: string; en: string }> = {
  'screen-recording': { emoji: '🎬', zh: '我想录屏', en: 'Screen Recorder' },
  'video-editing':   { emoji: '✂️', zh: '我想剪辑视频', en: 'Video Editor' },
  'pdf-editor':      { emoji: '📄', zh: '我想编辑PDF', en: 'PDF Editor' },
  'music-download':  { emoji: '🎵', zh: '我想下载音乐', en: 'Music Downloader' },
  'privacy':         { emoji: '🔒', zh: '我想保护隐私', en: 'Privacy Tools' },
  'system-cleaner':  { emoji: '💻', zh: '我想清理系统', en: 'System Cleaner' },
  'video-download':  { emoji: '🌐', zh: '我想下载视频', en: 'Video Downloader' },
  'design':          { emoji: '🎨', zh: '我想做设计', en: 'Design Tools' },
  'photo-editing':   { emoji: '🖼️', zh: '我想编辑照片', en: 'Photo Editor' },
  'note-taking':     { emoji: '📝', zh: '我想记笔记', en: 'Note Taking' },
}

async function getServerData(locale: string) {
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (!api) return null

    const res = await api.fetch(new Request(`http://internal/api/home?lang=${locale}`))
    const data = await res.json() as any

    if (!data) return null

    // 热门标签卡片：使用预定义的 emoji 映射表，不调用 /api/tags（避免 minApps 大量 COUNT 查询）
    const quickActions = Object.entries(COMMON_TAG_EMOJIS)
      .slice(0, 8)
      .map(([tag, info]) => ({ tag, ...info }))

    return {
      categories: (data.categories || []).map(transformCategoryForDisplay),
      trending: (data.trending || []).map(transformAppForDisplay),
      newArrivals: (data.newArrivals || []).map(transformAppForDisplay),
      featured: (data.featured || []).map(transformAppForDisplay),
      quickActions,
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

  const { categories, trending, newArrivals, featured, quickActions } = data

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

        {/* Quick Actions — 普通人入口 */}
        {quickActions.length > 0 && (
          <section className="mx-auto max-w-5xl px-4 py-10">
            <h2 className="mb-6 text-center text-2xl font-bold">
              {locale === 'zh' ? '不知道需要什么软件？' : "Don't know what you need?"}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {quickActions.map(item => (
                <Link key={item.tag} href={`/tag/${item.tag}`}
                  className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-all hover:border-foreground/30 hover:shadow-md">
                  <span className="text-2xl">{item.emoji}</span>
                  <span className="text-sm font-medium">
                    {locale === 'zh' ? item.zh : item.en}
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

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
