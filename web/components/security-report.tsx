"use client"

import { ShieldCheck, ExternalLink, Copy, Check } from "lucide-react"
import { useTranslations } from 'next-intl'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { Project } from "@/lib/data"

interface SecurityReportProps {
  checksum: string
  sourceUrl: string
  lastUpdated: string
  securityScan: Project["securityScan"]
}

export function SecurityReport({ 
  checksum, 
  sourceUrl, 
  lastUpdated,
  securityScan 
}: SecurityReportProps) {
  const t = useTranslations('securityReport')
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="size-5 text-emerald-500" />
            {t('title')}
          </CardTitle>
          <Badge 
            variant={securityScan === "passed" ? "default" : "secondary"}
            className={securityScan === "passed" ? "bg-emerald-500 text-white hover:bg-emerald-500" : ""}
          >
            {securityScan === "passed" ? t('passed') : t('scanning')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg bg-secondary/50 p-4">
          <p className="mb-2 text-sm font-medium">{t('checksum')}</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap rounded bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
              {checksum}
            </code>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Copy className="size-4" />
              <span className="sr-only">{t('copyChecksum')}</span>
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">{t('sourceCode')}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {t('sourceDesc')}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
              {t('viewSource')}
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{t('lastUpdate')}</span>
          <span>{lastUpdated}</span>
        </div>

        <div className="rounded-lg bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20">
              <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {t('scanPassed')}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t('scanPassedDesc')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
