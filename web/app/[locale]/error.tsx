"use client"

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Link } from '@/i18n/routing'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useTranslations('errorPage')

  useEffect(() => {
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex flex-col items-center justify-center px-4 py-20">
        <div className="flex size-20 items-center justify-center rounded-full bg-destructive/10 mb-6">
          <AlertTriangle className="size-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{t('title')}</h1>
        <p className="text-sm text-muted-foreground max-w-md text-center mb-8">
          {t('description')}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={reset} className="gap-2">
            <RefreshCw className="size-4" />
            {t('retry')}
          </Button>
          <Link href="/">
            <Button className="gap-2">
              <Home className="size-4" />
              {t('goHome')}
            </Button>
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  )
}
