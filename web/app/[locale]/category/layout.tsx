import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'category' })
  const tn = await getTranslations({ locale, namespace: 'nav' })
  return {
    title: `${tn('categories')} - OpenSource-Hub`,
    description: t('browseDesc'),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/category`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh/category',
        en: 'https://www.opensource-hub.com/en/category',
        ja: 'https://www.opensource-hub.com/ja/category',
        ko: 'https://www.opensource-hub.com/ko/category',
        'x-default': 'https://www.opensource-hub.com/en/category',
      },
    },
  }
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
