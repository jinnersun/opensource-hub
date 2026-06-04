import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Breadcrumb } from "@/components/breadcrumb"
import { ProjectIcon } from "@/components/project-icon"
import { OSDownload } from "@/components/project-detail/os-download"
import { SafeAuditCard } from "@/components/project-detail/safe-audit-card"
import { EnvironmentGuide } from "@/components/project-detail/environment-guide"
import { MetaInfoCard } from "@/components/project-detail/meta-info-card"
import { GettingStartedCard } from "@/components/project-detail/getting-started-card"
import { DeepDiveTabs } from "@/components/project-detail/deep-dive-tabs"
import { FAQQuickLink } from "@/components/project-detail/faq-quick-link"
import type { FAQItem } from "@/components/project-detail/faq-section"
import { buildFAQJsonLd } from "@/lib/faq-jsonld"
import { ErrorState } from "@/components/error-state"
import { FavoriteButton } from "@/components/favorite-button"
import { transformAppForDisplay } from "@/lib/api"
import type { Project } from "@/lib/api"
import { Star, ShieldCheck, CheckCircle2, Sparkles, Lightbulb, AlertTriangle, Target, Tag } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Link } from '@/i18n/routing'

type Props = { params: Promise<{ locale: string; id: string }> }

function formatStars(stars: number): string {
  if (stars >= 1000) return `${(stars / 1000).toFixed(1)}k`
  return stars.toString()
}

async function getServerData(locale: string, projectId: string) {
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (!api) return null

    // 1. Get the main project
    const appRes = await api.fetch(new Request(`http://internal/api/apps/${encodeURIComponent(projectId)}?lang=${locale}`))
    const appData = await appRes.json() as any
    if (!appData?.name) return null

    const project = transformAppForDisplay(appData)

    // 2. Get similar projects + FAQ in parallel (no dependency between them)
    const [similarProjects, faqs] = await Promise.all([
      (async () => {
        try {
          const similarRes = await api.fetch(new Request(`http://internal/api/apps?category=${encodeURIComponent(project.category)}&limit=10&lang=${locale}`))
          const similarData = await similarRes.json() as any
          const currentTags = new Set(project.tags || [])
          return (similarData.data || [])
            .map(transformAppForDisplay)
            .filter((sp: Project) => sp.id !== project.id)
            .map((sp: Project) => {
              const spTags = new Set(sp.tags || [])
              const overlap = [...currentTags].filter(t => spTags.has(t)).length
              return { project: sp, overlap }
            })
            .sort((a: { project: Project; overlap: number }, b: { project: Project; overlap: number }) => b.overlap - a.overlap || b.project.stars - a.project.stars)
            .slice(0, 3)
            .map((s: { project: Project; overlap: number }) => s.project)
        } catch { return [] as Project[] }
      })(),
      (async () => {
        try {
          const faqRes = await api.fetch(new Request(
            `http://internal/api/apps/${encodeURIComponent(project.id)}/faqs?lang=${locale}`
          ))
          const faqData = await faqRes.json() as any
          return (faqData?.faqs || null) as FAQItem[] | null
        } catch { return null }
      })(),
    ])

    return { project, similarProjects, faqs }
  } catch (e) {
    console.error('[SSR project]', e)
    return null
  }
}

export default async function ProjectPage({ params }: Props) {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'project' })
  const td = await getTranslations({ locale, namespace: 'data' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  const data = await getServerData(locale, id)

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-12">
          <ErrorState title={te('title')} description={te('description')} />
        </main>
        <Footer />
      </div>
    )
  }

  const { project, similarProjects, faqs } = data
  const categoryLabel = td(`categories.${project.category}.label`)

  const jsonLd: any = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'SoftwareApplication',
        name: project.name,
        description: project.summary || project.description,
        applicationCategory: categoryLabel,
        operatingSystem: Object.keys(project.platforms).map(p => p === 'mac' ? 'macOS' : p === 'windows' ? 'Windows' : 'Linux').join(', '),
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        author: { '@type': 'Organization', name: project.sourceUrl?.split('/')[3] || '' },
        dateModified: project.lastUpdated,
        license: project.license || '',
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `https://www.opensource-hub.com/${locale}` },
          { '@type': 'ListItem', position: 2, name: categoryLabel, item: `https://www.opensource-hub.com/${locale}/category/${project.category}` },
          { '@type': 'ListItem', position: 3, name: project.name },
        ],
      },
    ],
  }

  if (faqs && faqs.length > 0) {
    jsonLd['@graph'].push(buildFAQJsonLd(faqs))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* JSON-LD 结构化数据 */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: categoryLabel, href: `/category/${project.category}` },
            { label: project.name },
          ]}
          className="mb-6"
        />

        {/* Hero Section */}
        <section className="mb-10">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-4">
              <ProjectIcon name={project.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold sm:text-3xl">{project.humanTitle}</h1>
                  <FavoriteButton projectId={project.id} />
                  {project.verified && (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                      <CheckCircle2 className="mr-1 size-3" />
                      SHA-256
                    </Badge>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    {formatStars(project.stars)} stars
                  </span>
                  <span>·</span>
                  <Badge variant="outline" className="text-xs">{categoryLabel}</Badge>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    {t('sha256Available')}
                  </span>
                </div>
                <p className="text-muted-foreground max-w-2xl">{project.description}</p>
              </div>
            </div>

            {/* Quick Download */}
            <div className="lg:w-80">
              <OSDownload project={project} />
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          <div className="space-y-8">
            {/* AI Summary */}
            {project.summary && (
              <section>
                <div className="rounded-xl border bg-violet-500/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <Lightbulb className="size-4 text-violet-500" />
                    </div>
                    <div role="note">
                      <p className="text-sm text-foreground leading-relaxed">{project.summary}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Features */}
            {project.features.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <Sparkles className="size-5 text-violet-500" />
                  {t('coreFeatures')}
                </h2>
                <ul className="grid gap-3 sm:grid-cols-2 list-none p-0">
                  {project.features.map((feature, index) => (
                    <li key={index}>
                      <Card className="border-border/50 h-full">
                        <CardContent className="flex items-start gap-3 p-4">
                          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                            <CheckCircle2 className="size-3.5 text-violet-500" />
                          </div>
                          <span className="text-sm">{feature}</span>
                        </CardContent>
                      </Card>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Caveats */}
            {project.caveats.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <AlertTriangle className="size-5 text-amber-500" />
                  {t('caveats')}
                </h2>
                <ul className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2 list-none">
                  {project.caveats.map((caveat, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500 shrink-0">•</span>
                      <span className="text-muted-foreground">{caveat}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Use Cases */}
            {project.useCases.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <Target className="size-5 text-emerald-500" />
                  {t('useCases')}
                </h2>
                <ul className="flex flex-wrap gap-2 list-none p-0">
                  {project.useCases.map((useCase, index) => (
                    <li key={index}>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">
                        {useCase}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Long Description + FAQ */}
            <DeepDiveTabs
              longDescription={project.longDescription}
              faqs={faqs}
              detailLabel={t('longDescription')}
              faqLabel={t('faqTitle')}
              sourceIssueLabel={t('sourceIssue')}
              searchIntentLabels={{
                'how-to': t('searchIntent.how-to'),
                'troubleshooting': t('searchIntent.troubleshooting'),
                'comparison': t('searchIntent.comparison'),
                'configuration': t('searchIntent.configuration'),
              }}
            />

            {/* Tags */}
            {project.tags && project.tags.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <Tag className="size-5 text-muted-foreground" />
                  {t('tags')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">{tag}</Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Getting Started */}
            <GettingStartedCard project={project} />
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <SafeAuditCard project={project} />
            <EnvironmentGuide project={project} />
            <MetaInfoCard project={project} />

            {/* FAQ Quick Link */}
            <FAQQuickLink faqCount={faqs?.length || 0} label={t('faqQuickLink')} />

            {/* Similar Projects */}
            {similarProjects.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">{t('similarProjects')}</h3>
                <div className="space-y-3">
                  {similarProjects.map((p) => (
                    <Link
                      key={p.id}
                      href={`/project/${p.id}`}
                      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                    >
                      <ProjectIcon name={p.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{p.description}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
