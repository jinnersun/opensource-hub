import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'searchPage' })
  return {
    title: `${t('title')} - OpenSource-Hub`,
    description: t('enterKeyword'),
    robots: { index: false, follow: true },
  }
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
