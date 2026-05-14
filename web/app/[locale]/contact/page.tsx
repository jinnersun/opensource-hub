"use client"

import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { useTranslations } from 'next-intl'
import { Mail, MessageSquare, Github, Globe, ArrowRight } from "lucide-react"

export default function ContactPage() {
  const t = useTranslations('contact')

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="border-b bg-secondary/20 px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center justify-center rounded-full bg-muted p-4">
              <Mail className="size-8" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{t('title')}</h1>
            <p className="mt-4 text-lg text-muted-foreground">{t('subtitle')}</p>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-16">
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <MessageSquare className="size-5 text-blue-500" />
              </div>
              <h3 className="mb-2 font-semibold">{t('feedback.title')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{t('feedback.desc')}</p>
              <a href="mailto:feedback@opensource-hub.com" className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary">
                feedback@opensource-hub.com <ArrowRight className="size-3" />
              </a>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-violet-500/10">
                <Globe className="size-5 text-violet-500" />
              </div>
              <h3 className="mb-2 font-semibold">{t('submit.title')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{t('submit.desc')}</p>
              <a href="mailto:submit@opensource-hub.com" className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary">
                submit@opensource-hub.com <ArrowRight className="size-3" />
              </a>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-emerald-500/10">
                <Mail className="size-5 text-emerald-500" />
              </div>
              <h3 className="mb-2 font-semibold">{t('cooperation.title')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{t('cooperation.desc')}</p>
              <a href="mailto:biz@opensource-hub.com" className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary">
                biz@opensource-hub.com <ArrowRight className="size-3" />
              </a>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-slate-500/10">
                <Github className="size-5 text-slate-600" />
              </div>
              <h3 className="mb-2 font-semibold">{t('community.title')}</h3>
              <p className="mb-4 text-sm text-muted-foreground">{t('community.desc')}</p>
              <a href="https://github.com/jinnersun/opensource-hub" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium transition-colors hover:text-primary">
                {t('community.label')} <ArrowRight className="size-3" />
              </a>
            </div>
          </div>
        </section>

        <section className="border-t bg-secondary/10 px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="mb-8 text-center text-2xl font-bold">{t('faq.title')}</h2>
            <div className="space-y-4">
              {(['q1', 'q2', 'q3'] as const).map(k => (
                <div key={k} className="rounded-xl border bg-card p-6">
                  <h3 className="mb-2 font-semibold">{t(`faq.${k}.q`)}</h3>
                  <p className="text-sm text-muted-foreground">{t(`faq.${k}.a`)}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
