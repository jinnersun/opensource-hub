"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
}

export function ErrorState({ title, description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 mb-4">
        <AlertTriangle className="size-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">{title || "加载失败"}</h3>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {description || "无法连接到服务器，请检查网络后重试"}
      </p>
      {onRetry && (
        <Button variant="outline" onClick={onRetry} className="gap-2">
          <RefreshCw className="size-4" />
          重试
        </Button>
      )}
    </div>
  )
}
