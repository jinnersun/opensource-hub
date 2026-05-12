"use client"

import { useEffect, useState } from 'react'
import { Package, BookOpen, Clock, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

interface AdminStats {
  apps: number; library: number
  etl: Record<string, number>
  submissions: Record<string, number>
}

const api = (path: string) => fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
  headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` },
}).then(r => r.json())

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => { api('/admin/stats').then(setStats) }, [])

  if (!stats) return <div className="py-20 text-center text-muted-foreground">加载中...</div>

  const cards = [
    { label: '活跃应用', value: stats.apps, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: '库项目', value: stats.library, icon: BookOpen, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: '待审核提交', value: stats.submissions.pending || 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'ETL 失败', value: stats.etl.failed || 0, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">系统运行状态总览</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <Card key={c.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className={`flex size-10 items-center justify-center rounded-lg ${c.bg}`}>
                <c.icon className={`size-5 ${c.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold">{c.value}</p>
                <p className="text-xs text-muted-foreground">{c.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold mb-3">ETL 状态分布</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {Object.entries(stats.etl).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono font-medium">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h2 className="font-semibold mb-3">用户提交</h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {Object.entries(stats.submissions).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-mono font-medium">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
