'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Flame, Clock, Trophy, Loader2 } from 'lucide-react'
import { Footer } from '@/components/footer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Leaderboard } from '@/components/leaderboard'
import { Header } from '@/components/header'
import { ErrorState } from '@/components/error-state'
import { getTrending, transformAppForDisplay } from '@/lib/api'
import type { Project } from '@/lib/api'



export default function TrendingPage() {
  const t = useTranslations('trending')
  const te = useTranslations('errors')
  const locale = useLocale()
  const [period, setPeriod] = useState<'day' | 'week' | 'alltime'>('week')
  const [trendingProjects, setTrendingProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const data = await getTrending(period, 10, locale)
      setTrendingProjects(data.map(transformAppForDisplay))
    } catch (err) {
      console.error('API request failed:', err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [period, locale])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="max-w-7xl mx-auto px-4 py-12">
          <ErrorState title={te('title')} description={te('description')} onRetry={loadData} />
        </main>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-4">
            <Flame className="h-8 w-8 text-orange-500" />
            <h1 className="text-4xl font-bold">{t('title')}</h1>
          </div>
          <p className="text-lg text-muted-foreground max-w-2xl">
            {t('subtitle')}
          </p>
        </div>

        {/* Period Tabs */}
        <div className="mb-8">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as 'day' | 'week' | 'alltime')} className="w-full">
            <TabsList className="grid w-full max-w-sm grid-cols-3">
              <TabsTrigger value="day" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span className="hidden sm:inline">{t('day')}</span>
                <span className="sm:hidden">{t('dayShort')}</span>
              </TabsTrigger>
              <TabsTrigger value="week" className="flex items-center gap-2">
                <Flame className="h-4 w-4" />
                <span className="hidden sm:inline">{t('week')}</span>
                <span className="sm:hidden">{t('weekShort')}</span>
              </TabsTrigger>
              <TabsTrigger value="alltime" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">{t('alltime')}</span>
                <span className="sm:hidden">{t('alltimeShort')}</span>
              </TabsTrigger>
            </TabsList>

            <div className="mt-8">
              <TabsContent value="day">
                <Leaderboard projects={trendingProjects} period="day" />
              </TabsContent>
              <TabsContent value="week">
                <Leaderboard projects={trendingProjects} period="week" />
              </TabsContent>
              <TabsContent value="alltime">
                <Leaderboard projects={trendingProjects} period="alltime" />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </main>

      <Footer />
    </div>
  )
}
