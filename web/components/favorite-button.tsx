'use client'

import { useState, useEffect } from 'react'
import { Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'

const STORAGE_KEY = 'osh_favorites'

function getFavorites(): string[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') }
  catch { return [] }
}

export function FavoriteButton({ projectId }: { projectId: string }) {
  const [favorited, setFavorited] = useState(false)

  useEffect(() => {
    setFavorited(getFavorites().includes(projectId))
  }, [projectId])

  const toggle = () => {
    const favs = getFavorites()
    const updated = favs.includes(projectId)
      ? favs.filter(id => id !== projectId)
      : [...favs, projectId]
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
    setFavorited(!favorited)
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggle}
      aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart className={`size-4 ${favorited ? 'fill-red-500 text-red-500' : ''}`} />
    </Button>
  )
}
