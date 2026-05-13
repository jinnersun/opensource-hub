"use client"

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Home } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const STATUS_LABELS: Record<string, string> = {
  pending: '待翻译', translating: '翻译中', done: '已完成', failed: '失败',
}

const api = (path: string, opts?: RequestInit) => fetch(`/api/proxy?path=${encodeURIComponent(path)}`, {
  headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`, 'Content-Type': 'application/json', ...opts?.headers },
  ...opts,
}).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || String(r.status)) }))

export default function AdminTranslationsPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [retrying, setRetrying] = useState(false)

  const load = useCallback(async () => {
    try {
      const q = filter !== 'all' ? `&status=${encodeURIComponent(filter)}` : ''
      const data = await api(`/admin/translations?page=${page}&limit=30${q}`)
      setTasks(data.data || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const retryFailed = async () => {
    setRetrying(true)
    try { await api('/admin/translations/retry-failed', { method: 'POST' }); load() }
    catch (e) { console.error(e) }
    finally { setRetrying(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <Home className="size-5" />
        </Link>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">翻译任务</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {total} 条</p>
        </div>
        <div className="flex items-center gap-2">
          {tasks.some(t => t.status === 'failed') && (
            <Button size="sm" onClick={retryFailed} disabled={retrying}>
              <RefreshCw className="size-4 mr-1" />重试全部失败
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={load}>刷新</Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'translating', 'done', 'failed'].map(s => (
          <Badge key={s} variant={filter === s ? 'default' : 'outline'}
            className="cursor-pointer" onClick={() => { setFilter(s); setPage(1) }}>
            {s === 'all' ? '全部' : STATUS_LABELS[s] || s}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left">App ID</th>
                  <th className="px-4 py-3 text-left">目标语言</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">重试</th>
                  <th className="px-4 py-3 text-left">错误</th>
                  <th className="px-4 py-3 text-left">创建时间</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs">{t.app_id}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{t.target_locale}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={t.status === 'failed' ? 'destructive' : t.status === 'done' ? 'default' : 'secondary'}>
                        {STATUS_LABELS[t.status] || t.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{t.retry_count}/3</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate text-xs">{t.last_error || '-'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{t.created_at || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">第 {page} 页</span>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
          <Button size="sm" variant="outline" disabled={tasks.length < 30} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      </div>
    </div>
  )
}
