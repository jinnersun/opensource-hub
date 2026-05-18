import { Suspense } from 'react'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { ProjectCard } from '@/components/project-card'
import { Link } from '@/i18n/routing'
import { transformAppForDisplay } from '@/lib/api'
import type { Project } from '@/lib/api'
import { ArrowLeft, Package, Loader2, type LucideIcon, Sparkles, Video, Shield, Palette, FileText, Settings, Monitor, Code, Folder, Lock } from 'lucide-react'
import { CategorySidebar } from './_components/category-sidebar'
import { LoadMore } from './_components/load-more'

const PAGE_SIZE = 24

const lucideIconMap: Record<string, LucideIcon> = {
  sparkles: Sparkles, play: Video, shield: Shield, palette: Palette,
  'file-text': FileText, settings: Settings, monitor: Monitor, code: Code,
  folder: Folder, lock: Lock,
}

function getCategoryIcon(emojiKey: string): { Icon: LucideIcon; fallback: string } {
  const Icon = lucideIconMap[emojiKey]
  return Icon ? { Icon, fallback: '' } : { Icon: Sparkles, fallback: '📦' }
}

type Props = { params: Promise<{ locale: string; id: string }> }

async function getServerData(locale: string, categoryId: string) {
  try {
    const cloudflareContext = (globalThis as any)[Symbol.for('__cloudflare-context__')]
    const db = cloudflareContext?.env?.DB
    if (!db) return null

    // 查当前分类的应用
    const { results: appRows } = await db.prepare(
      `SELECT a.id, a.name, a.slug, a.description, a.full_description, a.category, a.tags,
              a.github_url, a.license, a.homepage_url, a.stars_count, a.last_updated, a.created_at,
              c.name as category_name, c.slug as category_slug, c.lucide_icon, c.color, c.description as cat_description,
              COALESCE(t_req.summary, t_zh.summary) as summary,
              COALESCE(t_req.description, t_zh.description) as trans_desc,
              COALESCE(t_req.features, t_zh.features) as features,
              COALESCE(t_req.use_cases, t_zh.use_cases) as use_cases,
              COALESCE(t_req.quick_start_guide, t_zh.quick_start_guide) as quick_start_guide,
              COALESCE(t_req.caveats, t_zh.caveats) as caveats
       FROM apps a
       LEFT JOIN categories c ON a.category = c.slug
       LEFT JOIN app_translations t_req ON t_req.app_id = a.id AND t_req.locale = ?
       LEFT JOIN app_translations t_zh ON t_zh.app_id = a.id AND t_zh.locale = 'zh'
       WHERE a.category = ? AND a.status = 'active'
       ORDER BY a.stars_count DESC LIMIT ?`,
    ).bind(locale, categoryId, PAGE_SIZE).all()

    // 查所有分类（侧边栏用）
    const { results: catRows } = await db.prepare(
      `SELECT c.*, COUNT(a.id) as app_count FROM categories c
       LEFT JOIN apps a ON a.category = c.slug AND a.status = 'active'
       WHERE c.is_active = 1 GROUP BY c.id ORDER BY c.sort_order ASC`,
    ).all()

    // 查总数（用于判断是否有更多）
    const { c: total } = await db.prepare(
      `SELECT COUNT(*) as c FROM apps WHERE category = ? AND status = 'active'`,
    ).bind(categoryId).first<{c:number}>() || {c:0}

    const projects = ((appRows || []) as any[]).map((row: any) => {
      return transformAppForDisplay({
        ...row,
        category: categoryId,
        full_description: row.full_description,
        github_url: row.github_url || '',
        homepage_url: row.homepage_url || '',
        ai_content: { summary: row.summary, features: JSON.parse(row.features || '[]'), use_cases: JSON.parse(row.use_cases || '[]'), quick_start_guide: JSON.parse(row.quick_start_guide || '[]'), caveats: row.caveats },
        versions: [],
        security: null,
      } as any)
    })

    const categories = (catRows || []).map((c: any) => ({
      id: c.slug,
      label: c.name,
      description: c.cat_description || '',
      emoji: c.lucide_icon || 'star',
      color: c.color || '',
      projectCount: c.app_count || 0,
    }))

    const currentCat = categories.find((c: any) => c.id === categoryId)

    return { projects, categories, currentCat, total: total || 0 }
  } catch (e) {
    console.error('[SSR category]', e)
    return null
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, id } = await params
  const t = await getTranslations({ locale, namespace: 'data' })
  const label = t(`categories.${id}.label`)
  const desc = t(`categories.${id}.description`)
  return {
    title: `${label} - OpenSource-Hub`,
    description: desc || `${label} tools`,
    alternates: {
      canonical: `https://www.opensource-hub.com/${locale}/category/${id}`,
      languages: {
        zh: `https://www.opensource-hub.com/zh/category/${id}`,
        en: `https://www.opensource-hub.com/en/category/${id}`,
        ja: `https://www.opensource-hub.com/ja/category/${id}`,
        ko: `https://www.opensource-hub.com/ko/category/${id}`,
        'x-default': `https://www.opensource-hub.com/en/category/${id}`,
      },
    },
  }
}

export default async function CategoryDetailPage({ params }: Props) {
  const { locale, id: categoryId } = await params
  const t = await getTranslations({ locale, namespace: 'category' })
  const td = await getTranslations({ locale, namespace: 'data' })
  const te = await getTranslations({ locale, namespace: 'errors' })

  const data = await getServerData(locale, categoryId)

  // 服务端出错时返回空状态（客户端会重试）
  if (!data) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-12">
          <p className="text-center text-muted-foreground">{te('description')}</p>
        </main>
        <Footer />
      </div>
    )
  }

  const { projects, categories, currentCat, total } = data
  const label = td(`categories.${categoryId}.label`) || currentCat?.label || categoryId
  const description = td(`categories.${categoryId}.description`) || currentCat?.description || ''
  const currentIcon = currentCat ? getCategoryIcon(currentCat.emoji) : null
  const hasMore = total > PAGE_SIZE

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/category" className="flex items-center gap-1 hover:text-foreground transition-colors">
            <ArrowLeft className="size-4" />
            {t('browseAll')}
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{label}</span>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar */}
          <CategorySidebar
            currentCat={currentCat}
            categories={categories}
            categoryId={categoryId}
            label={label}
            description={description}
            projectCount={projects.length}
            currentIcon={currentIcon}
            td={td}
            t={t}
          />

          {/* Projects */}
          <div className="flex-1 min-w-0">
            {projects.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {projects.map((project: Project) => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
                <Suspense fallback={<div className="py-8 text-center"><Loader2 className="size-6 animate-spin inline" /></div>}>
                  <LoadMore categoryId={categoryId} locale={locale} hasMore={hasMore} />
                </Suspense>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20">
                <span className="text-5xl mb-4">🔍</span>
                <p className="text-lg text-muted-foreground">{t('empty', { label })}</p>
                <Link href="/category" className="mt-4 text-sm text-foreground underline underline-offset-4 hover:text-foreground/80">
                  {t('browseAll')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
