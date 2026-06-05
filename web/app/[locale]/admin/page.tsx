"use client"

import { useEffect, useState } from 'react'
import { Link } from '@/i18n/routing'
import { Package, BookOpen, Clock, AlertTriangle, ArrowRight, Zap, Languages } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

interface AdminStats {
  apps: number; library: number
  etl: Record<string, number>
  submissions: Record<string, number>
  translation: Record<string, number>
  translationDeadlocked: number
}

const api = (path: string, params?: Record<string,string|number>) => {
  const sp = new URLSearchParams({ path })
  if (params) Object.entries(params).forEach(([k,v]) => sp.set(k, String(v)))
  return fetch(`/api/proxy?${sp.toString()}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}` },
  }).then(r => r.json())
}

const ETl_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending:     { label: '待处理', color: 'text-amber-500' },
  processing:  { label: '处理中', color: 'text-blue-500' },
  completed:   { label: '已完成', color: 'text-emerald-500' },
  skipped:     { label: '已跳过', color: 'text-slate-400' },
  failed:      { label: '失败', color: 'text-red-500' },
  rate_limited:{ label: '限流', color: 'text-orange-500' },
  library_imported: { label: '已入库', color: 'text-violet-500' },
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null)

  useEffect(() => { api('/admin/stats').then(setStats) }, [])

  if (!stats) return <div className="py-20 text-center text-muted-foreground">加载中...</div>
  if ((stats as any).error) return <div className="py-20 text-center text-red-500">加载失败: {(stats as any).error}</div>

  const cards = [
    { label: '活跃应用', value: stats.apps || 0, icon: Package, color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { label: '库项目', value: stats.library || 0, icon: BookOpen, color: 'text-violet-500', bg: 'bg-violet-500/10' },
    { label: '待审核提交', value: stats.submissions?.pending || 0, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10', link: '/admin/submissions' },
    { label: 'ETL 失败', value: stats.etl?.failed || 0, icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', link: '/admin/etl' },
    { label: '翻译死锁', value: stats.translationDeadlocked || 0, icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-500/10', link: '/admin/translations?status=failed' },
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">系统运行状态总览</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(c => (
          <Card key={c.label} className={c.link ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}>
            {c.link ? (
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
            ) : (
              <CardContent className="p-5 flex items-center gap-4">
                <div className={`flex size-10 items-center justify-center rounded-lg ${c.bg}`}>
                  <c.icon className={`size-5 ${c.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{c.value}</p>
                  <p className="text-xs text-muted-foreground">{c.label}</p>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      <div className="flex gap-3 flex-wrap">
        <Button size="sm" variant="outline" onClick={() => {
          api('/admin/trigger-etl')
          alert('ETL 任务已触发，后台处理中')
        }}><Zap className="size-4 mr-1" />触发 ETL</Button>
        <Button size="sm" variant="outline" onClick={() => {
          api('/admin/trigger-translate')
          alert('翻译任务已触发，后台处理中')
        }}><Languages className="size-4 mr-1" />触发翻译</Button>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">ETL 状态分布</h2>
            <Link href="/admin/etl" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              查看全部 <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            {Object.entries(stats.etl || {}).map(([k, v]) => {
              const meta = ETl_STATUS_MAP[k] || { label: k, color: 'text-muted-foreground' }
              return (
                <div key={k} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                  <span className={meta.color}>{meta.label}</span>
                  <span className="font-mono font-medium">{v}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">翻译任务</h2>
            <Link href="/admin/translations" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              查看全部 <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-4 gap-3 text-sm">
            {Object.entries(stats.translation || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">{k === 'pending' ? '待翻译' : k === 'done' ? '已完成' : k === 'translating' ? '翻译中' : k === 'failed' ? '失败' : k}</span>
                <span className="font-mono font-medium">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">用户提交</h2>
            <Link href="/admin/submissions" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
              查看全部 <ArrowRight className="size-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            {Object.entries(stats.submissions || {}).map(([k, v]) => (
              <div key={k} className="flex justify-between rounded-lg bg-muted/50 px-3 py-2">
                <span className="text-muted-foreground">{k === 'pending' ? '待审核' : k === 'approved' ? '已通过' : k}</span>
                <span className="font-mono font-medium">{v}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
