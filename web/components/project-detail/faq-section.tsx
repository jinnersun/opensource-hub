"use client"

import { ChevronDown, ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export interface FAQItem {
  id: string
  question: string
  answer: string
  source_issue_url?: string
  source_issue_number?: number
  search_intent?: string
  confidence?: number
}

const INTENT_COLORS: Record<string, string> = {
  'how-to': 'bg-blue-500/10 text-blue-600',
  'troubleshooting': 'bg-amber-500/10 text-amber-600',
  'comparison': 'bg-purple-500/10 text-purple-600',
  'configuration': 'bg-emerald-500/10 text-emerald-600',
}

interface FAQSectionProps {
  faqs: FAQItem[]
  sourceIssueLabel: string
  searchIntentLabels: Record<string, string>
}

export function FAQSection({ faqs, sourceIssueLabel, searchIntentLabels }: FAQSectionProps) {
  if (!faqs.length) return null

  return (
    <div className="space-y-3">
      {faqs.map((faq, i) => {
        const intent = faq.search_intent || ''
        const intentColor = INTENT_COLORS[intent] || 'bg-muted text-muted-foreground'

        return (
          <details
            key={faq.id}
            name="faq-accordion"
            open={i === 0}
            className="group rounded-xl border bg-card"
          >
            <summary className="flex w-full items-start gap-3 px-4 py-3.5 text-left min-h-11 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {intent && (
                    <Badge variant="secondary" className={`text-[11px] px-1.5 py-0 ${intentColor}`}>
                      {searchIntentLabels[intent] || intent}
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-medium leading-snug">{faq.question}</span>
              </div>
              <ChevronDown className="size-4 shrink-0 mt-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-180" />
            </summary>

            <div className="px-4 pb-4 border-t">
              <div
                className="prose prose-sm max-w-none mt-3 text-muted-foreground break-words [&_pre]:overflow-x-auto [&_pre]:text-xs [&_code]:text-xs"
                dangerouslySetInnerHTML={{ __html: formatAnswer(faq.answer) }}
              />
              {faq.source_issue_url && (
                <a
                  href={faq.source_issue_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 mt-3 text-xs text-muted-foreground hover:text-blue-500 transition-colors"
                >
                  {sourceIssueLabel} #{faq.source_issue_number}
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </details>
        )
      })}
    </div>
  )
}

function formatAnswer(text: string): string {
  const blocks: string[] = []
  const withCodeBlocks = text.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    blocks.push(`<pre><code class="language-${lang || 'plaintext'}">${escapeHtml(code.trim())}</code></pre>`)
    return `%%CODEBLOCK_${blocks.length - 1}%%`
  })

  let html = escapeHtml(withCodeBlocks)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')
  html = html
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
    .join('\n')
  html = html.replace(/%%CODEBLOCK_(\d+)%%/g, (_, i) => blocks[parseInt(i)] || '')

  return html
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}
