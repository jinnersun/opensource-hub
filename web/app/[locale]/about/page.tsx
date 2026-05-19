"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { Package2, Shield, Heart, Users } from "lucide-react"
import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'about' })
  return {
    title: `${t('title')} - OpenSource-Hub`,
    description: t('description'),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/about`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh/about',
        en: 'https://www.opensource-hub.com/en/about',
        ja: 'https://www.opensource-hub.com/ja/about',
        ko: 'https://www.opensource-hub.com/ko/about',
        'x-default': 'https://www.opensource-hub.com/en/about',
      },
    },
  }
}

export default function AboutPage() {
  const t = useTranslations('about')

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 px-4 py-16 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-muted p-4"><Package2 className="size-8" /></div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="space-y-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-violet-500/10"><Heart className="size-5 text-violet-500" /></div>
              <h2 className="text-xl font-bold">{t('mission.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('mission.desc')}</p>
            </div>
            <div className="space-y-4">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10"><Shield className="size-5 text-blue-500" /></div>
              <h2 className="text-xl font-bold">{t('trust.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('trust.desc')}</p>
            </div>
          </div>
        </section>

        <section className="border-y bg-secondary/10 px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <h2 className="mb-8 text-center text-2xl font-bold">{t('dataSource.title')}</h2>
            <div className="grid gap-6 sm:grid-cols-3">
              {(['s1','s2','s3'] as const).map((k,i) => (
                <div key={k} className="rounded-xl border bg-card p-6">
                  <div className="mb-3 text-2xl font-bold text-muted-foreground">0{i+1}</div>
                  <h3 className="mb-2 font-semibold">{t(`dataSource.${k}.title`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`dataSource.${k}.desc`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16">
          <h2 className="mb-6 text-2xl font-bold">{t('disclaimer.title')}</h2>
          <div className="space-y-4 text-muted-foreground leading-relaxed">
            <p>{t('disclaimer.p1')}</p><p>{t('disclaimer.p2')}</p><p>{t('disclaimer.p3')}</p>
          </div>
        </section>

        <section className="border-t bg-secondary/10 px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <div className="mb-4 inline-flex items-center justify-center rounded-full bg-muted p-3"><Users className="size-6" /></div>
            <h2 className="text-2xl font-bold">{t('community.title')}</h2>
            <p className="mt-3 text-muted-foreground">{t('community.desc')}</p>
            <div className="mt-6 flex justify-center gap-4">
              <a href="https://github.com/jinnersun/opensource-hub" target="_blank" rel="noopener noreferrer"
                className="rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-90">
                {t('community.github')}
              </a>
              <Link href="/contact" className="rounded-full border px-6 py-3 text-sm font-medium transition-colors hover:bg-muted">
                {t('community.contact')}
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
