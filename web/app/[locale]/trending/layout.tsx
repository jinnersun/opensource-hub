import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'trending' })
  const tn = await getTranslations({ locale, namespace: 'nav' })
  return {
    title: `${tn('trending')} - OpenSource-Hub`,
    description: t('subtitle'),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/trending`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh/trending',
        en: 'https://www.opensource-hub.com/en/trending',
        ja: 'https://www.opensource-hub.com/ja/trending',
        ko: 'https://www.opensource-hub.com/ko/trending',
        'x-default': 'https://www.opensource-hub.com/en/trending',
      },
    },
  }
}

export default function TrendingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
