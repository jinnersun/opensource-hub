"use client"

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useParams } from 'next/navigation'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Breadcrumb } from "@/components/breadcrumb"
import { ProjectIcon } from "@/components/project-icon"
import { OSDownload } from "@/components/project-detail/os-download"
import { SafeAuditCard } from "@/components/project-detail/safe-audit-card"
import { EnvironmentGuide } from "@/components/project-detail/environment-guide"
import { MetaInfoCard } from "@/components/project-detail/meta-info-card"
import { GettingStartedCard } from "@/components/project-detail/getting-started-card"
import { ErrorState } from "@/components/error-state"
import { getApp, getApps, transformAppForDisplay } from "@/lib/api"
import type { Project } from "@/lib/api"
import { Star, ShieldCheck, CheckCircle2, Sparkles, Lightbulb, AlertTriangle, Target, Tag, FileEdit, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Link } from '@/i18n/routing'

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`
  }
  return stars.toString()
}

export default function ProjectPage() {
  const t = useTranslations('project')
  const td = useTranslations('data')
  const te = useTranslations('errors')
  const params = useParams()
  const id = params.id as string
  const locale = useLocale()

  const [project, setProject] = useState<Project | null>(null)
  const [similarProjects, setSimilarProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const app = await getApp(id, locale)
      const p = transformAppForDisplay(app)
      setProject(p)

      // Get similar projects (category + tags overlap ranking)
      try {
        const appsResult = await getApps({ category: p.category, limit: 10, locale })
        const currentTags = new Set(p.tags || [])
        const scored = (appsResult.data || [])
          .map(transformAppForDisplay)
          .filter((sp: Project) => sp.id !== p.id)
          .map(sp => {
            const spTags = new Set(sp.tags || [])
            const overlap = [...currentTags].filter(t => spTags.has(t)).length
            return { project: sp, overlap }
          })
          .sort((a, b) => b.overlap - a.overlap || b.project.stars - a.project.stars)
          .slice(0, 3)
          .map(s => s.project)
        setSimilarProjects(scored)
      } catch {
        // similarProjects 失败不阻断
      }
    } catch (err) {
      console.error('API request failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [id, locale])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb skeleton */}
          <div className="mb-6 flex items-center gap-2">
            <Skeleton className="h-4 w-24" />
            <span className="text-muted-foreground">/</span>
            <Skeleton className="h-4 w-32" />
          </div>
          {/* Hero skeleton */}
          <section className="mb-10">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex gap-4">
                <Skeleton className="size-16 rounded-xl" />
                <div className="space-y-3">
                  <Skeleton className="h-8 w-64" />
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-96" />
                </div>
              </div>
              <div className="lg:w-80 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-14 w-full rounded-xl" />
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-24 rounded-lg" />
                  <Skeleton className="h-8 w-24 rounded-lg" />
                </div>
              </div>
            </div>
          </section>
          {/* Content skeleton */}
          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="space-y-8">
              <Skeleton className="h-20 w-full rounded-xl" />
              <div className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                  <Skeleton className="h-14 rounded-lg" />
                </div>
              </div>
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-48 w-full rounded-lg" />
              <Skeleton className="h-36 w-full rounded-lg" />
              <Skeleton className="h-48 w-full rounded-lg" />
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  if (error || !project) {
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

  const categoryLabel = td(`categories.${project.category}.label`)

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
                  <Badge variant="outline" className="text-xs">
                    {categoryLabel}
                  </Badge>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    {t('sha256Available')}
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
            {/* AI Summary */}
            {project.summary && (
              <section>
                <div className="rounded-xl border bg-violet-500/5 p-5">
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/10">
                      <Lightbulb className="size-4 text-violet-500" />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-violet-600 dark:text-violet-400 mb-1">{t('summary')}</h2>
                      <p className="text-sm text-foreground leading-relaxed">{project.summary}</p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* AI Summary / Features */}
            {project.features.length > 0 && (
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
            )}

            {/* Caveats / What it can't do */}
            {project.caveats.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <AlertTriangle className="size-5 text-amber-500" />
                  {t('caveats')}
                </h2>
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
                  {project.caveats.map((caveat, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm">
                      <span className="text-amber-500 shrink-0">•</span>
                      <span className="text-muted-foreground">{caveat}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Use Cases */}
            {project.useCases.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <Target className="size-5 text-emerald-500" />
                  {t('useCases')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {project.useCases.map((useCase, index) => (
                    <Badge key={index} variant="secondary" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20">
                      {useCase}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Long Description */}
            <section>
              <h2 className="text-xl font-bold mb-4">{t('longDescription')}</h2>
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p>{project.longDescription}</p>
              </div>
            </section>

            {/* Tags */}
            {project.tags && project.tags.length > 0 && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <Tag className="size-5 text-muted-foreground" />
                  {t('tags')}
                </h2>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </section>
            )}

            {/* Getting Started - 分系统展示 + OSDownload 联动 */}
            <GettingStartedCard project={project} />

            {/* Release Notes */}
            {project.latestReleaseNotes && (
              <section>
                <h2 className="flex items-center gap-2 text-xl font-bold mb-4">
                  <FileEdit className="size-5 text-blue-500" />
                  {t('releaseNotes')}
                </h2>
                <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
                  {project.latestReleaseNotes.split('\n').filter((l: string) => l.trim()).map((line: string, i: number) => (
                    <p key={i} className="mb-1">{line}</p>
                  ))}
                </div>
              </section>
            )}

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
                    <Link
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
