"use client"

import { FileText, ExternalLink, BookOpen, Globe, Calendar } from "lucide-react"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Project } from "@/lib/data"

interface MetaInfoCardProps {
  project: Project
}

export function MetaInfoCard({ project }: MetaInfoCardProps) {
  const t = useTranslations('project')
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-5 text-muted-foreground" />
          {t('projectInfo')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* License */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('license')}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
            {project.license || "MIT"}
          </span>
        </div>

        {/* Last Updated */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t('lastUpdated')}</span>
          <span className="text-sm">{project.lastUpdated}</span>
        </div>

        {/* Source Code */}
        <a
          href={project.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="size-3.5" />
            {t('githubRepo')}
          </span>
        </a>

        {/* Documentation */}
        {project.docsUrl && (
          <a
            href={project.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <BookOpen className="size-3.5" />
              {t('officialDocs')}
            </span>
          </a>
        )}

        {/* Homepage */}
        {project.homepage && (
          <a
            href={project.homepage}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted"
          >
            <span className="flex items-center gap-2">
              <Globe className="size-3.5" />
              {t('officialSite')}
            </span>
          </a>
        )}
      </CardContent>
    </Card>
  )
}
