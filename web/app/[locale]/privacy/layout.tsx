import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'privacy' })
  return {
    title: `${t('title')} - OpenSource-Hub`,
    description: t('description'),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/privacy`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh/privacy',
        en: 'https://www.opensource-hub.com/en/privacy',
        ja: 'https://www.opensource-hub.com/ja/privacy',
        ko: 'https://www.opensource-hub.com/ko/privacy',
        'x-default': 'https://www.opensource-hub.com/en/privacy',
      },
    },
  }
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
