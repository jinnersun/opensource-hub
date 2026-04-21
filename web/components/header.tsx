"use client"

import { useState } from "react"
import { useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/routing'
import { Package2, Flame, LayoutGrid, Compass } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"
import { SubmitSoftwareDialog } from "@/components/submit-software-dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems = [
  {
    href: "/",
    labelKey: "discover",
    icon: Compass,
  },
  {
    href: "/trending",
    labelKey: "trending",
    icon: Flame,
  },
  {
    href: "/category",
    labelKey: "categories",
    icon: LayoutGrid,
  },
]

export function Header() {
  const pathname = usePathname()
  const t = useTranslations('nav')
  const [dialogOpen, setDialogOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-foreground">
              <Package2 className="size-4 text-background" />
            </div>
            <span className="text-lg font-semibold">OpenSource-Hub</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn("size-4", item.href === "/trending" && "text-orange-500")} />
                  {t(item.labelKey)}
                </Link>
              )
            })}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => setDialogOpen(true)}
            >
              {t('submitSoftware')}
            </Button>
          </div>
        </div>
      </header>

      <SubmitSoftwareDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
      />
    </>
  )
}
