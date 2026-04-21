"use client"

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from '@/i18n/routing'
import { Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function LanguageToggle() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  function toggleLocale() {
    const nextLocale = locale === 'zh' ? 'en' : 'zh'
    // 用 getPathname 切换语言
    router.replace(pathname, { locale: nextLocale })
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleLocale}
      className="size-9 rounded-full"
      title={locale === 'zh' ? 'Switch to English' : '切换到中文'}
    >
      <Globe className="size-4" />
      <span className="sr-only">
        {locale === 'zh' ? 'Switch to English' : '切换到中文'}
      </span>
    </Button>
  )
}
