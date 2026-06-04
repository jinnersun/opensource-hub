"use client"

import { MessageCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface FAQQuickLinkProps {
  faqCount: number
  label: string
}

export function FAQQuickLink({ faqCount, label }: FAQQuickLinkProps) {
  if (faqCount === 0) return null

  const handleClick = () => {
    const el = document.getElementById('faq-section')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <Card className="sticky top-24 cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-4" onClick={handleClick}>
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
            <MessageCircle className="size-4 text-amber-500" />
          </div>
          <div>
            <p className="text-sm font-medium">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {faqCount} FAQ{faqCount > 1 ? 's' : ''}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
