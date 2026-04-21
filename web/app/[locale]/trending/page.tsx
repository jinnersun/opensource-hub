'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Flame, Clock, Trophy, Loader2 } from 'lucide-react'
import { Footer } from '@/components/footer'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Leaderboard } from '@/components/leaderboard'
import { ActivityFeed } from '@/components/activity-feed'
import { Header } from '@/components/header'
import { getTrending, transformAppForDisplay } from '@/lib/api'
import { getTrendingByPeriod } from '@/lib/data'
import type { Project } from '@/lib/data'

const mockActivities = [
  {
    id: '1',
    type: 'release' as const,
    projectName: 'SmartNote',
    message: 'released v2.9.0 with AI summary feature',
    timeAgo: 'just now',
  },
  {
    id: '2',
    type: 'star' as const,
    projectName: 'yt-dlp',
    message: '580 new stars in the past 24 hours',
    timeAgo: '10m ago',
    count: 580,
  },
  {
    id: '3',
    type: 'security' as const,
    projectName: 'PrivacyGuard',
    message: 'passed SOC 2 Type II audit',
    timeAgo: '1h ago',
  },
  {
    id: '4',
    type: 'bug-fix' as const,
    projectName: 'DesignFlow',
    message: 'fixed macOS 15 compatibility issue',
    timeAgo: '2h ago',
  },
  {
    id: '5',
    type: 'release' as const,
    projectName: 'VideoGet',
    message: 'released batch download feature',
    timeAgo: '3h ago',
  },
  {
    id: '6',
    type: 'star' as const,
    projectName: 'QuickLaunch',
    message: '890 new stars this week',
    timeAgo: '5h ago',
    count: 890,
  },
]

export default function TrendingPage() {
  const t = useTranslations('trending')
  const [period, setPeriod] = useState<'day' | 'week' | 'alltime'>('week')
  const [trendingProjects, setTrendingProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadData() {
      try {
        const data = await getTrending(period)
        setTrendingProjects(data.map(transformAppForDisplay))
      } catch (err) {
        console.warn('API unavailable, using fallback data', err)
        setTrendingProjects(getTrendingByPeriod(period))
      } finally {
        setLoading(false)
      }
    }
    setLoading(true)
    loadData()
  }, [period])

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* Left Content */}
          <div>
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
          </div>

          {/* Right Sidebar - Activity Feed */}
          <div className="hidden lg:block">
            <div className="sticky top-24">
              <ActivityFeed activities={mockActivities} />
            </div>
          </div>
        </div>

        {/* Activity Feed Bottom (Mobile) */}
        <div className="lg:hidden mt-8">
          <ActivityFeed activities={mockActivities} />
        </div>
      </main>

      <Footer />
    </div>
  )
}
