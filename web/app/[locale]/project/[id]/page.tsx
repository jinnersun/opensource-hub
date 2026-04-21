import { notFound } from "next/navigation"
import { getTranslations } from 'next-intl/server'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Breadcrumb } from "@/components/breadcrumb"
import { ProjectIcon } from "@/components/project-icon"
import { OSDownload } from "@/components/project-detail/os-download"
import { SafeAuditCard } from "@/components/project-detail/safe-audit-card"
import { EnvironmentGuide } from "@/components/project-detail/environment-guide"
import { MetaInfoCard } from "@/components/project-detail/meta-info-card"
import { getProject, projects } from "@/lib/data"
import { Star, ShieldCheck, CheckCircle2, Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

interface ProjectPageProps {
  params: Promise<{
    locale: string
    id: string
  }>
}

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`
  }
  return stars.toString()
}

export default async function ProjectPage({ params }: ProjectPageProps) {
  const { locale, id } = await params
  const project = getProject(id)
  const t = await getTranslations({ locale, namespace: 'project' })
  const td = await getTranslations({ locale, namespace: 'data' })
  
  if (!project) {
    notFound()
  }

  const categoryLabel = td(`categories.${project.category}.label`)
  
  // Get similar projects (same category, different project)
  const similarProjects = projects
    .filter(p => p.category === project.category && p.id !== project.id)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
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
            {/* Left: Project Info */}
            <div className="flex gap-4">
              <ProjectIcon name={project.name} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h1 className="text-2xl font-bold sm:text-3xl">{project.humanTitle}</h1>
                  {project.verified && (
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                      <ShieldCheck className="mr-1 size-3" />
                      {t('verified')}
                    </Badge>
                  )}
                </div>
                
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Star className="size-4 fill-amber-400 text-amber-400" />
                    {formatStars(project.stars)} stars
                  </span>
                  <span>·</span>
                  <Badge variant="outline" className="text-xs">
                    {categoryLabel}
                  </Badge>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    {t('securityScanPassed')}
                  </span>
                </div>

                <p className="text-muted-foreground max-w-2xl">
                  {project.description}
                </p>
              </div>
            </div>

            {/* Right: Quick Download */}
            <div className="lg:w-80">
              <OSDownload project={project} />
            </div>
          </div>
        </section>

        {/* Main Content */}
        <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
          {/* Left Column */}
          <div className="space-y-8">
            {/* AI Summary / Features */}
            <section>
              <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                <Sparkles className="size-5 text-violet-500" />
                {t('coreFeatures')}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {project.features.map((feature, index) => (
                  <Card key={index} className="border-border/50">
                    <CardContent className="flex items-start gap-3 p-4">
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
                        <CheckCircle2 className="size-3.5 text-violet-500" />
                      </div>
                      <p className="text-sm">{feature}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>

            {/* Long Description */}
            <section>
              <h2 className="text-xl font-bold mb-4">{t('longDescription')}</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p>{project.longDescription}</p>
              </div>
            </section>

            {/* Getting Started */}
            <section>
              <h2 className="text-xl font-bold mb-4">{t('gettingStarted')}</h2>
              <div className="rounded-xl border bg-card">
                <ol className="divide-y">
                  {project.gettingStarted.map((step, index) => (
                    <li key={index} className="flex items-start gap-4 p-4">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
                        {index + 1}
                      </div>
                      <p className="pt-1 text-muted-foreground">{step}</p>
                    </li>
                  ))}
                </ol>
              </div>
            </section>

            {/* Visual Assets Placeholder */}
            <section>
              <h2 className="text-xl font-bold mb-4">{t('screenshots')}</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="aspect-video rounded-xl border-2 border-dashed border-muted flex items-center justify-center text-muted-foreground text-sm">
                  {t('screenshotPlaceholder')}
                </div>
                <div className="aspect-video rounded-xl border-2 border-dashed border-muted flex items-center justify-center text-muted-foreground text-sm">
                  {t('demoPlaceholder')}
                </div>
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <div className="space-y-6">
            <SafeAuditCard project={project} />
            <EnvironmentGuide project={project} />
            <MetaInfoCard project={project} />

            {/* Similar Projects */}
            {similarProjects.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-3">{t('similarProjects')}</h3>
                <div className="space-y-3">
                  {similarProjects.map((p) => (
                    <a
                      key={p.id}
                      href={`/project/${p.id}`}
                      className="flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted"
                    >
                      <ProjectIcon name={p.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{p.name}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {p.description}
                        </p>
                      </div>
                    </a>
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
