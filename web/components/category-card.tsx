import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import {
  Sparkles,
  Video,
  Shield,
  Palette,
  FileText,
  Settings,
  type LucideIcon,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import type { Category } from "@/lib/data"

// Icon mapping
const iconMap: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  play: Video,
  shield: Shield,
  palette: Palette,
  "file-text": FileText,
  settings: Settings,
  monitor: Settings,
  code: Settings,
  folder: FileText,
  lock: Shield,
}

interface CategoryCardProps {
  category: Category
  className?: string
}

export function CategoryCard({ category, className }: CategoryCardProps) {
  const Icon = iconMap[category.emoji] || Sparkles
  const td = useTranslations('data')
  const label = td(`categories.${category.id}.label`)
  const description = td(`categories.${category.id}.description`)

  return (
    <Link href={`/category/${category.id}`} className={cn("group block", className)}>
      <Card className="h-full overflow-hidden border-border/50 transition-all duration-300 hover:border-foreground/20 hover:shadow-lg">
        <CardContent className="p-6">
          {/* Icon background */}
          <div
            className={cn(
              "mb-4 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br",
              category.color
            )}
          >
            <Icon className="size-6 text-white" />
          </div>

          {/* Title and description */}
          <h3 className="mb-2 text-lg font-semibold text-foreground group-hover:text-foreground/80">
            {label}
          </h3>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>

          {/* Project count */}
          {category.projectCount !== undefined && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-muted px-2 py-0.5">
                {td('softwareCount', { count: category.projectCount })}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
