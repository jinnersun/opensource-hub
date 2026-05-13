import type { Metadata } from 'next'

type Props = { params: Promise<{ locale: string; id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  try {
    const cloudflareContext = (globalThis as any)[Symbol.for("__cloudflare-context__")]
    const apiBinding = cloudflareContext?.env?.API
    if (apiBinding) {
      const resp = await apiBinding.fetch(new Request(`http://internal/api/categories`))
      const data = await resp.json() as any
      const cat = (data?.data || []).find((c: any) => c.slug === id)
      if (cat) {
        const title = locale === 'zh' ? `${cat.name}工具 - OpenSource-Hub` : `${cat.name} Tools - OpenSource-Hub`
        return {
          title,
          description: cat.description || title,
          alternates: {
            canonical: `https://www.opensource-hub.com/${locale}/category/${id}`,
          },
        }
      }
    }
  } catch { /* fallback */ }
  return { title: 'OpenSource-Hub' }
}

export default function CategoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
