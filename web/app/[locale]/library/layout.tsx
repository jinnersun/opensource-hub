import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'library' })
  const tn = await getTranslations({ locale, namespace: 'nav' })
  return {
    title: `${tn('library')} - OpenSource-Hub`,
    description: t('subtitle') || 'Explore open source libraries, frameworks, and developer tools',
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/library`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh/library',
        en: 'https://www.opensource-hub.com/en/library',
        ja: 'https://www.opensource-hub.com/ja/library',
        ko: 'https://www.opensource-hub.com/ko/library',
        'x-default': 'https://www.opensource-hub.com/en/library',
      },
    },
  }
}

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
