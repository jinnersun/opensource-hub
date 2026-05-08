'use client'

import * as React from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/routing'
import { AlertCircle, TrendingUp, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProjectIcon } from '@/components/project-icon'
import { Sparkline } from '@/components/sparkline'
import { AppModal } from '@/components/app-modal'
import type { Project } from '@/lib/data'

interface LeaderboardProps {
  projects: Project[]
  period: 'day' | 'week' | 'alltime'
}

export function Leaderboard({ projects, period }: LeaderboardProps) {
  const t = useTranslations('leaderboard')
  const tc = useTranslations('common')
  const [modalProject, setModalProject] = React.useState<Project | null>(null)

  const getRankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-400/20 text-yellow-600 dark:text-yellow-400'
    if (rank === 2) return 'bg-gray-300/20 text-gray-600 dark:text-gray-300'
    if (rank === 3) return 'bg-orange-400/20 text-orange-600 dark:text-orange-400'
    return 'bg-muted text-muted-foreground'
  }

  const getRankEmoji = (rank: number) => {
    if (rank === 1) return '🥇'
    if (rank === 2) return '🥈'
    if (rank === 3) return '🥉'
    return `#${rank}`
  }

  const getGrowthLabel = (growth?: number) => {
    if (!growth) return '—'
    return `${growth > 0 ? '+' : ''}${growth}%`
  }

  return (
    <div className="space-y-3">
      {projects.map((project, index) => {
        const rank = index + 1
        const growth = 
          period === 'day' ? project.starGrowth24h :
          period === 'week' ? project.starGrowthWeek :
          undefined

        return (
          <Link
            key={project.id}
            href={`/project/${project.id}`}
            className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/30 transition-colors group"
          >
            {/* Rank Badge */}
            <div className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg ${getRankColor(rank)}`}>
              {getRankEmoji(rank)}
            </div>

            {/* Project Info */}
            <div className="flex-shrink-0">
              <ProjectIcon name={project.name} />
            </div>

            {/* Name & Description（名称完整展示；描述放开至 2 行） */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors break-words">{project.name}</h3>
                {project.controversy && (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-100/50 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 rounded">
                    <AlertCircle className="h-3 w-3" />
                    {t('caution')}
                  </span>
                )}
                {project.verified && (
                  <span className="inline-flex text-xs bg-green-100/50 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded">
                    ✓ {tc('verified')}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{project.description}</p>
            </div>

            {/* Growth Metric */}
            <div className="flex-shrink-0 text-center">
              {growth ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-semibold text-green-500">
                      {getGrowthLabel(growth)}
                    </span>
                  </div>
                  {project.sparklineData && (
                    <Sparkline
                      data={project.sparklineData}
                      className="text-green-400"
                      width={40}
                      height={16}
                    />
                  )}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  <div className="font-semibold flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    {project.stars.toLocaleString()}
                  </div>
                </div>
              )}
            </div>

            {/* Download Button - prevent navigation when clicked */}
            <div
              className="flex-shrink-0"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                setModalProject(project)
              }}
            >
              <Button size="sm" variant="default">
                {tc('get')}
              </Button>
            </div>
          </Link>
        )
      })}

      {/* App Modal */}
      {modalProject && (
        <AppModal
          project={modalProject}
          open={true}
          onClose={() => setModalProject(null)}
        />
      )}
    </div>
  )
}
