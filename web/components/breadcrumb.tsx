"use client"

import { Link } from '@/i18n/routing'
import { ChevronRight, Home } from "lucide-react"
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className }: BreadcrumbProps) {
  const t = useTranslations('common')

  return (
    <nav className={cn("flex items-center gap-1.5 text-sm", className)}>
      <Link
        href="/"
        className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        <Home className="size-3.5" />
        <span>{t('home')}</span>
      </Link>
      
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <ChevronRight className="size-3.5 text-muted-foreground" />
          {item.href ? (
            <Link
              href={item.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  )
}
