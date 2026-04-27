"use client"

import { useTranslations } from 'next-intl'
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from '@/i18n/routing'
import { FileQuestion, Home, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  const t = useTranslations('notFound')

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex flex-col items-center justify-center px-4 py-20">
        <div className="flex size-20 items-center justify-center rounded-full bg-muted mb-6">
          <FileQuestion className="size-10 text-muted-foreground" />
        </div>
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-lg text-muted-foreground mb-2">{t('title')}</p>
        <p className="text-sm text-muted-foreground max-w-md text-center mb-8">
          {t('description')}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => history.back()} className="gap-2">
            <ArrowLeft className="size-4" />
            {t('goBack')}
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
