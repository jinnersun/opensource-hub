"use client"

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectCard } from '@/components/project-card'
import { getApps, transformAppForDisplay } from '@/lib/api'
import type { Project } from '@/lib/api'

export function LoadMore({ categoryId, locale, hasMore }: { categoryId: string; locale: string; hasMore: boolean }) {
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<Project[]>([])
  const [more, setMore] = useState(hasMore)
  const [offset, setOffset] = useState(24)

  const load = async () => {
    setLoading(true)
    try {
      const resp = await getApps({ category: categoryId, limit: 24, offset, locale })
      const next = (resp.data || []).map(transformAppForDisplay)
      setItems(prev => [...prev, ...next])
      setOffset(o => o + 24)
      setMore(next.length === 24)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  return (
    <>
      {items.map(project => (
        <div key={project.id} className="mt-4">
          <ProjectCard project={project} />
        </div>
      ))}
      {more && (
        <div className="py-8 text-center">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? <><Loader2 className="size-4 mr-2 animate-spin" />加载中...</> : '加载更多'}
          </Button>
        </div>
      )}
    </>
  )
}
