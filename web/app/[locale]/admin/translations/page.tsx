"use client"

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Home } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const STATUSES = ['all', 'pending', 'translating', 'done', 'failed']
const STATUS_LABELS: Record<string, string> = {
  pending: '待翻译', translating: '翻译中', done: '已完成', failed: '失败',
}

const api = (path: string, params?: Record<string,string|number>, opts?: RequestInit) => {
  const sp = new URLSearchParams({ path })
  if (params) Object.entries(params).forEach(([k,v]) => sp.set(k, String(v)))
  return fetch(`/api/proxy?${sp.toString()}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`, 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || String(r.status)) }))
}

export default function AdminTranslationsPage() {
  const [tasks, setTasks] = useState<any[]>([])
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [acting, setActing] = useState<number | null>(null) // 正在操作的 task id

  const load = useCallback(async () => {
    try {
      const params: Record<string,string|number> = { page, limit: 30 }
      if (filter !== 'all') params.status = filter
      const data = await api('/admin/translations', params)
      setTasks(data.data || [])
      setTotal(data.total || 0)
    } catch (e) { console.error(e) }
    setSelected([])
  }, [filter, page])

  useEffect(() => { load() }, [load])

  const allChecked = tasks.length > 0 && tasks.every(t => selected.includes(t.id))
  const toggleAll = () => setSelected(allChecked ? [] : tasks.map(t => t.id))
  const toggleOne = (id: number) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  const retryOne = async (taskId: number) => {
    setActing(taskId)
    try { await api(`/admin/translations/${taskId}/retry`, undefined, { method: 'POST' }); load() }
    catch (e) { console.error(e) }
    finally { setActing(null) }
  }

  const retrySelected = async () => {
    setActing(-1)
    try { await api('/admin/translations/bulk-retry', undefined, { method: 'POST', body: JSON.stringify({ ids: selected }) }); load() }
    catch (e) { console.error(e) }
    finally { setActing(null) }
  }

  const retryAllFailed = async () => {
    setActing(-1)
    try { await api('/admin/translations/retry-failed', undefined, { method: 'POST' }); load() }
    catch (e) { console.error(e) }
    finally { setActing(null) }
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
          {selected.length > 0 && (
            <Button size="sm" onClick={retrySelected} disabled={acting === -1}>
              <RefreshCw className="size-4 mr-1" />重试选中 ({selected.length})
            </Button>
          )}
          {tasks.some(t => t.status === 'failed') && (
            <Button size="sm" variant="outline" onClick={retryAllFailed} disabled={acting === -1}>
              重试全部失败
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={load}>刷新</Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <Button key={s} size="sm" variant={filter === s ? 'default' : 'outline'}
            onClick={() => { setFilter(s); setPage(1) }}>
            {s === 'all' ? '全部' : STATUS_LABELS[s] || s}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left w-10">
                    <input type="checkbox" checked={allChecked} onChange={toggleAll} />
                  </th>
                  <th className="px-4 py-3 text-left">App ID</th>
                  <th className="px-4 py-3 text-left">目标语言</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">重试</th>
                  <th className="px-4 py-3 text-left">错误</th>
                  <th className="px-4 py-3 text-left">操作</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map(t => (
                  <tr key={t.id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggleOne(t.id)} />
                    </td>
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
                    <td className="px-4 py-3">
                      {t.status === 'failed' && (
                        <Button size="sm" variant="outline" onClick={() => retryOne(t.id)} disabled={acting === t.id}>
                          {acting === t.id ? '...' : '重试'}
                        </Button>
                      )}
                    </td>
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
