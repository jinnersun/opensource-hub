import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ErrorState } from '@/components/error-state'
import { Library as LibraryIcon } from 'lucide-react'
import { LibraryContent } from './_components/library-content'
import type { LibraryItem, LibraryFacets } from '@/lib/api'

type Props = { params: Promise<{ locale: string }> }

async function getServerData(locale: string) {
  try {
    const ctx = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const api = ctx?.env?.API
    if (!api) return null

    const [itemsRes, facetsRes] = await Promise.all([
      api.fetch(new Request(`http://internal/api/library?limit=24&sort=stars&lang=${locale}`)),
      api.fetch(new Request('http://internal/api/library/facets')).catch(() => null),
    ])

    const itemsData = await itemsRes.json() as any
    const facets = facetsRes ? await facetsRes.json() as LibraryFacets : null

    return { items: (itemsData.data || []) as LibraryItem[], facets }
  } catch (e) {
    console.error('[SSR library]', e)
    return null
  }
}

export default async function LibraryPage({ params }: Props) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'library' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  const data = await getServerData(locale)

  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-12">
          <ErrorState title={te('title')} description={te('description')} />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <LibraryIcon className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-3xl">{t('subtitle')}</p>
        </div>
        <LibraryContent initialItems={data.items} initialFacets={data.facets} />
      </main>
      <Footer />
    </div>
  )
}
