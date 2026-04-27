"use client"

import { ShieldCheck, ExternalLink, Copy, Check } from "lucide-react"
import { useState } from "react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { Project } from "@/lib/data"

interface SafeAuditCardProps {
  project: Project
}

export function SafeAuditCard({ project }: SafeAuditCardProps) {
  const [copied, setCopied] = useState(false)
  const t = useTranslations('project')

  const copyChecksum = () => {
    navigator.clipboard.writeText(project.checksum)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-5 text-emerald-500" />
          {t('securityAudit')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Security Status */}
        <div className="flex items-center gap-3 rounded-lg bg-emerald-500/10 p-3">
          <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/20">
            <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {t('securityScanPassed')}
            </p>
            <p className="text-xs text-muted-foreground">
              {project.securityScan === "passed" ? t('passedMultiCheck') : t('scanning')}
            </p>
          </div>
        </div>

        {/* VirusTotal Score */}
        {project.virustotalScore != null && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t('vtScore')}</p>
            <div className="flex items-center gap-3 rounded-lg border p-2.5">
              <div className={cn(
                "flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                project.virustotalScore === 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                  : project.virustotalScore <= 5
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-red-500/15 text-red-600 dark:text-red-400"
              )}>
                {project.virustotalScore}
              </div>
              <div className="min-w-0 flex-1">
                <p className={cn(
                  "text-sm font-medium",
                  project.virustotalScore === 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : project.virustotalScore <= 5
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-600 dark:text-red-400"
                )}>
                  {project.virustotalScore === 0 ? t('vtSafe') : t('vtDetections', { score: project.virustotalScore })}
                </p>
                <p className="text-xs text-muted-foreground">0/{70 + project.virustotalScore} engines</p>
              </div>
            </div>
          </div>
        )}

        {/* VirusTotal Link */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('virusScan')}</p>
          <a
            href={project.virustotalUrl || `https://www.virustotal.com/gui/file/${project.checksum}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted"
          >
            <span>{t('vtReport')}</span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        </div>

        {/* SHA256 Checksum */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('sha256')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-3 py-2 text-xs font-mono break-all">
              {project.checksum}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              onClick={copyChecksum}
            >
              {copied ? (
                <Check className="size-4 text-emerald-500" />
              ) : (
                <Copy className="size-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {t('verifyIntegrity')}
          </p>
        </div>

        {/* Source Code Link */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">{t('openSource')}</p>
          <a
            href={project.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted"
          >
            <span>{t('viewSourceCode')}</span>
            <ExternalLink className="size-3.5 text-muted-foreground" />
          </a>
        </div>
      </CardContent>
    </Card>
  )
}
