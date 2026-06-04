"use client"

import { useEffect, useState } from 'react'
import { FAQSection, type FAQItem } from './faq-section'

interface DeepDiveTabsProps {
  longDescription: string
  faqs: FAQItem[] | null
  detailLabel: string
  faqLabel: string
  sourceIssueLabel: string
  searchIntentLabels: Record<string, string>
}

export function DeepDiveTabs({
  longDescription, faqs, detailLabel, faqLabel, sourceIssueLabel, searchIntentLabels,
}: DeepDiveTabsProps) {
  const hasFaqs = faqs && faqs.length > 0
  const useTabs = hasFaqs && faqs!.length >= 3
  const [tab, setTab] = useState<'detail' | 'faq'>('detail')

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#faq' && hasFaqs) {
      setTab('faq')
      setTimeout(() => {
        document.getElementById('faq-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [hasFaqs])

  // 无 FAQ → 只渲染详细介绍
  if (!hasFaqs) {
    return (
      <section>
        <h2 className="text-xl font-bold mb-4">{detailLabel}</h2>
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>{longDescription}</p>
        </div>
      </section>
    )
  }

  // 1~2 条 → 内联模式（无 Tab）
  if (!useTabs) {
    return (
      <>
        <section>
          <h2 className="text-xl font-bold mb-4">{detailLabel}</h2>
          <div className="prose prose-sm max-w-none text-muted-foreground">
            <p>{longDescription}</p>
          </div>
        </section>
        <section id="faq-section" className="mt-8">
          <h2 className="text-xl font-bold mb-4">{faqLabel} ({faqs!.length})</h2>
          <FAQSection
            faqs={faqs!}
            sourceIssueLabel={sourceIssueLabel}
            searchIntentLabels={searchIntentLabels}
          />
        </section>
      </>
    )
  }

  // 3+ 条 → Tab 模式
  const tabs = [
    { id: 'detail' as const, label: detailLabel },
    { id: 'faq' as const, label: `${faqLabel} (${faqs!.length})` },
  ]

  return (
    <section id="faq-section">
      <div className="flex border-b mb-4 gap-1 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors min-h-11 ${
              tab === t.id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'detail' && (
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>{longDescription}</p>
        </div>
      )}

      {tab === 'faq' && (
        <FAQSection
          faqs={faqs!}
          sourceIssueLabel={sourceIssueLabel}
          searchIntentLabels={searchIntentLabels}
        />
      )}
    </section>
  )
}
