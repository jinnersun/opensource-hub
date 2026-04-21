"use client"

import * as React from "react"
import { Download, Monitor, Apple, Terminal } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import type { Project } from "@/lib/data"

interface DownloadCardProps {
  platforms: Project["platforms"]
  name: string
}

type Platform = "windows" | "mac" | "linux"

const platformConfig: Record<Platform, { icon: typeof Monitor; label: string; color: string }> = {
  windows: { icon: Monitor, label: "Windows", color: "bg-blue-500" },
  mac: { icon: Apple, label: "macOS", color: "bg-foreground" },
  linux: { icon: Terminal, label: "Linux", color: "bg-orange-500" },
}

function detectPlatform(): Platform {
  if (typeof window === "undefined") return "windows"
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes("mac")) return "mac"
  if (ua.includes("linux")) return "linux"
  return "windows"
}

export function DownloadCard({ platforms, name }: DownloadCardProps) {
  const [activePlatform, setActivePlatform] = React.useState<Platform>("windows")
  const [mounted, setMounted] = React.useState(false)
  const tp = useTranslations('project')

  React.useEffect(() => {
    setMounted(true)
    setActivePlatform(detectPlatform())
  }, [])

  const availablePlatforms = Object.keys(platforms) as Platform[]
  const currentPlatformData = platforms[activePlatform]
  const config = platformConfig[activePlatform]
  const Icon = config.icon

  if (!mounted) {
    return (
      <Card className="sticky top-20 border-2">
        <CardContent className="p-6">
          <div className="h-48 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn(
      "sticky top-20 overflow-hidden border-2 transition-colors",
      activePlatform === "windows" && "border-blue-500/50",
      activePlatform === "mac" && "border-foreground/30",
      activePlatform === "linux" && "border-orange-500/50",
    )}>
      <div className={cn(
        "h-1.5 w-full",
        config.color
      )} />
      <CardContent className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className={cn(
            "flex size-10 items-center justify-center rounded-lg text-white",
            config.color
          )}>
            <Icon className="size-5" />
          </div>
          <div>
            <p className="font-semibold">{tp('download')} {name}</p>
            <p className="text-sm text-muted-foreground">{tp('applyFor')} {config.label}</p>
          </div>
        </div>

        {currentPlatformData && (
          <>
            <Button size="lg" className="mb-4 w-full gap-2">
              <Download className="size-4" />
              {tp('downloadNow')}
            </Button>
            
            <div className="mb-4 flex items-center justify-between text-sm text-muted-foreground">
              <span>{tp('version')} {currentPlatformData.version}</span>
              <span>{currentPlatformData.size}</span>
            </div>
          </>
        )}

        <div className="border-t pt-4">
          <p className="mb-3 text-xs text-muted-foreground">{tp('otherVersions')}</p>
          <div className="flex gap-2">
            {availablePlatforms.map((platform) => {
              const pConfig = platformConfig[platform]
              const PIcon = pConfig.icon
              return (
                <button
                  key={platform}
                  onClick={() => setActivePlatform(platform)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-xs transition-colors",
                    activePlatform === platform
                      ? "border-foreground/30 bg-secondary"
                      : "border-border hover:border-foreground/20"
                  )}
                >
                  <PIcon className="size-3.5" />
                  <span>{pConfig.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
