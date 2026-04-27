"use client"

import { CheckCircle2, Info, AlertTriangle, Trash2, Leaf, ExternalLink } from "lucide-react"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Project } from "@/lib/data"

interface EnvironmentGuideProps {
  project: Project
}

export function EnvironmentGuide({ project }: EnvironmentGuideProps) {
  const t = useTranslations('project')
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Info className="size-5 text-blue-500" />
          {t('envGuide')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Portable / Green Edition Badge */}
        {project.isPortable && (
          <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 p-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20 shrink-0">
              <Leaf className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {t('portable')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('portableDesc')}
              </p>
            </div>
          </div>
        )}

        {/* Uninstall Info */}
        <div className="flex items-start gap-3 rounded-lg bg-emerald-500/10 p-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20 shrink-0">
            <Trash2 className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {t('uninstallInfo')}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {project.uninstallNote}
            </p>
          </div>
        </div>

        {/* Dependencies */}
        {project.dependsOn ? (
          <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 p-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-amber-500/20 shrink-0">
              <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                {t('dependencies')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {project.dependsOn}
              </p>
              {/* Dependency download link */}
              {project.dependencies && project.dependencies.length > 0 && project.dependencies.some(d => d.url) && (
                <div className="mt-2 space-y-1">
                  {project.dependencies!.filter(d => d.url).map((dep, i) => (
                    <a
                      key={i}
                      href={dep.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
                    >
                      {dep.name} {t('depDownload')}
                      <ExternalLink className="size-3" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 rounded-lg bg-blue-500/10 p-3">
            <div className="flex size-8 items-center justify-center rounded-full bg-blue-500/20 shrink-0">
              <CheckCircle2 className="size-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
                {t('noDeps')}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('noDepsDesc')}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
