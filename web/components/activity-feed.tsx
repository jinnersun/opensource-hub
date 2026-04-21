'use client'

import { AlertCircle, Heart, Bug, Shield, GitCommit } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Card } from '@/components/ui/card'

interface ActivityItem {
  id: string
  type: 'release' | 'star' | 'security' | 'bug-fix'
  projectName: string
  message: string
  timeAgo: string
  count?: number
}

interface ActivityFeedProps {
  activities: ActivityItem[]
}

export function ActivityFeed({ activities }: ActivityFeedProps) {
  const t = useTranslations('activity')
  const getIcon = (type: string) => {
    switch (type) {
      case 'release':
        return <GitCommit className="h-4 w-4 text-blue-500" />
      case 'star':
        return <Heart className="h-4 w-4 text-red-500 fill-red-500" />
      case 'security':
        return <Shield className="h-4 w-4 text-green-500" />
      case 'bug-fix':
        return <Bug className="h-4 w-4 text-orange-500" />
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />
    }
  }

  return (
    <Card className="h-full overflow-hidden bg-card/50 backdrop-blur-sm">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm">{t('title')}</h3>
        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
      </div>
      <div className="overflow-y-auto max-h-96 space-y-2 p-3">
        {activities.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">{t('empty')}</p>
        ) : (
          activities.map((activity) => (
            <div key={activity.id} className="flex gap-3 pb-3 border-b last:border-0 hover:bg-accent/30 rounded px-2 py-1.5 transition-colors">
              <div className="flex-shrink-0 pt-1">{getIcon(activity.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{activity.projectName}</p>
                <p className="text-xs text-muted-foreground leading-tight">{activity.message}</p>
                <p className="text-xs text-muted-foreground/70 mt-1">{activity.timeAgo}</p>
              </div>
              {activity.count && (
                <div className="flex-shrink-0 bg-primary/10 text-primary text-xs font-semibold rounded px-1.5 py-0.5">
                  +{activity.count}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  )
}
