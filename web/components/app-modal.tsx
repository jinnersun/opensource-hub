"use client"

import * as React from "react"
import {
  X,
  Download,
  Star,
  ShieldCheck,
  CheckCircle2,
  Monitor,
  Apple,
  Cpu,
  ArrowRight,
  ExternalLink,
  Info,
} from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { ProjectIcon } from "@/components/project-icon"
import type { Project } from "@/lib/data"

interface AppModalProps {
  project: Project
  open: boolean
  onClose: () => void
}

type PlatformKey = "windows" | "mac" | "linux"
type OS = PlatformKey | "unknown"

function detectOS(): OS {
  if (typeof window === "undefined") return "unknown"
  const ua = window.navigator.userAgent.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("mac")) return "mac"
  if (ua.includes("linux")) return "linux"
  return "unknown"
}

function formatStars(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

const osLabels: Record<OS, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  unknown: "Download",
}

const platformKeys: PlatformKey[] = ["windows", "mac", "linux"]

const OsIcon = ({ os, className }: { os: OS; className?: string }) => {
  if (os === "windows") return <Monitor className={className} />
  if (os === "mac") return <Apple className={className} />
  if (os === "linux") return <Cpu className={className} />
  return <Download className={className} />
}

export function AppModal({ project, open, onClose }: AppModalProps) {
  const [detectedOS, setDetectedOS] = React.useState<OS>("unknown")
  const [selectedOS, setSelectedOS] = React.useState<OS>("unknown")
  const t = useTranslations('project')
  const tc = useTranslations('common')
  const td = useTranslations('data')
  const categoryLabel = td(`categories.${project.category}.label`)

  React.useEffect(() => {
    const os = detectOS()
    setDetectedOS(os)
    setSelectedOS(os)
  }, [])

  // Close on Escape
  React.useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open, onClose])

  // Lock body scroll
  React.useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [open])

  if (!open) return null

  const availablePlatforms = platformKeys.filter((k) => project.platforms[k])
  const activePlatform =
    (selectedOS !== "unknown" ? project.platforms[selectedOS] : undefined) ??
    project.platforms[availablePlatforms[0]] ??
    null

  const isDetected = selectedOS !== "unknown" && selectedOS === detectedOS && availablePlatforms.includes(detectedOS as PlatformKey)

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`${project.name} ${t('projectInfo')}`}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border bg-background shadow-2xl sm:max-w-lg sm:rounded-2xl">
        {/* Header */}
        <div className="flex items-start gap-4 border-b p-5">
          <ProjectIcon name={project.name} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-bold leading-tight">
                  {project.humanTitle}
                </h2>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs text-muted-foreground">
                    {project.categoryLabel ? categoryLabel : project.categoryLabel}
                  </span>
                  {project.verified && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="size-3" />
                      {t('verified')}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={t('close')}
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Star className="size-3.5 fill-amber-400 text-amber-400" />
                {formatStars(project.stars)} {tc('stars')}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="size-3.5 text-emerald-500" />
                {t('securityScanPassed')}
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* AI Summary */}
          <div className="border-b px-5 py-4">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>
          </div>

          {/* Smart OS Download */}
          <div className="border-b px-5 py-5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold">{t('smartDownload')}</p>
              {isDetected && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Info className="size-3" />
                  {t('autoDetected')}
                </span>
              )}
            </div>

            {/* OS selector pills */}
            {availablePlatforms.length > 1 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {availablePlatforms.map((os) => (
                  <button
                    key={os}
                    onClick={() => setSelectedOS(os)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      selectedOS === os
                        ? "border-foreground bg-foreground text-background"
                        : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground"
                    )}
                  >
                    <OsIcon os={os} className="size-3.5" />
                    {osLabels[os]}
                    {os === detectedOS && (
                      <span className="rounded-sm bg-emerald-500/20 px-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                        {t('recommend')}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Primary Download Button */}
            {activePlatform ? (
              <a
                href={`/api/download?id=${project.id}&platform=${selectedOS}`}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-4 py-3.5 font-medium transition-all",
                  "bg-foreground text-background hover:opacity-90 active:scale-[0.98]"
                )}
              >
                <div className="flex items-center gap-3">
                  <OsIcon os={selectedOS} className="size-5" />
                  <div className="text-left">
                    <p className="text-sm font-semibold">
                      {t('downloadVersion', { os: osLabels[selectedOS] })}
                    </p>
                    <p className="text-xs opacity-70">
                      v{activePlatform.version} · {activePlatform.size}
                    </p>
                  </div>
                </div>
                <Download className="size-5 opacity-70" />
              </a>
            ) : (
              <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
                {t('notSupported')}
              </div>
            )}

            {/* Other platforms */}
            {availablePlatforms.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {availablePlatforms
                  .filter((os) => os !== selectedOS)
                  .map((os) => {
                    const p = project.platforms[os]!
                    return (
                      <button
                        key={os}
                        onClick={() => setSelectedOS(os)}
                        className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
                      >
                        <OsIcon os={os} className="size-3" />
                        {osLabels[os]} ({p.size})
                      </button>
                    )
                  })}
              </div>
            )}
          </div>

          {/* Getting Started */}
          <div className="border-b px-5 py-5">
            <p className="mb-3 text-sm font-semibold">{t('threeSteps')}</p>
            <ol className="flex flex-col gap-3">
              {project.gettingStarted.map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold">
                    {i + 1}
                  </div>
                  <p className="pt-0.5 text-sm text-muted-foreground">{step}</p>
                </li>
              ))}
            </ol>
          </div>

          {/* Day-2 Info */}
          <div className="px-5 py-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <span>{project.uninstallNote}</span>
              </div>
              {project.dependsOn && (
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>{t('dependsOn', { dep: project.dependsOn })}</span>
                </div>
              )}
              <div className="flex items-start gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                <span className="font-mono">
                  {project.checksum.slice(0, 24)}…
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t bg-secondary/30 px-5 py-3">
          <a
            href={project.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('viewSource')}
            <ExternalLink className="size-3" />
          </a>
          <a
            href="#feedback"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t('reportIssue')}
            <ArrowRight className="size-3" />
          </a>
        </div>
      </div>
    </div>
  )
}
