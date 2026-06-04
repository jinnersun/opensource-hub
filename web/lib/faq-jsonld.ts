import type { FAQItem } from '@/components/project-detail/faq-section'

export function buildFAQJsonLd(faqs: FAQItem[]) {
  return {
    '@type': 'FAQPage' as const,
    mainEntity: faqs.map((f) => ({
      '@type': 'Question' as const,
      name: f.question,
      acceptedAnswer: { '@type': 'Answer' as const, text: f.answer },
    })),
  }
}
