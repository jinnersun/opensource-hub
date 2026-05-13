"use client"

import { useEffect, useState, useCallback } from 'react'
import { ArrowLeft, RefreshCw, Home } from 'lucide-react'
import { Link } from '@/i18n/routing'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'

const STATUSES = ['all', 'pending', 'processing', 'completed', 'skipped', 'failed', 'rate_limited']
const STATUS_LABELS: Record<string, string> = {
  pending: '待处理', processing: '处理中', completed: '已完成',
  skipped: '已跳过', failed: '失败', rate_limited: '限流',
}

const api = (path: string, params?: Record<string,string|number>, opts?: RequestInit) => {
  const sp = new URLSearchParams({ path })
  if (params) Object.entries(params).forEach(([k,v]) => sp.set(k, String(v)))
  return fetch(`/api/proxy?${sp.toString()}`, {
    headers: { 'Authorization': `Bearer ${sessionStorage.getItem('admin_token')}`, 'Content-Type': 'application/json', ...opts?.headers },
    ...opts,
  }).then(r => r.ok ? r.json() : r.json().then(e => { throw new Error(e.error || String(r.status)) }))
}

export default function AdminEtlPage() {
  const [jobs, setJobs] = useState<any[]>([])
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<number[]>([])
  const [retrying, setRetrying] = useState(false)
  const [logModal, setLogModal] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const params: Record<string,string|number> = { page, limit: 30 }
      if (status !== 'all') params.status = status
      const data = await api('/admin/jobs', params)
      setJobs(data.data || [])
      setTotal(data.total || 0)
    } catch (e) { console.error('load jobs failed:', e) }
    setSelected([])
  }, [status, page])

  useEffect(() => { load() }, [load])

  const allChecked = jobs.length > 0 && jobs.every(j => selected.includes(j.github_repo_id))
  const toggleAll = () => setSelected(allChecked ? [] : jobs.map(j => j.github_repo_id))
  const toggleOne = (id: number) => setSelected(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  const bulkRetry = async () => {
    setRetrying(true)
    try {
      await api('/admin/jobs/bulk-retry', undefined, { method: 'POST', body: JSON.stringify({ ids: selected }) })
      load()
    } catch (e) { console.error(e) }
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
          <h1 className="text-2xl font-bold">ETL 作业管理</h1>
          <p className="text-muted-foreground text-sm mt-1">共 {total} 条记录</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.length > 0 && (
            <Button size="sm" onClick={bulkRetry} disabled={retrying}>
              <RefreshCw className="size-4 mr-1" />重试选中 ({selected.length})
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={load}>刷新</Button>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {STATUSES.map(s => (
          <Button key={s} size="sm" variant={status === s ? 'default' : 'outline'}
            onClick={() => { setStatus(s); setPage(1) }}>
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
                  <th className="px-4 py-3 text-left">仓库</th>
                  <th className="px-4 py-3 text-left">状态</th>
                  <th className="px-4 py-3 text-left">重试</th>
                  <th className="px-4 py-3 text-left">错误信息</th>
                  <th className="px-4 py-3 text-left">上次处理</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map(job => (
                  <tr key={job.github_repo_id} className="border-b hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(job.github_repo_id)} onChange={() => toggleOne(job.github_repo_id)} />
                    </td>
                    <td className="px-4 py-3 font-medium">{job.full_name}</td>
                    <td className="px-4 py-3">
                      <Badge variant={job.etl_status === 'failed' ? 'destructive' : job.etl_status === 'completed' ? 'default' : 'secondary'}>
                        {STATUS_LABELS[job.etl_status] || job.etl_status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">{job.retry_count}/{job.max_retries}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px] truncate">
                      {job.error_log ? (
                        <button className="text-left hover:text-foreground cursor-pointer underline underline-offset-2" onClick={() => setLogModal(job.error_log)}>
                          {job.error_log.slice(0, 60)}{job.error_log.length > 60 ? '...' : ''}
                        </button>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{job.last_processed_at || '-'}</td>
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
          <Button size="sm" variant="outline" disabled={jobs.length < 30} onClick={() => setPage(p => p + 1)}>下一页</Button>
        </div>
      </div>

      {logModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setLogModal(null)}>
          <div className="bg-background rounded-xl border shadow-lg max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <h3 className="font-semibold">错误详情</h3>
              <Button size="sm" variant="ghost" onClick={() => setLogModal(null)}>关闭</Button>
            </div>
            <pre className="p-5 text-sm whitespace-pre-wrap break-words">{logModal}</pre>
          </div>
        </div>
      )}
    </div>
  )
}
