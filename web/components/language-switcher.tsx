"use client"

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const localeNames: Record<string, string> = {
  zh: '中文',
  en: 'English',
}

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (newLocale: string) => {
    // Replace the locale prefix in the pathname
    const segments = pathname.split('/')
    // Current path is like /zh/... or /en/...
    if (segments.length > 1 && (segments[1] === 'zh' || segments[1] === 'en')) {
      segments[1] = newLocale
    } else {
      // Fallback: prepend locale
      segments.splice(1, 0, newLocale)
    }
    router.replace(segments.join('/'))
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9">
          <Languages className="size-4" />
          <span className="sr-only">Switch language</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {Object.entries(localeNames).map(([key, name]) => (
          <DropdownMenuItem
            key={key}
            onClick={() => switchLocale(key)}
            className={locale === key ? 'bg-accent' : ''}
          >
            {name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
