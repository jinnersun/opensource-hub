'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface GuidedQuestionProps {
  categoryName: string
  onSearch?: (query: string) => void
}

export function GuidedQuestion({ categoryName, onSearch }: GuidedQuestionProps) {
  const [query, setQuery] = useState('')
  const t = useTranslations('guidedQuestion')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim() && onSearch) {
      onSearch(query)
    }
  }

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border-blue-200 dark:border-blue-800 p-6 mb-8">
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">
          {t('notFound')}
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-200">
          {t('description', { category: categoryName })}
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder={t('placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 bg-white dark:bg-background"
            />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          </div>
          <Button
            type="submit"
            variant="default"
            disabled={!query.trim()}
            className="px-6"
          >
            {t('search')}
          </Button>
        </form>

        <p className="text-xs text-blue-700 dark:text-blue-300">
          {t('tip')}
        </p>
      </div>
    </Card>
  )
}
