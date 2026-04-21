"use client"

import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'

export function Footer() {
  const t = useTranslations('home')

  return (
    <footer className="border-t px-4 py-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {t('footer')}
          </p>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <Link href="/about" className="transition-colors hover:text-foreground">
              {t('aboutUs')}
            </Link>
            <Link href="/privacy" className="transition-colors hover:text-foreground">
              {t('privacy')}
            </Link>
            <Link href="/contact" className="transition-colors hover:text-foreground">
              {t('contact')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
