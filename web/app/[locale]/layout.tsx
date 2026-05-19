import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { Noto_Sans_SC } from 'next/font/google'
import { ThemeProvider } from '@/components/theme-provider'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { routing } from '@/i18n/routing'
import { cn } from '@/lib/utils'

const geist = Geist({ 
  subsets: ["latin"],
  variable: '--font-geist-sans',
})

const geistMono = Geist_Mono({ 
  subsets: ["latin"],
  variable: '--font-geist-mono',
})

const notoSansSC = Noto_Sans_SC({
  subsets: ["latin"],
  variable: '--font-noto-sans-sc',
  weight: ['400', '500', '600', '700'],
})

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const { getTranslations } = await import('next-intl/server')
  const t = await getTranslations({ locale, namespace: 'metadata' })

  const ogImage = {
    url: 'https://www.opensource-hub.com/images/og-image.png',
    width: 1200,
    height: 630,
    alt: 'OpenSource-Hub',
  }

  return {
    title: t('title'),
    description: t('description'),
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}`,
      languages: {
        zh: 'https://www.opensource-hub.com/zh',
        en: 'https://www.opensource-hub.com/en',
        ja: 'https://www.opensource-hub.com/ja',
        ko: 'https://www.opensource-hub.com/ko',
        'x-default': 'https://www.opensource-hub.com/en',
      },
    },
    openGraph: {
      title: t('title'),
      description: t('description'),
      siteName: 'OpenSource-Hub',
      type: 'website',
      locale: locale === 'zh' ? 'zh_CN' : locale === 'ja' ? 'ja_JP' : locale === 'ko' ? 'ko_KR' : 'en_US',
      images: [ogImage],
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description'), images: [ogImage] },
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params

  // Validate locale
  if (!routing.locales.includes(locale as any)) {
    notFound()
  }

  const messages = await getMessages()

  const isCJK = locale === 'zh'
  const fontClass = isCJK
    ? `${geist.variable} ${geistMono.variable} ${notoSansSC.variable} font-sans antialiased bg-background`
    : `${geist.variable} ${geistMono.variable} font-sans antialiased bg-background`

  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        name: 'OpenSource-Hub',
        url: 'https://www.opensource-hub.com',
        logo: 'https://www.opensource-hub.com/icon.svg',
        description: 'Discover quality open source software — human-curated, GitHub-checksum-verified, AI-assisted reviews',
        sameAs: ['https://github.com/jinnersun/opensource-hub'],
      },
      {
        '@type': 'WebSite',
        name: 'OpenSource-Hub',
        url: 'https://www.opensource-hub.com',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: 'https://www.opensource-hub.com/{locale}/search?q={search_term_string}',
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }

  return (
    <html lang={locale} suppressHydrationWarning className={isCJK ? 'font-noto-sans-sc' : ''}>
      <body className={fontClass}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            {children}
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
