"use client"

import * as React from "react"
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { cn } from "@/lib/utils"
import { 
  FileText, 
  Sparkles, 
  Shield, 
  MessageSquare,
  ChevronLeft
} from "lucide-react"

interface NavItem {
  id: string
  labelKey: string
  icon: typeof FileText
}

const navItems: NavItem[] = [
  { id: "overview", labelKey: "overview", icon: FileText },
  { id: "features", labelKey: "features", icon: Sparkles },
  { id: "security", labelKey: "security", icon: Shield },
  { id: "reviews", labelKey: "reviews", icon: MessageSquare },
]

interface DetailSidebarProps {
  projectName: string
}

export function DetailSidebar({ projectName }: DetailSidebarProps) {
  const [activeSection, setActiveSection] = React.useState("overview")
  const t = useTranslations('detailSidebar')
  const tc = useTranslations('common')

  React.useEffect(() => {
    const handleScroll = () => {
      const sections = navItems.map(item => document.getElementById(item.id))
      const scrollPosition = window.scrollY + 100

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section && section.offsetTop <= scrollPosition) {
          setActiveSection(navItems[i].id)
          break
        }
      }
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id)
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: "smooth"
      })
    }
  }

  return (
    <aside className="sticky top-20 hidden h-fit w-56 shrink-0 lg:block">
      <Link 
        href="/"
        className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        {t('backToHome')}
      </Link>
      
      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {projectName}
        </p>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {t(item.labelKey)}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
