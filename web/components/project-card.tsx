"use client"

import * as React from "react"
import { Link } from '@/i18n/routing'
import { Star, ShieldCheck, CheckCircle2, Info } from "lucide-react"
import { useTranslations } from 'next-intl'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ProjectIcon } from "@/components/project-icon"
import { AppModal } from "@/components/app-modal"
import type { Project } from "@/lib/data"

function formatStars(stars: number): string {
  if (stars >= 1000) {
    return `${(stars / 1000).toFixed(1)}k`
  }
  return stars.toString()
}

interface ProjectCardProps {
  project: Project
}

export function ProjectCard({ project }: ProjectCardProps) {
  const [modalOpen, setModalOpen] = React.useState(false)
  const t = useTranslations('common')
  const tp = useTranslations('project')
  const td = useTranslations('data')
  const categoryLabel = td(`categories.${project.category}.label`)

  return (
    <>
      <Card className="group relative flex flex-col overflow-hidden border-border/50 bg-card transition-all hover:border-border hover:shadow-md">
        <Link href={`/project/${project.id}`} className="flex flex-1 flex-col">
          <CardContent className="flex flex-1 flex-col gap-3.5 p-5">
            {/* Top row: icon + category pill */}
            <div className="flex items-start justify-between">
              <ProjectIcon name={project.name} size="md" />
              <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                {categoryLabel}
              </span>
            </div>

            {/* Title & description */}
            <div className="flex flex-col gap-1">
              <h3 className="font-semibold leading-snug text-foreground transition-colors group-hover:text-primary">
                {project.humanTitle}
              </h3>
              <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                {project.description}
              </p>
            </div>

            {/* Day-2 info */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                <span className="truncate">{project.uninstallNote}</span>
              </div>
              {project.dependsOn && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Info className="size-3.5 shrink-0" />
                  <span className="truncate">{tp('dependsOn', { dep: project.dependsOn })}</span>
                </div>
              )}
            </div>

            {/* Bottom row: stars + verified + CTA */}
            <div className="mt-auto flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Star className="size-4 fill-amber-400 text-amber-400" />
                  {formatStars(project.stars)}
                </span>
                {project.verified && (
                  <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <ShieldCheck className="size-3" />
                    {t('verified')}
                  </span>
                )}
              </div>

            </div>
          </CardContent>
        </Link>

        {/* Get Button - Outside Link to prevent navigation */}
        <div className="absolute bottom-5 right-5">
          <Button
            size="sm"
            className="shrink-0"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setModalOpen(true)
            }}
          >
            {t('get')}
          </Button>
        </div>
      </Card>

      <AppModal
        project={project}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </>
  )
}
