"use client"

import { useState } from 'react'
import { Link } from '@/i18n/routing'
import { useTranslations } from 'next-intl'
import { Github, ExternalLink } from 'lucide-react'
import { LanguageSwitcher } from '@/components/language-switcher'
import { SubmitSoftwareDialog } from '@/components/submit-software-dialog'

interface FooterLink {
  label: string
  href: string
}

export function Footer() {
  const t = useTranslations('footer')
  const [submitOpen, setSubmitOpen] = useState(false)

  const discoverLinks = t.raw('discover.links') as unknown as FooterLink[]
  const resourceLinks = t.raw('resources.links') as unknown as FooterLink[]
  const legalLinks = t.raw('legal.links') as unknown as FooterLink[]

  const renderLink = (link: FooterLink) => {
    if (link.href === '#submit') {
      return (
        <button key={link.label} onClick={() => setSubmitOpen(true)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left">
          {link.label}
        </button>
      )
    }
    if (link.href.startsWith('http')) {
      return (
        <a key={link.label} href={link.href} target="_blank" rel="noopener noreferrer"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1">
          {link.label}
          <ExternalLink className="size-3" />
        </a>
      )
    }
    return (
      <Link key={link.label} href={link.href}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors">
        {link.label}
      </Link>
    )
  }

  return (
    <>
      <footer className="border-t bg-secondary/30 px-6 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {/* 品牌 */}
            <div className="space-y-3">
              <h3 className="font-bold text-lg">OpenSource-Hub</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{t('brand.slogan')}</p>
              <p className="text-xs text-muted-foreground/70">{t('brand.techSignal')}</p>
            </div>

            {/* 发现 */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">{t('discover.title')}</h4>
              <div className="flex flex-col gap-2">
                {discoverLinks?.map(renderLink)}
              </div>
            </div>

            {/* 资源 */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">{t('resources.title')}</h4>
              <div className="flex flex-col gap-2">
                {resourceLinks?.map(renderLink)}
              </div>
            </div>

            {/* 法律 & 语言 */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm">{t('legal.title')}</h4>
              <div className="flex flex-col gap-2">
                {legalLinks?.map(renderLink)}
              </div>
              <div className="pt-1">
                <LanguageSwitcher />
              </div>
            </div>
          </div>

          {/* 底部 */}
          <div className="mt-10 pt-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <p>{t('copyright')}</p>
            <a href="https://github.com/jinnersun/opensource-hub" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
              <Github className="size-3.5" />
              GitHub
            </a>
          </div>
        </div>
      </footer>

      <SubmitSoftwareDialog open={submitOpen} onClose={() => setSubmitOpen(false)} />
    </>
  )
}
