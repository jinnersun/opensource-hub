import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'about' })
  return {
    title: `${t('title')} - OpenSource-Hub`,
    description: t('description'),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/about`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh/about',
        en: 'https://www.opensource-hub.com/en/about',
        ja: 'https://www.opensource-hub.com/ja/about',
        ko: 'https://www.opensource-hub.com/ko/about',
        'x-default': 'https://www.opensource-hub.com/en/about',
      },
    },
  }
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
