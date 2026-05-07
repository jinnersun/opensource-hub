"use client"

import { Download, Monitor, Apple, Cpu, Rocket, Play, ChevronRight } from "lucide-react"
import { useTranslations, useLocale } from 'next-intl'
import { cn } from "@/lib/utils"
import type { Project } from "@/lib/data"

type OS = "windows" | "mac" | "linux" | "unknown"

const osIcons: Record<OS, React.ElementType> = {
  windows: Monitor,
  mac: Apple,
  linux: Cpu,
  unknown: Download,
}

interface GettingStartedCardProps {
  project: Project
}

export function GettingStartedCard({ project }: GettingStartedCardProps) {
  const t = useTranslations('project')
  const locale = useLocale()

  // 检测用户系统
  const detectedOS: OS = typeof window !== "undefined"
    ? (() => {
        const ua = window.navigator.userAgent.toLowerCase()
        if (ua.includes("win")) return "windows"
        if (ua.includes("mac")) return "mac"
        if (ua.includes("linux")) return "linux"
        return "unknown"
      })()
    : "unknown"

  // 可用的平台
  const availablePlatforms = (Object.keys(project.platforms) as OS[]).filter(
    (os): os is Exclude<OS, "unknown"> => os !== "unknown"
  )

  // AI 生成的通用步骤
  const aiSteps = project.gettingStarted || []

  // 构建安装步骤：第一步固定为下载，第二步为分系统安装指引，后续为 AI 步骤
  const getInstallStepDesc = (os: OS): string => {
    if (os === 'windows') return t('stepInstallWindows')
    if (os === 'mac') return t('stepInstallMac')
    if (os === 'linux') return t('stepInstallLinux')
    return t('stepInstallWindows')
  }

  // 获取当前检测到的 OS 对应步骤
  const activeOS = availablePlatforms.includes(detectedOS) ? detectedOS : availablePlatforms[0] || 'windows'

  return (
    <section>
      <h2 className="text-xl font-bold mb-4">{t('gettingStarted')}</h2>

      {/* 分系统的安装步骤 */}
      <div className="rounded-xl border bg-card">
        {/* 步骤 1: 下载 */}
        <div className="flex items-start gap-4 p-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
            1
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{t('stepDownload')}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t('stepDownloadDesc')}</p>
            {/* 下载链接提示 */}
            <div className="flex flex-wrap gap-2 mt-2">
              {availablePlatforms.map((os) => {
                const p = project.platforms[os]
                if (!p) return null
                const Icon = osIcons[os]
                const osLabel = os === 'mac' ? t('osMac') : os === 'linux' ? t('osLinux') : t('osWindows')
                return (
                  <a
                    key={os}
                    href={p.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      os === activeOS
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3" />
                    {osLabel}
                    <span className="opacity-70">· {p.size}</span>
                  </a>
                )
              })}
              {availablePlatforms.length === 0 && (
                <a
                  href={project.homepage || project.sourceUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Download className="size-3" />
                  {t('visitHomepage')}
                </a>
              )}
            </div>
          </div>
        </div>

        {/* 步骤 2: 安装（分系统指引） */}
        <div className="flex items-start gap-4 p-4 border-t">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
            2
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">
              {project.isPortable ? t('stepLaunch') : t('stepInstall')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {project.isPortable
                ? t('stepLaunchPortable')
                : getInstallStepDesc(activeOS)
              }
            </p>
          </div>
        </div>

        {/* 步骤 3+: AI 生成的后续步骤 */}
        {aiSteps.slice(project.isPortable ? 0 : 0).map((step, index) => (
          <div key={index} className="flex items-start gap-4 p-4 border-t">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
              {project.isPortable ? index + 2 : index + 3}
            </div>
            <div className="pt-1">
              <p className="text-sm text-muted-foreground">{step}</p>
            </div>
          </div>
        ))}

        {/* 如果 AI 步骤为空且不是便携版，显示默认第3步 */}
        {aiSteps.length === 0 && (
          <div className="flex items-start gap-4 p-4 border-t">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground text-background text-sm font-bold">
              {project.isPortable ? 2 : 3}
            </div>
            <div className="pt-1">
              <p className="text-sm text-muted-foreground">{t('stepLaunchDesc')}</p>
            </div>
          </div>
        )}
      </div>

      {/* AI 生成的详细步骤（如果有额外的） */}
      {aiSteps.length > 0 && (
        <div className="mt-4 rounded-xl border bg-violet-500/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Rocket className="size-4 text-violet-500" />
            <span className="text-sm font-medium text-violet-600 dark:text-violet-400">{t('installGuide')}</span>
          </div>
          <ol className="space-y-1.5">
            {aiSteps.map((step, index) => (
              <li key={index} className="flex items-start gap-2 text-sm">
                <ChevronRight className="size-3.5 shrink-0 mt-0.5 text-violet-400" />
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  )
}
