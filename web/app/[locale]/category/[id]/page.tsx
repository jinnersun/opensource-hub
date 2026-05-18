import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ProjectCard } from '@/components/project-card'
import { Link } from '@/i18n/routing'
import { transformAppForDisplay, transformCategoryForDisplay } from '@/lib/api'
import type { Project } from '@/lib/api'
import { ArrowLeft, Package, Loader2, type LucideIcon, Sparkles, Video, Shield, Palette, FileText, Settings, Monitor, Code, Folder, Lock } from 'lucide-react'
import { CategorySidebar } from './_components/category-sidebar'
import { LoadMore } from './_components/load-more'

const PAGE_SIZE = 24

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'data' })
  const label = t(`categories.${id}.label`)
  return {
    title: `${label} - OpenSource-Hub`,
    description: t(`categories.${id}.description`),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/category/${id}`,
      languages: { zh: `/zh/category/${id}`, en: `/en/category/${id}`, ja: `/ja/category/${id}`, ko: `/ko/category/${id}`, 'x-default': `/en/category/${id}` },
    },
  }
}

async function getServerData(locale: string, categoryId: string) {
  try {
    const cloudflareContext = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const apiBinding = cloudflareContext?.env?.API
    if (!apiBinding) return null

    const [appsRes, catsRes] = await Promise.all([
      apiBinding.fetch(new Request(`http://internal/api/apps?category=${encodeURIComponent(categoryId)}&limit=${PAGE_SIZE}&lang=${locale}`)),
      apiBinding.fetch(new Request('http://internal/api/categories')),
    ])
    const appsData = await appsRes.json() as any
    const catsData = await catsRes.json() as any

    const projects = (appsData.data || []).map(transformAppForDisplay)
    const categories = (catsData.data || []).map(transformCategoryForDisplay)
    const currentCat = categories.find((c: any) => c.id === categoryId)
    const hasMore = appsData.pagination?.hasMore || false

    return { projects, categories, currentCat, hasMore }
  } catch (e) {
    console.error('[SSR category]', e)
    return null
  }
}

export default async function CategoryDetailPage({ params }: Props) {
  const { locale, id: categoryId } = await params
  const t = await getTranslations({ locale, namespace: 'category' })
  const td = await getTranslations({ locale, namespace: 'data' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  const data = await getServerData(locale, categoryId)

  if (!data) {
    return (
      <div className="min-h-screen bg-background"><Header /><main className="mx-auto max-w-7xl px-4 py-12"><p className="text-center text-muted-foreground">{te('description')}</p></main><Footer /></div>
    )
  }

  const { projects, categories, currentCat, hasMore } = data
  const label = td(`categories.${categoryId}.label`) || currentCat?.label || categoryId
  const description = td(`categories.${categoryId}.description`) || currentCat?.description || ''

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/category" className="flex items-center gap-1 hover:text-foreground transition-colors"><ArrowLeft className="size-4" />{t('browseAll')}</Link>
          <span>/</span><span className="text-foreground font-medium">{label}</span>
        </div>
        <div className="flex flex-col lg:flex-row gap-8">
          <CategorySidebar currentCat={currentCat as any} categories={categories as any} categoryId={categoryId} label={label} description={description} projectCount={projects.length} currentIcon={null} td={td} t={t} />
          <div className="flex-1 min-w-0">
            {projects.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project: Project) => (<ProjectCard key={project.id} project={project} />))}
                </div>
                <Suspense fallback={<div className="py-8 text-center"><Loader2 className="size-6 animate-spin inline" /></div>}>
                  <LoadMore categoryId={categoryId} locale={locale} hasMore={hasMore} />
                </Suspense>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20">
                <span className="text-5xl mb-4">🔍</span>
                <p className="text-lg text-muted-foreground">{t('empty', { label })}</p>
                <Link href="/category" className="mt-4 text-sm text-foreground underline underline-offset-4 hover:text-foreground/80">{t('browseAll')}</Link>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}
