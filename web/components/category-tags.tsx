"use client"

import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import {
  Cpu,
  Video,
  Shield,
  Paintbrush,
  FileText,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

interface CategoryItem {
  id: string
  icon: LucideIcon
}

const categoryItems: CategoryItem[] = [
  { id: "ai", icon: Sparkles },
  { id: "video", icon: Video },
  { id: "privacy", icon: Shield },
  { id: "design", icon: Paintbrush },
  { id: "office", icon: FileText },
  { id: "system", icon: Cpu },
]

interface CategoryTagsProps {
  className?: string
  /** Currently active category ID for highlighting */
  activeId?: string
}

export function CategoryTags({ className, activeId }: CategoryTagsProps) {
  const td = useTranslations('data')

  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-2", className)}>
      {categoryItems.map((cat) => {
        const Icon = cat.icon
        const isActive = activeId === cat.id
        const label = td(`categories.${cat.id}.label`)
        return (
          <Link
            key={cat.id}
            href={`/category/${cat.id}`}
            className={cn(
              "flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-all",
              isActive
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        )
      })}
    </div>
  )
}
