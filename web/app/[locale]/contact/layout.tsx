import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'contact' })
  return {
    title: `${t('title')} - OpenSource-Hub`,
    description: t('description'),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/contact`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh/contact',
        en: 'https://www.opensource-hub.com/en/contact',
        ja: 'https://www.opensource-hub.com/ja/contact',
        ko: 'https://www.opensource-hub.com/ko/contact',
        'x-default': 'https://www.opensource-hub.com/en/contact',
      },
    },
  }
}

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
