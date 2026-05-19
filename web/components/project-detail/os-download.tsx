"use client"

import * as React from "react"
import { Download, Monitor, Apple, Cpu, Info, ExternalLink } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import type { Project } from "@/lib/data"

type OS = "windows" | "mac" | "linux" | "unknown"

function detectOS(): OS {
  if (typeof window === "undefined") return "unknown"
  const ua = window.navigator.userAgent.toLowerCase()
  if (ua.includes("win")) return "windows"
  if (ua.includes("mac")) return "mac"
  if (ua.includes("linux")) return "linux"
  return "unknown"
}

const osLabels: Record<OS, string> = {
  windows: "Windows",
  mac: "macOS",
  linux: "Linux",
  unknown: "Download",
}

const OsIcon = ({ os, className }: { os: OS; className?: string }) => {
  if (os === "windows") return <Monitor className={className} />
  if (os === "mac") return <Apple className={className} />
  if (os === "linux") return <Cpu className={className} />
  return <Download className={className} />
}

interface OSDownloadProps {
  project: Project
  variant?: "default" | "compact"
}

export function OSDownload({ project, variant = "default" }: OSDownloadProps) {
  const [detectedOS, setDetectedOS] = React.useState<OS>("unknown")
  const [selectedOS, setSelectedOS] = React.useState<OS>("unknown")
  const t = useTranslations('project')

  React.useEffect(() => {
    const os = detectOS()
    setDetectedOS(os)
    // 如果检测到的系统有对应安装包则选中，否则回退到第一个可用平台
    const hasDetected = os !== 'unknown' ? project.platforms[os] : undefined
    if (hasDetected) {
      setSelectedOS(os)
    } else {
      const keys = Object.keys(project.platforms) as OS[]
      const first = keys.find(k => k !== 'unknown' && project.platforms[k])
      setSelectedOS(first || os)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availablePlatforms = (Object.keys(project.platforms) as OS[]).filter(
    (os): os is Exclude<OS, "unknown"> => os !== "unknown"
  )

  const getPlatform = (os: OS) => {
    if (os === "unknown") return undefined
    return project.platforms[os]
  }

  const activePlatform = getPlatform(selectedOS) ?? getPlatform(availablePlatforms[0]) ?? null

  const isDetected = selectedOS === detectedOS && detectedOS !== "unknown" && availablePlatforms.includes(detectedOS)

  // 没有任何下载包时的兜底：跳转项目主页 / GitHub
  const fallbackHref = project.homepage || project.sourceUrl || "#"
  const hasReleases = availablePlatforms.length > 0

  if (variant === "compact") {
    return (
      <div className="space-y-3">
        {hasReleases && activePlatform ? (
          <a
            href={activePlatform.url}
            target="_blank"
            rel="noopener noreferrer"
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
          <a
            href={fallbackHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-4 py-3.5 font-medium transition-all",
              "bg-foreground text-background hover:opacity-90 active:scale-[0.98]"
            )}
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="size-5" />
              <p className="text-sm font-semibold">{t('visitHomepage')}</p>
            </div>
          </a>
        )}

        {hasReleases && availablePlatforms.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {availablePlatforms
              .filter((os) => os !== selectedOS)
              .map((os) => {
                const p = getPlatform(os)
                if (!p) return null
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
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{t('smartDownload')}</p>
        {isDetected && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Info className="size-3" />
            {t('autoDetected')}
          </span>
        )}
      </div>

      {/* OS selector pills */}
      {hasReleases && availablePlatforms.length > 1 && (
        <div className="flex flex-wrap gap-2">
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
      {hasReleases && activePlatform ? (
        <a
          href={activePlatform.url}
          target="_blank"
          rel="noopener noreferrer"
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
        <div className="space-y-2">
          <a
            href={fallbackHref}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex w-full items-center justify-between rounded-xl px-4 py-3.5 font-medium transition-all",
              "bg-foreground text-background hover:opacity-90 active:scale-[0.98]"
            )}
          >
            <div className="flex items-center gap-3">
              <ExternalLink className="size-5" />
              <p className="text-sm font-semibold">{t('visitHomepage')}</p>
            </div>
          </a>
          <p className="text-xs text-muted-foreground px-1">{t('noReleaseHint')}</p>
        </div>
      )}

      {/* Other platforms */}
      {hasReleases && availablePlatforms.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {availablePlatforms
            .filter((os) => os !== selectedOS)
            .map((os) => {
              const p = getPlatform(os)
              if (!p) return null
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
  )
}
