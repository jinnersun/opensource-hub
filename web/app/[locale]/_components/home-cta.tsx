"use client"

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from "@/components/ui/button"
import { SubmitRequestDialog } from "@/components/submit-request-dialog"

export function HomeCTA() {
  const t = useTranslations('home')
  const [open, setOpen] = useState(false)

  return (
    <>
      <section className="border-t bg-secondary/30 px-4 py-14 sm:py-18">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold sm:text-3xl">{t('ctaTitle')}</h2>
          <p className="mt-3 text-muted-foreground">{t('ctaSubtitle')}</p>
          <Button
            className="mt-6 rounded-full px-6 py-3 text-sm font-medium"
            onClick={() => setOpen(true)}
          >
            {t('ctaButton')}
          </Button>
        </div>
      </section>
      <SubmitRequestDialog open={open} onClose={() => setOpen(false)} />
    </>
  )
}
