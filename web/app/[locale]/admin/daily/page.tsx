"use client"

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { ArrowLeft, Home, Package, Zap, AlertTriangle, Languages, ArrowRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface DailyStats {
  newApps: number; etlDone: number; etlFailed: number
  transDone: number; transFailed: number
}

const api = (path: string, params?: Record<string,string|number>) => {
  const sp = new URLSearchParams({ path })
  if (params) Object.entries(params).forEach(([k,v]) => sp.set(k, String(v)))
  return fetch(`/api/proxy?${sp.toString()}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` },
  }).then(r => r.json())
}

export default function AdminDailyPage() {
  const [stats, setStats] = useState<DailyStats | null>(null)

  useEffect(() => { api('/admin/daily-stats').then(setStats) }, [])

  if (!stats) return <div className="py-20 text-center text-muted-foreground">加载中...</div>

  const cards = [
    { label: '今日入库', value: stats.newApps, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10', link: '/trending' },
    { label: 'ETL 完成', value: stats.etlDone, icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10', link: '/admin/etl' },
    { label: 'ETL 失败', value: stats.etlFailed, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', link: '/admin/etl' },
    { label: '翻译完成', value: stats.transDone, icon: Languages, color: 'text-violet-500', bg: 'bg-violet-500/10', link: '/admin/translations' },
    { label: '翻译失败', value: stats.transFailed, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', link: '/admin/translations' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <Home className="size-5" />
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">今日统计</h1>
        <p className="text-muted-foreground text-sm mt-1">当日数据概览，点击卡片可跳转查看详情</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(c => (
          <Card key={c.label} className="cursor-pointer hover:shadow-md transition-shadow">
            <Link href={c.link}>
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`flex size-10 items-center justify-center rounded-lg ${c.bg}`}>
                  <c.icon className={`size-5 ${c.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
                <ArrowRight className="size-4 text-muted-foreground" />
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
