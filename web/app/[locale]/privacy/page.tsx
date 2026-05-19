"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { Shield, Server, Brain, Cookie, Trash2, Mail, Github } from "lucide-react"



export default function PrivacyPage() {
  const t = useTranslations('privacy')

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-muted p-4"><Shield className="size-8" /></div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
          </div>
        </section>

        <section className="mx-auto max-w-3xl px-4 py-16">
          <div className="space-y-12">

            <div>
              <h2 className="mb-4 text-xl font-bold">{t('overview.title')}</h2>
              <p className="text-muted-foreground leading-relaxed">{t('overview.text')}</p>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2"><Server className="size-5 text-blue-500" /><h2 className="text-xl font-bold">{t('infrastructure.title')}</h2></div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>{t('infrastructure.p1')}</p><p>{t('infrastructure.p2')}</p><p>{t('infrastructure.p3')}</p>
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2"><Brain className="size-5 text-violet-500" /><h2 className="text-xl font-bold">{t('ai.title')}</h2></div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>{t('ai.p1')}</p>
                <ul className="ml-6 list-disc space-y-2"><li>{t('ai.li1')}</li><li>{t('ai.li2')}</li></ul>
                <p>{t('ai.p2')}</p>
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-bold">{t('collection.title')}</h2>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <ul className="ml-6 list-disc space-y-3">
                  <li>{t('collection.li1')}</li><li>{t('collection.li2')}</li><li>{t('collection.li3')}</li><li>{t('collection.li4')}</li>
                </ul>
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2"><Cookie className="size-5 text-amber-500" /><h2 className="text-xl font-bold">{t('cookies.title')}</h2></div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>{t('cookies.p1')}</p>
                <div className="ml-6 space-y-3">
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold text-foreground mb-1">{t('cookies.necessary.title')}</h3>
                    <ul className="list-disc ml-4 space-y-1 text-sm"><li>{t('cookies.necessary.li1')}</li><li>{t('cookies.necessary.li2')}</li><li>{t('cookies.necessary.li3')}</li></ul>
                  </div>
                  <div className="rounded-lg border p-4">
                    <h3 className="font-semibold text-foreground mb-1">{t('cookies.analytics.title')}</h3>
                    <ul className="list-disc ml-4 space-y-1 text-sm"><li>{t('cookies.analytics.li1')}</li><li>{t('cookies.analytics.li2')}</li><li>{t('cookies.analytics.li3')}</li></ul>
                  </div>
                </div>
                <p>{t('cookies.p2')}</p>
              </div>
            </div>

            <div>
              <h2 className="mb-4 text-xl font-bold">{t('usage.title')}</h2>
              <p className="mb-3 text-muted-foreground leading-relaxed">{t('usage.p1')}</p>
              <p className="text-muted-foreground leading-relaxed">{t('usage.p2')}</p>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2"><Github className="size-5 text-slate-600" /><h2 className="text-xl font-bold">{t('opensource.title')}</h2></div>
              <div className="space-y-3 text-muted-foreground leading-relaxed">
                <p>{t('opensource.p1')}</p><p>{t('opensource.p2')}</p>
              </div>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2"><Trash2 className="size-5 text-red-500" /><h2 className="text-xl font-bold">{t('retention.title')}</h2></div>
              <p className="text-muted-foreground leading-relaxed">{t('retention.text')}</p>
            </div>

            <div>
              <div className="mb-4 flex items-center gap-2"><Mail className="size-5 text-emerald-500" /><h2 className="text-xl font-bold">{t('contact.title')}</h2></div>
              <p className="text-muted-foreground leading-relaxed">
                {t('contact.text')}
                <Link href="/contact" className="mx-1 text-foreground underline">{t('contact.linkText')}</Link>
                {t('contact.textAfter')}
              </p>
            </div>

            <div className="rounded-xl border bg-secondary/20 p-6">
              <p className="text-sm text-muted-foreground">{t('update')}</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
