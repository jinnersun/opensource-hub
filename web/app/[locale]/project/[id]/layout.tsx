import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  try {
    // 通过 Service Binding 获取数据生成 SEO Meta
    const cloudflareContext = (globalThis as any)[Symbol.for("__cloudflare-context__")]
    const apiBinding = cloudflareContext?.env?.API
    if (apiBinding) {
      const resp = await apiBinding.fetch(new Request(`http://internal/api/apps/${id}?lang=${locale}`))
      const data = await resp.json() as any
      if (data?.name) {
        const desc = data.ai_content?.summary || data.description || ''
        const title = `${data.name} - OpenSource-Hub`
        return {
          title,
          description: desc.slice(0, 160),
          alternates: {
            canonical: `https://www.opensource-hub.com/${locale}/project/${data.slug || id}`,
            languages: {
              zh: `https://www.opensource-hub.com/zh/project/${data.slug || id}`,
              en: `https://www.opensource-hub.com/en/project/${data.slug || id}`,
              ja: `https://www.opensource-hub.com/ja/project/${data.slug || id}`,
              ko: `https://www.opensource-hub.com/ko/project/${data.slug || id}`,
              'x-default': `https://www.opensource-hub.com/en/project/${data.slug || id}`,
            },
          },
          openGraph: {
            title,
            description: desc.slice(0, 160),
            type: 'article',
            locale: locale === 'zh' ? 'zh_CN' : locale === 'ja' ? 'ja_JP' : locale === 'ko' ? 'ko_KR' : 'en_US',
            images: [{ url: 'https://www.opensource-hub.com/images/og-image.png', width: 1200, height: 630, alt: 'OpenSource-Hub' }],
          },
          twitter: { card: 'summary_large_image', title, description: desc.slice(0, 160) },
        }
      }
    }
  } catch { /* fallback */ }
  return { title: 'OpenSource-Hub' }
}

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
