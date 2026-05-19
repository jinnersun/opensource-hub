"use client"

import { Link } from '@/i18n/routing'
import { Package, type LucideIcon, Sparkles, Video, Shield, Palette, FileText, Settings, Monitor, Code, Folder, Lock } from 'lucide-react'

const lucideIconMap: Record<string, LucideIcon> = {
  sparkles: Sparkles, play: Video, shield: Shield, palette: Palette,
  'file-text': FileText, settings: Settings, monitor: Monitor, code: Code,
  folder: Folder, lock: Lock,
}

function getCategoryIcon(emojiKey: string): { Icon: LucideIcon; fallback: string } {
  if (emojiKey in lucideIconMap) {
    return { Icon: lucideIconMap[emojiKey], fallback: '' }
  }
  return { Icon: Sparkles, fallback: '📦' }
}

interface CatInfo {
  id: string; label: string; description: string; emoji: string; color: string; projectCount: number
}

export function CategorySidebar({
  currentCat, categories, categoryId, label, description, projectCount,
  allLabel, otherLabel, catLabels,
}: {
  currentCat: CatInfo | null
  categories: CatInfo[]
  categoryId: string
  label: string; description: string; projectCount: number
  allLabel: string; otherLabel: string; catLabels: string[]
}) {
  const otherCategories = categories.filter(c => c.id !== categoryId).slice(0, 3)

  return (
    <aside className="w-full lg:w-72 shrink-0">
      <div className="rounded-2xl border bg-card p-6 sticky top-20">
        <div className={`mb-3 flex size-12 items-center justify-center rounded-xl bg-gradient-to-br ${currentCat?.color || 'from-gray-500 to-slate-600'}`}>
          {(() => { const { Icon } = getCategoryIcon(currentCat?.emoji || 'star'); return <Icon className="size-6 text-white" /> })()}
        </div>
        <h1 className="text-2xl font-bold mb-2">{label}</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{description}</p>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="size-4" />
          <span>{allLabel}</span>
        </div>
      </div>

      {otherCategories.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">{otherLabel}</h3>
          <div className="space-y-2">
            {otherCategories.map((cat, i) => {
              const { Icon: CatIcon } = getCategoryIcon(cat.emoji)
              const idx = categories.findIndex(c => c.id === cat.id)
              return (
                <Link key={cat.id} href={`/category/${cat.id}`}
                  className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted">
                  <span className="flex size-6 items-center justify-center rounded-lg bg-muted">
                    <CatIcon className="size-3.5" />
                  </span>
                  <span className="font-medium">{catLabels[idx] || cat.label}</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </aside>
  )
}
